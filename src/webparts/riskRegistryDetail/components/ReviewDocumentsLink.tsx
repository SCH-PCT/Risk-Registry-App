import * as React from 'react';
import { Icon } from '@fluentui/react';

import { IRiskDocumentRepository } from '../../../data/repositories/IRiskDocumentRepository';
import styles from './ReviewDocumentsLink.module.scss';

export interface IReviewDocumentsLinkProps {
  /** e.g. "Review CAP" — the link text, matching the design. */
  readonly label: string;
  readonly riskBusinessId: number | undefined;
  readonly documents: IRiskDocumentRepository;
}

/**
 * The design's "Review [X] before proceeding" link — resolves the risk's
 * document folder's library view via
 * {@link IRiskDocumentRepository.getRiskFolderBrowseUrl} on click and opens
 * it in a new tab, so a reviewer can see whatever has actually been
 * uploaded rather than a single assumed file.
 */
export const ReviewDocumentsLink: React.FC<IReviewDocumentsLinkProps> = ({ label, riskBusinessId, documents }) => {
  const [isResolving, setIsResolving] = React.useState(false);

  if (riskBusinessId === undefined) {
    return null;
  }

  const handleClick = (event: React.MouseEvent): void => {
    event.preventDefault();
    setIsResolving(true);
    documents
      .getRiskFolderBrowseUrl(riskBusinessId)
      .then((url) => window.open(url, '_blank', 'noopener'))
      .catch(() => {
        // Best-effort navigation aid — a failure here just means the new tab
        // never opens, not a state anything else in the form depends on.
      })
      .finally(() => setIsResolving(false));
  };

  return (
    <div className={styles.banner}>
      <Icon iconName="Info" className={styles.infoIcon} aria-hidden="true" />
      <span>Important: Click to review the uploaded document before proceeding</span>
      <a href="#" className={styles.link} onClick={handleClick} aria-disabled={isResolving}>
        {label}
      </a>
    </div>
  );
};

export default ReviewDocumentsLink;
