import * as React from 'react';
import { Icon, SearchBox } from '@fluentui/react';

import { IRiskRegistryListProps } from './IRiskRegistryListProps';
import { useRiskRegistryList } from '../../../hooks/useRiskRegistryList';
import { LoadingState } from '../../../components/common/LoadingState';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState, DetailErrorKind } from '../../../components/common/ErrorState';
import { RefreshStatus } from '../../../components/feedback/RefreshStatus';
import { RefreshNowButton } from '../../../components/feedback/RefreshNowButton';
import { KpiTile } from './KpiTile';
import { RiskListCard } from './RiskListCard';
import { asNumber, asPerson, asText, computePaginationPages } from './riskListPresentation';
import styles from './RiskRegistryList.module.scss';

const PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 25, 50];

function downloadCsv(rows: readonly string[][], fileName: string): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Risk Registry List web part — a KPI-and-card dashboard over the
 * `RiskRegistryData` list, per the "Clinical Clarity" design.
 *
 * Uses `useRiskRegistryList`, which drives the same `useAutoRefresh` engine
 * and `IRefreshConfiguration` shape as the Detail web part's
 * `useRiskRegistryDetail` — the refresh status row at the bottom of the
 * header and the "Refresh now" button are the same shared components the
 * Detail web part uses, not a re-implementation.
 */
export const RiskRegistryList: React.FC<IRiskRegistryListProps> = ({
  repository,
  refreshConfiguration,
  showLastRefreshed,
  detailPageUrl
}) => {
  const list = useRiskRegistryList({ repository, refreshConfiguration });

  const handleExportCsv = (): void => {
    const header = ['Risk ID', 'Title', 'Status', 'Priority Rating', 'Harm Flag', 'Accountable Executive', 'Submitted By', 'Created'];
    const rows = list.pageItems.map((item) => {
      const riskId = asNumber(item.fields.riskId);
      return [
        riskId !== undefined ? String(riskId) : '',
        asText(item.fields.title) ?? '',
        asText(item.fields.riskStatus) ?? '',
        asText(item.fields.riskPriorityRating) ?? '',
        asText(item.fields.hasHarmToPatientVisitorWorkforce) ?? '',
        asPerson(item.fields.accountableExecutive)?.displayName ?? '',
        item.submittedBy?.displayName ?? '',
        item.created ? item.created.toISOString() : ''
      ];
    });
    downloadCsv([header, ...rows], 'risk-registry-export.csv');
  };

  const handleNewIntakeClick = (): void => {
    if (detailPageUrl) {
      window.location.assign(detailPageUrl);
    }
  };

  if (list.loadState === 'fatal-error') {
    return <ErrorState kind={(list.errorKind ?? 'unknown') as DetailErrorKind} onRetry={list.refreshNow} />;
  }

  if (list.loadState === 'loading') {
    return <LoadingState label="Loading risk registry…" />;
  }

  const paginationPages = computePaginationPages(list.page, list.pageCount);

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Risk Registry</h1>
          <span className={styles.countChip}>
            <span className={styles.pulseDot} aria-hidden="true" />
            {list.kpis.totalActive} Total Active Incidents
          </span>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={handleExportCsv}>
            <Icon iconName="Download" aria-hidden="true" />
            Export CSV / Report
          </button>
          {detailPageUrl && (
            <button type="button" className={styles.primaryButton} onClick={handleNewIntakeClick}>
              <Icon iconName="Add" aria-hidden="true" />
              New Risk Intake
            </button>
          )}
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <KpiTile
          label="Critical / Tier 1 Risks"
          value={list.kpis.criticalCount}
          icon="Warning"
          accent="critical"
          caption={list.kpis.createdLast24h > 0 ? `+${list.kpis.createdLast24h} in the last 24h` : undefined}
        />
        <KpiTile
          label="Pending CQPS Review"
          value={list.kpis.pendingCqpsReviewCount}
          icon="FactCheck"
          accent="teal"
          caption="Awaiting CQPS determination"
          linkLabel="Open Queue"
          onLinkClick={() => list.setStatusFilter('Evaluation')}
        />
        <KpiTile
          label="Active CAPs in Progress"
          value={list.kpis.activeCapCount}
          icon="TaskManager"
          accent="teal"
          caption="Step 4 Governance"
          linkLabel="Track CAPA"
          onLinkClick={() => list.setStatusFilter('Assigned In-Progress')}
        />
        <KpiTile
          label="Resolved / Corrected"
          value={list.kpis.resolvedMonthToDateCount}
          icon="Completed"
          accent="green"
          caption={list.kpis.closureRatePercent !== undefined ? `${list.kpis.closureRatePercent}% Closure Rate` : undefined}
        />
      </div>

      <div className={styles.filterPanel}>
        <div className={styles.filterRow}>
          <div className={styles.statusFilterGroup}>
            <label htmlFor="risk-list-status-filter" className={styles.filterLabel}>
              Status:
            </label>
            <select
              id="risk-list-status-filter"
              className={styles.statusSelect}
              value={list.statusFilter ?? ''}
              onChange={(event) => list.setStatusFilter(event.target.value || undefined)}
            >
              <option value="">All Statuses</option>
              {list.availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.searchGroup}>
            <SearchBox
              placeholder="Search by Risk ID or title…"
              value={list.searchText}
              onChange={(_event, value) => list.setSearchText(value ?? '')}
              onClear={() => list.setSearchText('')}
              className={styles.searchBox}
            />
          </div>
        </div>

        {list.hasActiveFilters && (
          <div className={styles.activeFiltersRow}>
            <span className={styles.activeFiltersLabel}>Active Filters:</span>
            {list.statusFilter && (
              <span className={styles.filterChip}>
                Status: {list.statusFilter}
                <Icon iconName="Cancel" aria-hidden="true" onClick={() => list.setStatusFilter(undefined)} className={styles.chipClose} />
              </span>
            )}
            {list.searchText && (
              <span className={styles.filterChip}>
                Search: {list.searchText}
                <Icon iconName="Cancel" aria-hidden="true" onClick={() => list.setSearchText('')} className={styles.chipClose} />
              </span>
            )}
            <button type="button" className={styles.resetAllButton} onClick={list.resetFilters}>
              Reset All
            </button>
          </div>
        )}

        <div className={styles.summaryRow}>
          <span>
            Showing <strong>{list.filteredCount}</strong> of {list.totalCount} records
          </span>
          {list.isShowingStaleData && (
            <span className={styles.staleNote}>
              <Icon iconName="Warning" aria-hidden="true" /> Showing information that may be out of date.
            </span>
          )}
        </div>
      </div>

      {list.pageItems.length === 0 ? (
        <EmptyState message="No risk records match the current filters.">
          {list.hasActiveFilters && (
            <button type="button" className={styles.secondaryButton} onClick={list.resetFilters}>
              Reset filters
            </button>
          )}
        </EmptyState>
      ) : (
        <div className={styles.cardList}>
          {list.pageItems.map((item) => (
            <RiskListCard key={item.id} item={item} detailUrl={detailPageUrl} />
          ))}
        </div>
      )}

      <div className={styles.paginationBar}>
        <div className={styles.paginationSummary}>
          <span>
            Showing <strong>{list.filteredCount === 0 ? 0 : (list.page - 1) * list.pageSize + 1}</strong> to{' '}
            <strong>{Math.min(list.page * list.pageSize, list.filteredCount)}</strong> of <strong>{list.filteredCount}</strong> Risk Cases
          </span>
          <div className={styles.pageSizeGroup}>
            <label htmlFor="risk-list-page-size">Rows per page:</label>
            <select
              id="risk-list-page-size"
              className={styles.pageSizeSelect}
              value={list.pageSize}
              onChange={(event) => list.setPageSize(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.paginationControls}>
          <button
            type="button"
            className={styles.pageNavButton}
            disabled={list.page <= 1}
            onClick={() => list.setPage(list.page - 1)}
          >
            <Icon iconName="ChevronLeft" aria-hidden="true" />
            Previous
          </button>

          {paginationPages.map((entry, index) =>
            entry === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className={styles.pageEllipsis}>
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className={`${styles.pageNumberButton} ${entry === list.page ? styles.pageNumberActive : ''}`}
                aria-current={entry === list.page ? 'page' : undefined}
                onClick={() => list.setPage(entry)}
              >
                {entry}
              </button>
            )
          )}

          <button
            type="button"
            className={styles.pageNavButton}
            disabled={list.page >= list.pageCount}
            onClick={() => list.setPage(list.page + 1)}
          >
            Next
            <Icon iconName="ChevronRight" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.footerRow}>
        <RefreshStatus state={list.refreshState} showLastRefreshed={showLastRefreshed} isShowingStaleData={list.isShowingStaleData} />
        <RefreshNowButton onRefreshNow={list.refreshNow} isRefreshing={list.refreshState.isBackgroundRefreshing} />
      </div>
    </div>
  );
};

export default RiskRegistryList;
