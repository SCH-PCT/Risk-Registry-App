import * as React from 'react';
import { Link, Icon } from '@fluentui/react';

import styles from './GoBackButton.module.scss';

export interface IGoBackButtonProps {
  /**
   * Web-part-property-pane-configured destination. When blank/undefined,
   * falls back to browser history instead of a fixed URL.
   */
  readonly goBackUrl?: string;
}

/**
 * Centered "Go Back" affordance shown at the top of the Risk Registry Detail
 * web part, for both the existing-item and "create new" headers.
 *
 * Navigates to `goBackUrl` when the web part property is set; otherwise
 * falls back to `window.history.back()`, matching a plain browser back
 * button.
 */
export const GoBackButton: React.FC<IGoBackButtonProps> = ({ goBackUrl }) => {
  const handleClick = (): void => {
    const target = goBackUrl?.trim();
    if (target) {
      window.location.href = target;
    } else {
      window.history.back();
    }
  };

  return (
    <div className={styles.row}>
      <Link className={styles.link} onClick={handleClick}>
        {/* `Back` renders a true arrow glyph (shaft + head) rather than
            `ChevronLeft`'s bare angle bracket, per explicit design feedback. */}
        <Icon iconName="Back" aria-hidden="true" className={styles.icon} />
        <span>Go Back</span>
      </Link>
    </div>
  );
};

export default GoBackButton;
