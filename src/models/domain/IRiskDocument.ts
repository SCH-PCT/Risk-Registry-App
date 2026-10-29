/**
 * One file in the risk's document folder.
 *
 * Built only from universal SharePoint file properties (`Name`,
 * `ServerRelativeUrl`, `TimeLastModified`, `Length`) — these exist on every
 * document library regardless of custom columns, so listing them is not a
 * guessed-schema problem the way a custom `RiskActions` column would be.
 *
 * What IS unverified is the **folder-naming convention** this repository
 * assumes to find them (see `PnpRiskDocumentRepository` and SCHEMA-TODO.md
 * #27). A wrong assumption there surfaces as an empty Documents section, not
 * a crash or a fabricated file list.
 */
export interface IRiskDocument {
  readonly name: string;
  readonly serverRelativeUrl: string;
  readonly lastModified?: Date;
  readonly sizeBytes?: number;
  /**
   * The uploaded file's `DocumentType` column (see `config/listSchema.ts` and
   * `IRiskDocumentUploadMetadata`) — e.g. "CAP Document", "Risk Assessment".
   * `undefined` for a file that predates this column, or that was uploaded
   * outside this app.
   */
  readonly documentType?: string;
}
