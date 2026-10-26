import * as React from 'react';
import { DefaultButton, Icon } from '@fluentui/react';

import styles from './RefreshStatus.module.scss';

export interface IRefreshNowButtonProps {
  readonly onRefreshNow: () => void;
  /** True while a refresh is already in flight — disables/de-duplicates the action. */
  readonly isRefreshing: boolean;
  readonly label?: string;
}

/**
 * "Refresh now" affordance shared by every Risk Registry business web part.
 *
 * Disabled while a refresh is already running, which both prevents a user
 * from queueing up multiple manual refreshes by repeated clicking and gives
 * the hook's own in-flight coalescing nothing extra to do.
 */
export const RefreshNowButton: React.FC<IRefreshNowButtonProps> = ({
  onRefreshNow,
  isRefreshing,
  label = 'Refresh now'
}) => (
  <DefaultButton
    className={styles.refreshButton}
    onClick={onRefreshNow}
    disabled={isRefreshing}
    ariaLabel={isRefreshing ? 'Refreshing' : label}
  >
    <Icon iconName="Refresh" aria-hidden="true" />
    <span>{label}</span>
  </DefaultButton>
);

export default RefreshNowButton;
