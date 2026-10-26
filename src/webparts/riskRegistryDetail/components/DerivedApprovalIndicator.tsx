import * as React from 'react';

import styles from './DerivedApprovalIndicator.module.scss';

export interface IDerivedApprovalIndicatorProps {
  readonly label: string;
  readonly description: string;
  readonly isApproved: boolean;
}

/**
 * The design's "CAP Approved and Closed" / "Correction Approved & Risk
 * Closed" style toggle — rendered here as a read-only, computed status, not
 * an independent editable field, because no verified `RiskRegistryData`
 * column backs a distinct "is this closed" flag for these groups. `isApproved`
 * is derived by the caller from the approval fields already in the same
 * group, so this never claims a fact the surrounding fields don't already
 * support, and never offers to save a value nothing persists.
 */
export const DerivedApprovalIndicator: React.FC<IDerivedApprovalIndicatorProps> = ({ label, description, isApproved }) => (
  <div className={styles.row}>
    <div className={styles.copy}>
      <span className={styles.label}>{label}</span>
      <span className={styles.description}>{description} — reflects the approvals above</span>
    </div>
    <span
      className={`${styles.indicator} ${isApproved ? styles.on : ''}`}
      role="status"
      aria-label={`${label}: ${isApproved ? 'Approved' : 'Not yet approved'}`}
    >
      <span className={styles.knob} />
    </span>
  </div>
);

export default DerivedApprovalIndicator;
