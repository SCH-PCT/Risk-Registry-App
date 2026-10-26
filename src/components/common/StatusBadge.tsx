import * as React from 'react';
import { Icon } from '@fluentui/react';

import styles from './StatusBadge.module.scss';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface IStatusBadgeProps {
  readonly text: string;
  readonly tone: StatusTone;
}

const TONE_ICON: Readonly<Record<StatusTone, string>> = {
  neutral: 'CircleRing',
  info: 'Info',
  success: 'CompletedSolid',
  warning: 'Warning',
  danger: 'ErrorBadge'
};

/**
 * A status chip. Colour is never the only signal: every tone pairs with a
 * distinct icon, so the status is legible without colour — required for
 * colour-blind users and for forced-colors mode, where author colours are
 * discarded entirely.
 */
export const StatusBadge: React.FC<IStatusBadgeProps> = ({ text, tone }) => (
  <span className={`${styles.badge} ${styles[tone]}`}>
    <Icon iconName={TONE_ICON[tone]} aria-hidden="true" className={styles.icon} />
    {text}
  </span>
);

export default StatusBadge;
