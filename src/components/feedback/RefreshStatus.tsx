import * as React from 'react';
import { Icon } from '@fluentui/react';

import { IRefreshState } from '../../state/RefreshCoordinator';
import styles from './RefreshStatus.module.scss';

/**
 * Shows "Last updated" plus a non-blocking paused/offline/stale indicator.
 *
 * Two different text surfaces exist on purpose:
 *  - The visible label uses relative-ish, short wording ("Updated just now").
 *  - The `aria-label` always carries the exact localized timestamp, per the
 *    requirement that accessible labels never rely on relative wording alone
 *    — "just now" is meaningless to someone who returns to the page later
 *    and has a screen reader read the same static markup back to them.
 */

export interface IRefreshStatusProps {
  readonly state: IRefreshState;
  readonly showLastRefreshed: boolean;
  /** True when the last completed refresh failed to replace what's on screen (data may be stale). */
  readonly isShowingStaleData?: boolean;
  readonly locale?: string;
}

function formatExactTimestamp(date: Date, locale: string | undefined): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function formatTimeOnly(date: Date, locale: string | undefined): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
  } catch {
    return date.toISOString();
  }
}

export const RefreshStatus: React.FC<IRefreshStatusProps> = ({
  state,
  showLastRefreshed,
  isShowingStaleData,
  locale
}) => {
  const resolvedLocale = locale ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);

  return (
    <div className={styles.refreshStatus}>
      {showLastRefreshed && state.lastRefreshCompleted && (
        <span
          className={styles.lastUpdated}
          aria-label={`Last updated ${formatExactTimestamp(state.lastRefreshCompleted, resolvedLocale)}`}
        >
          Updated {formatTimeOnly(state.lastRefreshCompleted, resolvedLocale)}
        </span>
      )}

      {state.isBackgroundRefreshing && (
        <span className={styles.backgroundIndicator} role="status" aria-live="polite">
          <Icon iconName="Sync" className={styles.spinningIcon} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Refreshing…</span>
        </span>
      )}

      {isShowingStaleData && (
        <span className={styles.staleWarning} role="status">
          <Icon iconName="Warning" aria-hidden="true" className={styles.warningIcon} />
          Showing information that may be out of date.
        </span>
      )}

      {state.isPaused && state.pauseReason === 'offline' && (
        <span className={styles.offlineIndicator} role="status">
          <Icon iconName="CloudOffline" aria-hidden="true" className={styles.warningIcon} />
          Offline — showing the last information retrieved.
        </span>
      )}

      {state.isPaused && state.pauseReason === 'repeated-failures' && (
        <span className={styles.staleWarning} role="status">
          <Icon iconName="Warning" aria-hidden="true" className={styles.warningIcon} />
          Automatic refresh paused after repeated failures. Use Refresh now to try again.
        </span>
      )}
    </div>
  );
};

export default RefreshStatus;
