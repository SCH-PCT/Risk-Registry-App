import * as React from 'react';
import { Icon, Spinner, SpinnerSize, MessageBar, MessageBarType } from '@fluentui/react';

import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import styles from './DocumentUploadControl.module.scss';

export interface IDocumentUploadControlProps {
  /** e.g. "Attach Telemetry or Docs" — shown as the dropzone's call to action. */
  readonly label: string;
  /** e.g. "PDF, DOCX, CSV (Max 25MB)" — shown as helper text under the label. */
  readonly helpText: string;
  /** The `RiskID` business field value. `undefined` for an unsaved "create new" record — uploads are disabled until the risk has one, matching `getForRisk`'s same policy. */
  readonly riskBusinessId: number | undefined;
  readonly documents: IRiskDocumentRepository;
}

type UploadStatus = { readonly kind: 'idle' } | { readonly kind: 'uploading' } | { readonly kind: 'error' } | { readonly kind: 'uploaded'; readonly document: IRiskDocument };

/**
 * The design's upload dropzone (e.g. "Clinical Evidence", "CAP Draft
 * Upload") — a real upload into the risk's document folder via
 * {@link IRiskDocumentRepository.uploadForRisk}, which creates that folder
 * (named by `riskBusinessId`) if it does not exist yet. Shows the uploaded
 * file's name once the call resolves, as proof of what actually happened —
 * not a persistent file list (that already exists as the page's "Documents"
 * related section, which reflects every upload regardless of which control
 * added it).
 */
export const DocumentUploadControl: React.FC<IDocumentUploadControlProps> = ({ label, helpText, riskBusinessId, documents }) => {
  const [status, setStatus] = React.useState<UploadStatus>({ kind: 'idle' });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isDisabled = riskBusinessId === undefined || status.kind === 'uploading';

  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || riskBusinessId === undefined) {
      return;
    }

    setStatus({ kind: 'uploading' });
    documents
      .uploadForRisk(riskBusinessId, file)
      .then((document) => setStatus({ kind: 'uploaded', document }))
      .catch(() => setStatus({ kind: 'error' }));
  };

  return (
    <div className={styles.control}>
      <input ref={inputRef} type="file" className={styles.hiddenInput} onChange={handleFileChosen} disabled={isDisabled} />

      <div className={styles.dropzone}>
        {status.kind === 'uploading' ? (
          <Spinner size={SpinnerSize.medium} label="Uploading…" />
        ) : (
          <Icon iconName="CloudUpload" className={styles.dropzoneIcon} aria-hidden="true" />
        )}
        <span className={styles.dropzoneLabel}>{label}</span>
        <span className={styles.dropzoneHelp}>{helpText}</span>
        <button
          type="button"
          className={styles.browseButton}
          onClick={() => inputRef.current?.click()}
          disabled={isDisabled}
        >
          Browse File
        </button>
        {riskBusinessId === undefined && (
          <span className={styles.disabledNote}>Save this risk to enable uploads.</span>
        )}
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
