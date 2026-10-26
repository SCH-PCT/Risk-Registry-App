import * as React from 'react';

import styles from './EmptyState.module.scss';

export interface IEmptyStateProps {
  readonly message: string;
  readonly children?: React.ReactNode;
}

/** A section with nothing to show — not an error, a normal "no data yet" state. */
export const EmptyState: React.FC<IEmptyStateProps> = ({ message, children }) => (
  <div className={styles.emptyState} role="status">
    <span>{message}</span>
    {children}
  </div>
);

export default EmptyState;
