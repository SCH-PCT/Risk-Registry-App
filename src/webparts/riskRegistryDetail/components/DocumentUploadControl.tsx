import * as React from 'react';
import { Icon, Spinner, SpinnerSize, MessageBar, MessageBarType } from '@fluentui/react';

import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import styles from './DocumentUploadControl.module.scss';

export interface IDocumentUploadControlProps {
  /** e.g. "Attach Telemetry or Docs" — shown as the upload prompt's heading, above the "Browse File" button. */
  readonly label: string;
  /** e.g. "PDF, DOCX, CSV (Max 25MB)" — shown under `label`. */
  readonly helpText: string;
  /** e.g. "CAP Document" — written to the uploaded file's `DocumentType` column (see `IRiskDocumentUploadMetadata`). */
  readonly documentType: string;
  /** The `RiskID` business field value. `undefined` for an unsaved "create new" record — uploads are disabled until the risk has one, matching `getForRisk`'s same policy. */
  readonly riskBusinessId: number | undefined;
  /** The risk's own SharePoint system `ID`, written to the uploaded file's `RiskId` column. `undefined` alongside `riskBusinessId` for an unsaved record. */
  readonly riskItemId: number | undefined;
  readonly documents: IRiskDocumentRepository;
  /** Called after a successful upload — lets a caller showing a live file list (e.g. `RelatedDocumentsPanel`) refetch so the new file actually appears in it. */
  readonly onUploaded?: () => void;
}

type UploadStatus = { readonly kind: 'idle' } | { readonly kind: 'uploading' } | { readonly kind: 'error' } | { readonly kind: 'uploaded'; readonly document: IRiskDocument };

/**
 * The upload prompt for one document section (e.g. "CAP Document",
 * "Assessment/Audit Plan") — a real upload into the risk's document folder
 * via {@link IRiskDocumentRepository.uploadForRisk}, which creates that
 * folder (named by `riskBusinessId`) if it does not exist yet, and tags the
 * uploaded file with `riskItemId`/`documentType`.
 */
export const DocumentUploadControl: React.FC<IDocumentUploadControlProps> = ({
  label,
  helpText,
  documentType,
  riskBusinessId,
  riskItemId,
  documents,
  onUploaded
}) => {
  const [status, setStatus] = React.useState<UploadStatus>({ kind: 'idle' });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isDisabled = riskBusinessId === undefined || riskItemId === undefined || status.kind === 'uploading';

  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || riskBusinessId === undefined || riskItemId === undefined) {
      return;
    }

    setStatus({ kind: 'uploading' });
    documents
      .uploadForRisk(riskBusinessId, file, { riskItemId, documentType })
      .then((document) => {
        setStatus({ kind: 'uploaded', document });
        onUploaded?.();
      })
      .catch(() => setStatus({ kind: 'error' }));
  };

  return (
    <div className={styles.control}>
      <input ref={inputRef} type="file" className={styles.hiddenInput} onChange={handleFileChosen} disabled={isDisabled} />

      <div className={styles.prompt}>
        {status.kind === 'uploading' ? (
          <Spinner size={SpinnerSize.medium} label="Uploading…" />
        ) : (
          <Icon iconName="CloudUpload" className={styles.promptIcon} aria-hidden="true" />
        )}
        <span className={styles.promptLabel}>{label}</span>
        <span className={styles.promptHelp}>{helpText}</span>
        <button type="button" className={styles.browseButton} onClick={() => inputRef.current?.click()} disabled={isDisabled}>
          Browse File
        </button>
        {riskBusinessId === undefined && <span className={styles.disabledNote}>Save this risk to enable uploads.</span>}
      </div>

      {status.kind === 'uploaded' && (
        <div className={styles.uploadedRow}>
          <Icon iconName="CheckMark" className={styles.uploadedIcon} aria-hidden="true" />
          <span className={styles.uploadedName}>{status.document.name}</span>
          <span className={styles.uploadedBadge}>Synced</span>
        </div>
      )}

      {status.kind === 'error' && (
        <MessageBar messageBarType={MessageBarType.error} role="alert">
          The file could not be uploaded. Try again.
        </MessageBar>
      )}
    </div>
  );
};

export default DocumentUploadControl;
