import * as React from 'react';
import { Icon, Spinner, SpinnerSize, MessageBar, MessageBarType } from '@fluentui/react';

import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import styles from './TemplateDownloadPanel.module.scss';

export interface ITemplateDownloadPanelProps {
  /** e.g. "SBAR" — used for the heading ("Need SBAR Template?") and badge text. */
  readonly label: string;
  /** Exact file name in the documents library's `Templates` folder, e.g. "SBAR Template.docx". */
  readonly fileName: string;
  readonly documents: IRiskDocumentRepository;
  /** Renders as a collapsed-by-default accordion instead of an always-open panel. */
  readonly collapsible?: boolean;
}

/**
 * The design's "Need [X] Template?" panel — resolves a forced-download URL
 * for `fileName` from the documents library's shared `Templates` folder on
 * click, via {@link IRiskDocumentRepository.getTemplateDownloadUrl}, and
 * opens it in a new tab. Resolved lazily (not on mount) so a step a user
 * never expands never spends a SharePoint call on a button they didn't
 * click.
 *
 * When `collapsible` is set, the whole panel starts collapsed — a user who
 * already knows the format doesn't need the panel open by default — and its
 * header becomes the expand/collapse toggle, matching `StepCard`'s own
 * chevron-header pattern.
 */
export const TemplateDownloadPanel: React.FC<ITemplateDownloadPanelProps> = ({ label, fileName, documents, collapsible }) => {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = React.useState(!collapsible);

  const handleDownload = (): void => {
    setStatus('loading');
    documents
      .getTemplateDownloadUrl(fileName)
      .then((url) => {
        setStatus('idle');
        window.open(url, '_blank', 'noopener');
      })
      .catch(() => setStatus('error'));
  };

  const heading = (
    <span className={styles.heading}>
      <Icon iconName="OpenFile" aria-hidden="true" />
      Need {label} Template?
    </span>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        {collapsible ? (
          <button
            type="button"
            className={styles.headerToggle}
            onClick={() => setIsExpanded((previous) => !previous)}
            aria-expanded={isExpanded}
          >
            <Icon iconName={isExpanded ? 'ChevronUp' : 'ChevronDown'} className={styles.chevron} aria-hidden="true" />
            {heading}
          </button>
        ) : (
          heading
        )}
        <span className={styles.badge}>Clinical Standard</span>
      </div>

      {isExpanded && (
        <>
          <div className={styles.body}>
            <div className={styles.fileChip}>
              <Icon iconName="WordDocument" aria-hidden="true" />
              <span className={styles.fileName}>{fileName}</span>
            </div>

            <button type="button" className={styles.downloadButton} onClick={handleDownload} disabled={status === 'loading'}>
              {status === 'loading' ? (
                <Spinner size={SpinnerSize.xSmall} />
              ) : (
                <Icon iconName="Download" aria-hidden="true" />
              )}
              Download {label} Template (.docx)
            </button>
          </div>

          {status === 'error' && (
            <MessageBar messageBarType={MessageBarType.error} role="alert">
              The template download link could not be resolved. Try again.
            </MessageBar>
          )}
        </>
      )}
    </div>
  );
};

export default TemplateDownloadPanel;
