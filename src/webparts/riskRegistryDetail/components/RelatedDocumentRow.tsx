import * as React from 'react';
import { Icon, Link, TextField } from '@fluentui/react';

import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import { IRiskDocument } from '../../../models/domain/IRiskDocument';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import styles from './RelatedDocumentsPanel.module.scss';

export interface IRelatedDocumentRowProps {
  readonly document: IRiskDocument;
  readonly documents: IRiskDocumentRepository;
  readonly formattedModifiedDate: string | undefined;
  /** Refetches the document list — called after a successful rename or delete, matching `DocumentUploadControl`'s `onUploaded`. */
  readonly onChanged: () => void;
}

type RowMode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'renaming'; readonly value: string; readonly isSaving: boolean; readonly error?: string }
  | { readonly kind: 'confirming-delete' }
  | { readonly kind: 'deleting' }
  | { readonly kind: 'delete-error' };

/**
 * One file row in `RelatedDocumentsPanel`'s list — the link/date it already
 * had, plus rename and delete actions. Rename is inline (replaces the row's
 * link with a text field) rather than a native `prompt()`, to match the rest
 * of this app's custom dialog/inline-edit patterns; delete goes through the
 * shared `ConfirmDialog` since it is destructive and irreversible.
 */
export const RelatedDocumentRow: React.FC<IRelatedDocumentRowProps> = ({
  document,
  documents,
  formattedModifiedDate,
  onChanged
}) => {
  const [mode, setMode] = React.useState<RowMode>({ kind: 'idle' });

  const startRename = (): void => setMode({ kind: 'renaming', value: document.name, isSaving: false });
  const cancelRename = (): void => setMode({ kind: 'idle' });

  const confirmRename = (): void => {
    if (mode.kind !== 'renaming') {
      return;
    }
    const newName = mode.value.trim();
    if (!newName || newName === document.name) {
      setMode({ kind: 'idle' });
      return;
    }

    setMode({ kind: 'renaming', value: mode.value, isSaving: true });
    documents
      .renameDocument(document.serverRelativeUrl, newName)
      .then(() => onChanged())
      .catch(() =>
        setMode({ kind: 'renaming', value: newName, isSaving: false, error: 'The file could not be renamed. Try again.' })
      );
  };

  const requestDelete = (): void => setMode({ kind: 'confirming-delete' });

  const confirmDelete = (): void => {
    setMode({ kind: 'deleting' });
    documents
      .deleteDocument(document.serverRelativeUrl)
      .then(() => onChanged())
      .catch(() => setMode({ kind: 'delete-error' }));
  };

  if (mode.kind === 'renaming') {
    return (
      <li className={styles.listItem}>
        <Icon iconName="Page" className={styles.fileIcon} aria-hidden="true" />
        <TextField
          className={styles.renameField}
          value={mode.value}
          onChange={(_, newValue) => setMode({ kind: 'renaming', value: newValue ?? '', isSaving: mode.isSaving })}
          errorMessage={mode.error}
          disabled={mode.isSaving}
          autoFocus
          ariaLabel={`New name for ${document.name}`}
        />
        <button type="button" className={styles.rowIconButton} onClick={confirmRename} disabled={mode.isSaving} title="Save name" aria-label="Save name">
          <Icon iconName="CheckMark" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.rowIconButton}
          onClick={cancelRename}
          disabled={mode.isSaving}
          title="Cancel rename"
          aria-label="Cancel rename"
        >
          <Icon iconName="Cancel" aria-hidden="true" />
        </button>
      </li>
    );
  }

  return (
    <li className={styles.listItem}>
      <Icon iconName="Page" className={styles.fileIcon} aria-hidden="true" />
      <Link href={document.serverRelativeUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
        {document.name}
      </Link>

      {mode.kind === 'delete-error' && <span className={styles.statusNote}>Could not be deleted.</span>}

      <span className={styles.rowActions}>
        {document.documentType && <span className={styles.typeChip}>{document.documentType}</span>}
        {formattedModifiedDate && <span className={styles.modifiedDate}>Modified {formattedModifiedDate}</span>}
        <button type="button" className={styles.rowIconButton} onClick={startRename} title="Rename" aria-label={`Rename ${document.name}`}>
          <Icon iconName="Edit" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.rowIconButton}
          onClick={requestDelete}
          disabled={mode.kind === 'deleting'}
          title="Delete"
          aria-label={`Delete ${document.name}`}
        >
          <Icon iconName="Delete" aria-hidden="true" />
        </button>
      </span>

      <ConfirmDialog
        isOpen={mode.kind === 'confirming-delete'}
        title="Delete this file?"
        message={`"${document.name}" will be permanently removed. This cannot be undone.`}
        confirmButtonText="Delete"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setMode({ kind: 'idle' })}
      />
    </li>
  );
};

export default RelatedDocumentRow;
