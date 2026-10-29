/**
 * In-memory implementations of the five related-entity repositories, for
 * tests and local development without a live site.
 *
 * Unlike their `pnp/` counterparts for Actions/Activities/Updates/
 * Assignments, these mocks DO return sample data — they exist so the Detail
 * web part's related sections, hooks and tests have something to render
 * against, independent of whether the real schema has been verified yet.
 * The schema gate lives only in the PnP implementations.
 */

import { IRiskAction, IRiskActivity, IRiskAssignment, IRiskUpdateRecord } from '../../../models/domain/IRiskRelatedRecord';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import { IRiskActionRepository } from '../IRiskActionRepository';
import { IRiskActivityRepository } from '../IRiskActivityRepository';
import { IRiskAssignmentRepository } from '../IRiskAssignmentRepository';
import { IRiskDocumentRepository, IRiskDocumentUploadMetadata } from '../IRiskDocumentRepository';
import { IRiskUpdateRepository } from '../IRiskUpdateRepository';

export class MockRiskActionRepository implements IRiskActionRepository {
  public constructor(private readonly _items: readonly IRiskAction[] = []) {}
  public async getForRisk(): Promise<IRiskAction[]> {
    return [...this._items];
  }
}

export class MockRiskActivityRepository implements IRiskActivityRepository {
  public constructor(private readonly _items: readonly IRiskActivity[] = []) {}
  public async getForRisk(): Promise<IRiskActivity[]> {
    return [...this._items];
  }
}

export class MockRiskUpdateRepository implements IRiskUpdateRepository {
  public constructor(private readonly _items: readonly IRiskUpdateRecord[] = []) {}
  public async getForRisk(): Promise<IRiskUpdateRecord[]> {
    return [...this._items];
  }
}

export class MockRiskAssignmentRepository implements IRiskAssignmentRepository {
  public constructor(private readonly _items: readonly IRiskAssignment[] = []) {}
  public async getForRisk(): Promise<IRiskAssignment[]> {
    return [...this._items];
  }
}

export class MockRiskDocumentRepository implements IRiskDocumentRepository {
  public constructor(private _items: readonly IRiskDocument[] = []) {}

  public async getForRisk(): Promise<IRiskDocument[]> {
    return [...this._items];
  }

  public async uploadForRisk(riskBusinessId: number, file: File, metadata: IRiskDocumentUploadMetadata): Promise<IRiskDocument> {
    const uploaded: IRiskDocument = {
      name: file.name,
      serverRelativeUrl: `/sites/RiskRegistry/Shared Documents/${riskBusinessId}/${file.name}`,
      lastModified: new Date(),
      sizeBytes: file.size,
      documentType: metadata.documentType
    };
    this._items = [...this._items.filter((item) => item.name !== file.name), uploaded];
    return uploaded;
  }

  public async deleteDocument(serverRelativeUrl: string): Promise<void> {
    this._items = this._items.filter((item) => item.serverRelativeUrl !== serverRelativeUrl);
  }

  public async renameDocument(serverRelativeUrl: string, newName: string): Promise<IRiskDocument> {
    const existing = this._items.find((item) => item.serverRelativeUrl === serverRelativeUrl);
    if (!existing) {
      throw new Error(`No document at ${serverRelativeUrl}.`);
    }

    const folderPath = serverRelativeUrl.slice(0, serverRelativeUrl.lastIndexOf('/'));
    const renamed: IRiskDocument = { ...existing, name: newName, serverRelativeUrl: `${folderPath}/${newName}` };
    this._items = this._items.map((item) => (item.serverRelativeUrl === serverRelativeUrl ? renamed : item));
    return renamed;
  }

  public async getTemplateDownloadUrl(templateFileName: string): Promise<string> {
    return `/sites/RiskRegistry/_layouts/15/download.aspx?SourceUrl=%2Fsites%2FRiskRegistry%2FShared%20Documents%2FTemplates%2F${encodeURIComponent(
      templateFileName
    )}`;
  }
}
