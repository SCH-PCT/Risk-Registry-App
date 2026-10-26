import * as React from 'react';

import { IRiskRegistryItem } from '../models/domain/IRiskRegistryItem';
import { IRiskRegistryListRepository } from '../data/repositories/IRiskRegistryListRepository';
import { RiskRegistryError } from '../data/repositories/IRiskRegistryRepository';
import { IRefreshConfiguration } from '../state/RefreshCoordinator';
import { getRiskRegistryDataField } from '../config/listSchema';
import { mapPriorityRatingToTier } from '../utilities/riskPriorityTier';
import { asNumber, asText } from '../utilities/riskFieldValue';
import { useAutoRefresh } from './useAutoRefresh';

export type RiskListErrorKind = 'access-denied' | 'invalid-configuration' | 'transient' | 'unknown';

export interface IRiskRegistryListKpis {
  /** Not corrected/unmonitored and not rejected — still moving through the workflow. */
  readonly totalActive: number;
  readonly criticalCount: number;
  /** Items whose `created` falls within the last 24 hours. `undefined` when no item carries a `created` date. */
  readonly createdLast24h: number;
  readonly pendingCqpsReviewCount: number;
  readonly activeCapCount: number;
  readonly resolvedMonthToDateCount: number;
  /** Resolved ÷ total, all-time, as a whole percentage. `undefined` with zero items — there is nothing to rate. */
  readonly closureRatePercent: number | undefined;
}

export interface IUseRiskRegistryListOptions {
  readonly repository: IRiskRegistryListRepository;
  readonly refreshConfiguration: IRefreshConfiguration;
}

export interface IUseRiskRegistryListResult {
  readonly loadState: 'loading' | 'loaded' | 'fatal-error';
  readonly errorKind?: RiskListErrorKind;
  readonly isShowingStaleData: boolean;
  readonly kpis: IRiskRegistryListKpis;
  /** Every fetched item, unfiltered — what the KPI tiles are computed from. */
  readonly totalCount: number;
  /** After search/status filtering, before pagination. */
  readonly filteredCount: number;
  readonly pageItems: readonly IRiskRegistryItem[];
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: number;
  readonly searchText: string;
  /** `undefined` means "All statuses". */
  readonly statusFilter: string | undefined;
  /** Every declared `riskStatus` choice, for the filter dropdown — not only the ones present in the current data. */
  readonly availableStatuses: readonly string[];
  readonly setSearchText: (value: string) => void;
  readonly setStatusFilter: (value: string | undefined) => void;
  readonly setPage: (value: number) => void;
  readonly setPageSize: (value: number) => void;
  readonly hasActiveFilters: boolean;
  readonly resetFilters: () => void;
  readonly refreshNow: () => void;
  readonly refreshState: ReturnType<typeof useAutoRefresh>;
}

function classifyLoadError(error: unknown): RiskListErrorKind {
  if (error instanceof RiskRegistryError) {
    switch (error.kind) {
      case 'access-denied':
        return 'access-denied';
      case 'invalid-configuration':
        return 'invalid-configuration';
      case 'transient':
        return 'transient';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

const DEFAULT_PAGE_SIZE = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function matchesSearch(item: IRiskRegistryItem, searchText: string): boolean {
  const needle = searchText.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  const riskId = asNumber(item.fields.riskId);
  const haystack = [asText(item.fields.title), riskId !== undefined ? String(riskId) : undefined]
    .filter((value): value is string => value !== undefined)
    .map((value) => value.toLowerCase());

  return haystack.some((value) => value.indexOf(needle) !== -1);
}

/**
 * Drives the Risk Registry List web part: fetches every `RiskRegistryData`
 * item once per refresh cycle (via the same `useAutoRefresh` engine and
 * `IRefreshConfiguration` every other Risk Registry web part uses), then
 * derives KPI counts, search/status filtering and pagination from that one
 * in-memory snapshot — see `IRiskRegistryListRepository`'s doc comment for
 * why this is fetch-once-filter-in-memory rather than a server-side query
 * per filter change.
 */
export function useRiskRegistryList(options: IUseRiskRegistryListOptions): IUseRiskRegistryListResult {
  const { repository, refreshConfiguration } = options;

  const [items, setItems] = React.useState<IRiskRegistryItem[]>([]);
  const [fatalErrorKind, setFatalErrorKind] = React.useState<RiskListErrorKind | undefined>(undefined);
  const [isShowingStaleData, setIsShowingStaleData] = React.useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);

  const [searchText, setSearchTextState] = React.useState('');
  const [statusFilter, setStatusFilterState] = React.useState<string | undefined>(undefined);
  const [page, setPageState] = React.useState(1);
  const [pageSize, setPageSizeState] = React.useState(DEFAULT_PAGE_SIZE);

  // See `useRiskRegistryDetail.ts` for why this guard exists: a refresh
  // still in flight when the component unmounts must not call `setState`
  // once it resolves.
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hasLoadedOnceRef = React.useRef(hasLoadedOnce);
  hasLoadedOnceRef.current = hasLoadedOnce;

  const runRefreshCycle = React.useCallback(async (): Promise<void> => {
    let result: IRiskRegistryItem[];
    try {
      result = await repository.getAll();
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const kind = classifyLoadError(error);
      if (!hasLoadedOnceRef.current) {
        setFatalErrorKind(kind);
      } else {
        // A background refresh failed transiently: keep the previous data on
        // screen and flag it as possibly stale, per the no-blank-the-page rule.
        setIsShowingStaleData(true);
      }
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    setFatalErrorKind(undefined);
    setIsShowingStaleData(false);
    setItems(result);
    setHasLoadedOnce(true);
  }, [repository]);

  const refreshState = useAutoRefresh({
    refresh: runRefreshCycle,
    configuration: refreshConfiguration
  });

  const availableStatuses = React.useMemo(() => getRiskRegistryDataField('riskStatus').choices ?? [], []);

  const kpis = React.useMemo<IRiskRegistryListKpis>(() => {
    const now = Date.now();
    let totalActive = 0;
    let criticalCount = 0;
    let createdLast24h = 0;
    let pendingCqpsReviewCount = 0;
    let activeCapCount = 0;
    let resolvedCount = 0;
    let resolvedMonthToDateCount = 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    for (const item of items) {
      const status = item.fields.riskStatus;
      const isResolved = typeof status === 'string' && status.indexOf('Corrected') === 0;
      const isRejected = status === 'Rejected';

      if (!isResolved && !isRejected) {
        totalActive += 1;
      }

      const tier = mapPriorityRatingToTier(asText(item.fields.riskPriorityRating));
      if (tier?.tier === 1) {
        criticalCount += 1;
      }

      if (item.created && now - item.created.getTime() <= MS_PER_DAY) {
        createdLast24h += 1;
      }

      if (status === 'Evaluation') {
        pendingCqpsReviewCount += 1;
      }

      if (status === 'Assigned In-Progress') {
        activeCapCount += 1;
      }

      if (isResolved) {
        resolvedCount += 1;
        if (item.modified && item.modified >= monthStart) {
          resolvedMonthToDateCount += 1;
        }
      }
    }

    return {
      totalActive,
      criticalCount,
      createdLast24h,
      pendingCqpsReviewCount,
      activeCapCount,
      resolvedMonthToDateCount,
      closureRatePercent: items.length > 0 ? Math.round((resolvedCount / items.length) * 100) : undefined
    };
  }, [items]);

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (statusFilter && item.fields.riskStatus !== statusFilter) {
        return false;
      }
      return matchesSearch(item, searchText);
    });
  }, [items, statusFilter, searchText]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  // Clamp `page` after a filter/pageSize change shrinks the result set out
  // from under the currently-viewed page, rather than rendering an empty
  // page with working-looking "Previous"/numbered controls.
  React.useEffect(() => {
    if (page > pageCount) {
      setPageState(pageCount);
    }
  }, [page, pageCount]);

  const pageItems = React.useMemo(() => {
    const clampedPage = Math.min(page, pageCount);
    const start = (clampedPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageCount, pageSize]);

  const setSearchText = React.useCallback((value: string) => {
    setSearchTextState(value);
    setPageState(1);
  }, []);

  const setStatusFilter = React.useCallback((value: string | undefined) => {
    setStatusFilterState(value);
    setPageState(1);
  }, []);

  const setPageSize = React.useCallback((value: number) => {
    setPageSizeState(value);
    setPageState(1);
  }, []);

  const resetFilters = React.useCallback(() => {
    setSearchTextState('');
    setStatusFilterState(undefined);
    setPageState(1);
  }, []);

  return {
    loadState: fatalErrorKind ? 'fatal-error' : hasLoadedOnce ? 'loaded' : 'loading',
    errorKind: fatalErrorKind,
    isShowingStaleData,
    kpis,
    totalCount: items.length,
    filteredCount: filteredItems.length,
    pageItems,
    page: Math.min(page, pageCount),
    pageCount,
    pageSize,
    searchText,
    statusFilter,
    availableStatuses,
    setSearchText,
    setStatusFilter,
    setPage: setPageState,
    setPageSize,
    hasActiveFilters: searchText.trim().length > 0 || statusFilter !== undefined,
    resetFilters,
    refreshNow: refreshState.refreshNow,
    refreshState
  };
}
