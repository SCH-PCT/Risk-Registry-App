import * as React from 'react';
import { Icon, Spinner, SpinnerSize } from '@fluentui/react';

import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import { IRelatedEntitySectionState } from '../../../models/domain/IRelatedEntitySection';
import { DocumentUploadControl } from './DocumentUploadControl';
import { RelatedDocumentRow } from './RelatedDocumentRow';
import styles from './RelatedDocumentsPanel.module.scss';

export interface IRelatedDocumentsPanelProps {
  /** e.g. "Related Documents" — the panel heading. */
  readonly label: string;
  /**
   * The same related-documents state the page's bottom "Documents" section
   * reads from (`detail.relatedSections.documents`), so this panel never
   * issues a second, redundant fetch for the same folder. `undefined` for
   * the "create new" flow, where no risk — and therefore no document
   * folder — exists yet; treated the same as an empty, loaded list.
   */
  readonly section: IRelatedEntitySectionState<IRiskDocument> | undefined;
  /**
   * Only files whose `documentType` matches this value are shown — every
   * group's panel reads from the same risk folder, so without this filter a
   * file would show up identically in every group's list rather than just
   * the one it belongs to.
   */
  readonly documentType: string;
  /** Nested at the bottom of this panel when present, per the design moving "Attach Telemetry or Docs" inside "Related Documents". */
  readonly upload?: { readonly label: string; readonly helpText: string; readonly documentType: string };
  readonly riskBusinessId: number | undefined;
  /** The risk's own SharePoint system `ID`, forwarded to the nested `DocumentUploadControl`. `undefined` alongside `riskBusinessId` for an unsaved record. */
  readonly riskItemId: number | undefined;
  readonly documents: IRiskDocumentRepository;
  /**
   * Refetches `section` after a successful upload (via the nested
   * `DocumentUploadControl`), rename, or delete (via each `RelatedDocumentRow`),
   * so the list above stays accurate without a manual page refresh.
   */
  readonly onDocumentsChanged?: () => void;
}

function formatModifiedDate(value: Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return new Intl.DateTimeFormat(typeof navigator !== 'undefined' ? navigator.language : undefined, {
    dateStyle: 'medium'
  }).format(value);
}

/**
 * The design's "Related Documents" panel — lists the files already in the
 * risk's `RiskRegistryDocuments` folder whose `DocumentType` matches this
 * group's own `documentType`, with the group's upload control nested at the
 * bottom. Visually matches `TemplateDownloadPanel`'s header/body treatment so
 * the two panels read as a matched pair.
 */
export const RelatedDocumentsPanel: React.FC<IRelatedDocumentsPanelProps> = ({
  label,
  section,
  documentType,
  upload,
  riskBusinessId,
  riskItemId,
  documents,
  onDocumentsChanged
}) => {
  const status = section?.status ?? 'loaded';
  const items = (section?.items ?? []).filter((document) => document.documentType === documentType);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.heading}>
          <Icon iconName="DocumentSet" aria-hidden="true" />
          {label}
        </span>
      </div>

      <div className={styles.body}>
        {status === 'loading' && <Spinner size={SpinnerSize.small} label="Loading documents…" />}

        {status === 'error' && <span className={styles.statusNote}>Documents could not be loaded right now.</span>}

        {status === 'access-denied' && (
          <span className={styles.statusNote}>You do not have access to this risk&apos;s documents.</span>
        )}

        {status === 'not-configured' && (
          <span className={styles.statusNote}>Related documents are not available yet.</span>
        )}

        {status === 'loaded' && items.length === 0 && (
          <span className={styles.statusNote}>No documents found for this risk yet.</span>
        )}

        {status === 'loaded' && items.length > 0 && (
          <ul className={styles.list}>
            {items.map((document) => (
              <RelatedDocumentRow
                key={document.serverRelativeUrl}
                document={document}
                documents={documents}
                formattedModifiedDate={formatModifiedDate(document.lastModified)}
                onChanged={() => onDocumentsChanged?.()}
              />
            ))}
          </ul>
        )}
      </div>

      {upload && (
        <div className={styles.uploadRow}>
          <DocumentUploadControl
            label={upload.label}
            helpText={upload.helpText}
            documentType={upload.documentType}
            riskBusinessId={riskBusinessId}
            riskItemId={riskItemId}
            documents={documents}
            onUploaded={onDocumentsChanged}
          />
        </div>
      )}
    </div>
  );
};

export default RelatedDocumentsPanel;
