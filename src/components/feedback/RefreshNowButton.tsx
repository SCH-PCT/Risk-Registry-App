import * as React from 'react';
import { DefaultButton, Icon, IButtonStyles } from '@fluentui/react';

import { BUTTON_CORNER_RADIUS } from '../../styles/buttonCornerRadius';
import styles from './RefreshStatus.module.scss';

export interface IRefreshNowButtonProps {
  readonly onRefreshNow: () => void;
  /** True while a refresh is already in flight — disables/de-duplicates the action. */
  readonly isRefreshing: boolean;
  readonly label?: string;
}

/*
 * Border matches the page's Cancel button (`SECONDARY_BUTTON_STYLES` in
 * `webparts/riskRegistryDetail/components/buttonStyles.ts`'s `#dee3ea`,
 * itself `_theme.scss`'s `$rr-border`); text is lightened to match the
 * "Updated [time]" text beside this button (`RefreshStatus.module.scss`'s
 * `.refreshStatus` color) rather than Fluent's default near-black — both per
 * explicit design feedback. Passed via `styles` rather than `className`:
 * Fluent computes its own border/text color at a specificity page CSS can't
 * reliably beat, same rationale as `buttonStyles.ts`.
 */
const REFRESH_BUTTON_STYLES: IButtonStyles = {
  root: {
    borderColor: '#dee3ea',
    color: 'var(--neutralSecondary, #605e5c)',
    borderRadius: BUTTON_CORNER_RADIUS
  }
};

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
    styles={REFRESH_BUTTON_STYLES}
    onClick={onRefreshNow}
    disabled={isRefreshing}
    ariaLabel={isRefreshing ? 'Refreshing' : label}
  >
    <Icon iconName="Refresh" aria-hidden="true" />
    <span>{label}</span>
  </DefaultButton>
);

export default RefreshNowButton;
