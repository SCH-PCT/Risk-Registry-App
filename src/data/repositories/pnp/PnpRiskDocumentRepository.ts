/**
 * PnPjs implementation of {@link IRiskDocumentRepository}.
 *
 * ## What is verified vs. assumed here
 *
 * File listing (`Name`, `ServerRelativeUrl`, `TimeLastModified`, `Length`)
 * uses only properties every SharePoint document library exposes — this is
 * not a guessed custom column, the way a `RiskActions` field would be.
 *
 * The **folder-naming convention** is the unverified part: the brief states
 * documents are "grouped by folders with RiskId as the name," which this
 * repository takes literally — one subfolder per risk, named with the
 * `RiskID` business field's value as plain text (e.g. folder `142` for a
 * risk whose `RiskID` is 142). See SCHEMA-TODO.md #27. If that assumption is
 * wrong, the practical effect is a library-wide empty Documents section,
 * never a wrong risk's documents and never a thrown error — see the 404
 * handling below.
 */

import { SPFI } from '@pnp/sp';
import { ISPFXContext } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/folders';
import '@pnp/sp/files';
import '@pnp/sp/files/folder';

import { RISK_REGISTRY_DOCUMENTS } from '../../../config/listSchema';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import { getSp } from '../../services/spContext';
import { IRiskDocumentRepository } from '../IRiskDocumentRepository';
import { RiskRegistryError } from '../IRiskRegistryRepository';

interface IFileListingResult {
  readonly Name: string;
  readonly ServerRelativeUrl: string;
  readonly TimeLastModified?: string;
  readonly Length?: string | number;
}

/**
 * Downloadable form templates (SBAR, CAP, …) live in the site's own default
 * document library ("Shared Documents"), under a `Templates` folder — a
 * different library entirely from `RISK_REGISTRY_DOCUMENTS` (used for
 * per-risk uploads below). Verified against the live site: confirmed real
 * path is `/sites/RiskRegistry/Shared Documents/Templates/SBAR Template.docx`.
 * A prior version of this method incorrectly looked for templates inside
 * `RISK_REGISTRY_DOCUMENTS` instead, which 404'd on download.
 */
const SITE_DOCUMENTS_LIBRARY_FOLDER_NAME = 'Shared Documents';
const TEMPLATES_FOLDER_NAME = 'Templates';

function getHttpStatus(error: unknown): number | undefined {
  const candidate = error as { isHttpRequestError?: boolean; status?: number } | undefined;
  return candidate?.isHttpRequestError === true ? candidate.status : undefined;
}

function toAccessOrTransientError(error: unknown, message: string): RiskRegistryError {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) {
    return new RiskRegistryError('access-denied', 'The current user cannot access the risk documents library.');
  }
  return new RiskRegistryError('transient', message);
}

export class PnpRiskDocumentRepository implements IRiskDocumentRepository {
  private readonly _sp: SPFI;

  public constructor(context: ISPFXContext) {
    this._sp = getSp(context);
  }

  public async getForRisk(riskBusinessId: number | undefined): Promise<IRiskDocument[]> {
    if (riskBusinessId === undefined) {
      // No RiskID on this item yet — a normal state, not an error.
      return [];
    }

    try {
      const library = this._sp.web.lists.getByTitle(RISK_REGISTRY_DOCUMENTS.title);
      const rootFolder = await library.rootFolder();
      const folderPath = `${rootFolder.ServerRelativeUrl}/${riskBusinessId}`;

      const files = (await this._sp.web
        .getFolderByServerRelativePath(folderPath)
        .files.select('Name', 'ServerRelativeUrl', 'TimeLastModified', 'Length')()) as IFileListingResult[];

      return files.map((file) => ({
        name: file.Name,
        serverRelativeUrl: file.ServerRelativeUrl,
        lastModified: file.TimeLastModified ? new Date(file.TimeLastModified) : undefined,
        sizeBytes: file.Length !== undefined ? Number(file.Length) : undefined
      }));
    } catch (error) {
      const status = getHttpStatus(error);

      if (status === 404) {
        // No folder for this risk yet. Not an error — see the file header.
        return [];
      }

      if (status === 401 || status === 403) {
        throw new RiskRegistryError('access-denied', 'The current user cannot access the risk documents library.');
      }

      throw new RiskRegistryError('transient', 'The risk documents could not be listed.');
    }
  }

  public async uploadForRisk(riskBusinessId: number, file: File): Promise<IRiskDocument> {
    try {
      const library = this._sp.web.lists.getByTitle(RISK_REGISTRY_DOCUMENTS.title);
      const rootFolder = await library.rootFolder();
      const folderPath = `${rootFolder.ServerRelativeUrl}/${riskBusinessId}`;

      // Idempotent: creates the folder if it does not exist yet, or returns
      // the existing one — never errors on an already-present folder, which
      // is the common case once a risk has uploaded its first file.
      await this._sp.web.folders.addUsingPath(folderPath, false);

      const uploaded = await this._sp.web
        .getFolderByServerRelativePath(folderPath)
        .files.addUsingPath(file.name, file, { Overwrite: true });

      return {
        name: uploaded.Name,
        serverRelativeUrl: uploaded.ServerRelativeUrl,
        lastModified: uploaded.TimeLastModified ? new Date(uploaded.TimeLastModified) : undefined,
        sizeBytes: uploaded.Length !== undefined ? Number(uploaded.Length) : undefined
      };
    } catch (error) {
      throw toAccessOrTransientError(error, 'The file could not be uploaded.');
    }
  }

  public async getTemplateDownloadUrl(templateFileName: string): Promise<string> {
    try {
      const web = await this._sp.web.select('ServerRelativeUrl')();
      const templateFilePath = `${web.ServerRelativeUrl}/${SITE_DOCUMENTS_LIBRARY_FOLDER_NAME}/${TEMPLATES_FOLDER_NAME}/${templateFileName}`;

      // `_layouts/15/download.aspx` forces an actual file download; a plain
      // link to the file's own URL instead redirects Office file types
      // (.docx, .xlsx, …) to the Office Online preview.
      return `${web.ServerRelativeUrl}/_layouts/15/download.aspx?SourceUrl=${encodeURIComponent(templateFilePath)}`;
    } catch (error) {
      throw toAccessOrTransientError(error, 'The template download link could not be resolved.');
    }
  }

  public async getRiskFolderBrowseUrl(riskBusinessId: number): Promise<string> {
    try {
      const library = this._sp.web.lists.getByTitle(RISK_REGISTRY_DOCUMENTS.title);
      const { DefaultViewUrl } = await library.select('DefaultViewUrl')();
      const rootFolder = await library.rootFolder();
      const folderPath = `${rootFolder.ServerRelativeUrl}/${riskBusinessId}`;

      return `${DefaultViewUrl}?id=${encodeURIComponent(folderPath)}`;
    } catch (error) {
      throw toAccessOrTransientError(error, 'The risk documents folder link could not be resolved.');
    }
  }
}
