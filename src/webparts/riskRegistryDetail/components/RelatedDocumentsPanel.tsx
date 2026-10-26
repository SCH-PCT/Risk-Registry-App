import * as React from 'react';
import { Icon, Spinner, SpinnerSize, Link } from '@fluentui/react';

import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import { IRelatedEntitySectionState } from '../../../models/domain/IRelatedEntitySection';
import { DocumentUploadControl } from './DocumentUploadControl';
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
  /** Nested at the bottom of this panel when present, per the design moving "Attach Telemetry or Docs" inside "Related Documents". */
  readonly upload?: { readonly label: string; readonly helpText: string };
  readonly riskBusinessId: number | undefined;
  readonly documents: IRiskDocumentRepository;
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
 * The design's "Related Documents" panel — lists every file already in the
 * risk's `RiskRegistryDocuments` folder, with the group's upload control
 * nested at the bottom. Visually matches `TemplateDownloadPanel`'s
 * header/badge/body treatment so the two panels read as a matched pair.
 */
export const RelatedDocumentsPanel: React.FC<IRelatedDocumentsPanelProps> = ({ label, section, upload, riskBusinessId, documents }) => {
  const status = section?.status ?? 'loaded';
  const items = section?.items ?? [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.heading}>
          <Icon iconName="DocumentSet" aria-hidden="true" />
          {label}
        </span>
        <span className={styles.badge}>Document Library</span>
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
              <li key={document.serverRelativeUrl} className={styles.listItem}>
                <Icon iconName="Page" className={styles.fileIcon} aria-hidden="true" />
                <Link href={document.serverRelativeUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                  {document.name}
                </Link>
                {formatModifiedDate(document.lastModified) && (
                  <span className={styles.modifiedDate}>Modified {formatModifiedDate(document.lastModified)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {upload && (
        <div className={styles.uploadRow}>
          <DocumentUploadControl label={upload.label} helpText={upload.helpText} riskBusinessId={riskBusinessId} documents={documents} />
        </div>
      )}
    </div>
  );
};

export default RelatedDocumentsPanel;
