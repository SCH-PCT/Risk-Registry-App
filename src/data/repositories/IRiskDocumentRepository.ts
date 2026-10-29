import { IRiskDocument } from '../../models/domain/IRiskDocument';

/** Metadata written onto an uploaded file's list item, alongside the file itself. */
export interface IRiskDocumentUploadMetadata {
  /**
   * The parent `RiskRegistryData` item's own SharePoint system `ID` — written
   * to the uploaded file's `RiskId` column (see `config/listSchema.ts`).
   * Distinct from `riskBusinessId` below, which is the `RiskID` business
   * field the upload's destination *folder* is named with.
   */
  readonly riskItemId: number;
  /** e.g. "SBAR Document", "CAP Document" — which step/section the upload came from, written to the uploaded file's `DocumentType` column. */
  readonly documentType: string;
}

/**
 * Read and write access to the documents stored for one risk, plus the
 * template-download helper the Detail web part's per-step upload/template UI
 * needs (see `webparts/riskRegistryDetail/components/detailSections.ts`
 * `IFieldGroup.templateDownload`/`documentUpload`).
 *
 * Unlike the other four related repositories, this one can be partially
 * implemented today: file listing uses only universal SharePoint file
 * properties (see `IRiskDocument`). What remains unverified is the
 * folder-naming convention — see `PnpRiskDocumentRepository` and
 * SCHEMA-TODO.md #27.
 */
export interface IRiskDocumentRepository {
  /**
   * @param riskBusinessId - The `RiskID` business field value (not the
   *   system item ID — see `config/listSchema.ts`). `undefined` when the
   *   current risk has no `RiskID` set, in which case this resolves to an
   *   empty array rather than guessing a fallback folder.
   */
  getForRisk(riskBusinessId: number | undefined): Promise<IRiskDocument[]>;

  /**
   * Uploads `file` into the risk's document folder (named by `riskBusinessId`,
   * per the same convention {@link getForRisk} reads from), creating that
   * folder first if it does not exist yet. Overwrites an existing file of
   * the same name — re-uploading a draft is expected to replace it, not
   * create a second copy.
   *
   * @param riskBusinessId - The `RiskID` business field value. Callers must
   *   not call this before the risk has one (an unsaved "create new" record)
   *   — there is deliberately no fallback folder for that case, the same
   *   policy {@link getForRisk} follows.
   * @param metadata - Written onto the uploaded file's list item — see
   *   {@link IRiskDocumentUploadMetadata}.
   */
  uploadForRisk(riskBusinessId: number, file: File, metadata: IRiskDocumentUploadMetadata): Promise<IRiskDocument>;

  /** Permanently deletes one file, identified by its {@link IRiskDocument.serverRelativeUrl}. */
  deleteDocument(serverRelativeUrl: string): Promise<void>;

  /**
   * Renames one file in place (same folder, new name), identified by its
   * {@link IRiskDocument.serverRelativeUrl}. `newName` is the full file name
   * including extension — the caller is responsible for keeping or changing
   * it. Resolves the renamed document (its `serverRelativeUrl` changes along
   * with the name).
   */
  renameDocument(serverRelativeUrl: string, newName: string): Promise<IRiskDocument>;

  /**
   * Resolves a URL that forces a browser download (rather than an Office
   * Online preview) of `templateFileName` — e.g. `"SBAR Template.docx"` —
   * from the site's own default document library ("Shared Documents")'s
   * `Templates` folder. Deliberately a *different* library from the one
   * `getForRisk`/`uploadForRisk` use above, and verified against the live
   * site (see `PnpRiskDocumentRepository`).
   */
  getTemplateDownloadUrl(templateFileName: string): Promise<string>;
}
