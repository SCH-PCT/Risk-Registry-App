import * as React from 'react';
import { Icon } from '@fluentui/react';

import styles from './KpiTile.module.scss';

export type KpiAccent = 'critical' | 'teal' | 'amber' | 'green';

export interface IKpiTileProps {
  readonly label: string;
  readonly value: number;
  readonly icon: string;
  readonly accent: KpiAccent;
  /** Short, factual caption under the count — never a fabricated metric, only what the data actually shows. */
  readonly caption?: string;
  readonly linkLabel?: string;
  readonly onLinkClick?: () => void;
}

/**
 * One KPI summary tile — the design's 4-up strip above the filter bar. Every
 * number here is computed from the fetched `RiskRegistryData` snapshot (see
 * `useRiskRegistryList`'s `kpis`); nothing is a placeholder or invented stat.
 */
export const KpiTile: React.FC<IKpiTileProps> = ({ label, value, icon, accent, caption, linkLabel, onLinkClick }) => (
  <div className={`${styles.tile} ${styles[accent]}`} role="group" aria-label={label}>
    <div className={styles.accentBar} />
    <div className={styles.header}>
      <span className={styles.label}>{label}</span>
      <span className={styles.iconBadge}>
        <Icon iconName={icon} aria-hidden="true" />
      </span>
    </div>
    <div className={styles.valueRow}>
      <span className={styles.value}>{value}</span>
    </div>
    <div className={styles.footerRow}>
      {caption && <span className={styles.caption}>{caption}</span>}
      {linkLabel && onLinkClick && (
        <button type="button" className={styles.link} onClick={onLinkClick}>
          {linkLabel}
        </button>
      )}
    </div>
  </div>
);

export default KpiTile;
