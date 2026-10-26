import * as React from 'react';

import { IRefreshConfiguration, IRefreshState } from '../state/RefreshCoordinator';
import { computeBackoffDelayMs } from '../utilities/retry';
import { applyJitter } from '../utilities/refreshInterval';
import {
  createBrowserVisibilityNetworkSource,
  IVisibilityNetworkSource
} from '../utilities/visibilityNetwork';

/**
 * Shared auto-refresh engine for every Risk Registry business web part.
 *
 * Individual components never call `setInterval`/`setTimeout` themselves —
 * everything here is one implementation, used by every web part, so the
 * overlap/jitter/backoff/visibility rules are defined and tested once.
 *
 * ## Scheduling model
 *
 * Recursive `setTimeout`, never `setInterval`: the next refresh is scheduled
 * only after the current one **completes**, so overlapping refreshes are
 * impossible by construction rather than by a guard flag. A `refreshNow()`
 * call while a refresh is in flight does not start a second one — it sets a
 * "coalesced" flag that triggers exactly one more refresh immediately after
 * the current one finishes.
 *
 * ## Failure handling
 *
 * A failed refresh does not advance `lastRefreshCompleted` and schedules its
 * retry with bounded exponential backoff instead of the configured interval.
 * After `maxConsecutiveFailuresBeforePause` failures in a row (default 5),
 * automatic refresh pauses entirely (`pauseReason: 'repeated-failures'`) and
 * only a manual `refreshNow()` can resume it — this is what keeps a
 * throttled or down backend from being hammered forever.
 */

export type RefreshReason = 'initial' | 'interval' | 'manual' | 'visibility' | 'online';

export interface IUseAutoRefreshOptions {
  /** Performs one refresh cycle. Rejecting marks the cycle failed. */
  readonly refresh: (reason: RefreshReason) => Promise<void>;
  readonly configuration: IRefreshConfiguration;
  readonly visibilityNetworkSource?: IVisibilityNetworkSource;
  /** Injectable clock, for deterministic tests. */
  readonly now?: () => number;
  /** Consecutive failures before automatic refresh pauses. Default 5. */
  readonly maxConsecutiveFailuresBeforePause?: number;
}

export interface IUseAutoRefreshResult extends IRefreshState {
  /** Triggers an immediate refresh. Coalesced if one is already in flight. */
  readonly refreshNow: () => void;
  /** Stops automatic refresh until `resume()`. Does not affect `refreshNow()`. */
  readonly pause: () => void;
  readonly resume: () => void;
}

const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;

interface IInternalState {
  readonly isInitialLoading: boolean;
  readonly isBackgroundRefreshing: boolean;
  readonly lastRefreshStarted?: Date;
  readonly lastRefreshCompleted?: Date;
  readonly nextRefreshAt?: Date;
  readonly consecutiveFailures: number;
  readonly isPaused: boolean;
  readonly pauseReason?: IRefreshState['pauseReason'];
  readonly hasLoadedOnce: boolean;
}

const INITIAL_STATE: IInternalState = {
  isInitialLoading: true,
  isBackgroundRefreshing: false,
  consecutiveFailures: 0,
  isPaused: false,
  hasLoadedOnce: false
};

export function useAutoRefresh(options: IUseAutoRefreshOptions): IUseAutoRefreshResult {
  const {
    refresh,
    configuration,
    maxConsecutiveFailuresBeforePause = DEFAULT_MAX_CONSECUTIVE_FAILURES
  } = options;

  // Constructed once per component instance, not per render: as default
  // parameter values these would otherwise be recreated on every render,
  // handing `runCycle` a new identity each time for no reason (its recursive
  // timer chain is ref-driven internally, so this did not break behaviour —
  // it only meant every render discarded and recreated
  // `runCycle`/`refreshNow`/`pause`/`resume` with nothing to show for it).
  const visibilityNetworkSourceRef = React.useRef(options.visibilityNetworkSource ?? createBrowserVisibilityNetworkSource());
  const visibilityNetworkSource = visibilityNetworkSourceRef.current;

  const nowRef = React.useRef(options.now ?? (() => Date.now()));
  const now = nowRef.current;

  const [state, setState] = React.useState<IInternalState>(INITIAL_STATE);

  // Mutable refs for everything a timer callback needs, so the callback
  // always sees the latest value without the effect that schedules it having
  // to depend on (and therefore recreate the timer on every change of) it.
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;

  const configurationRef = React.useRef(configuration);
  configurationRef.current = configuration;

  const isDisposedRef = React.useRef(false);
  const timerHandleRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isRefreshInFlightRef = React.useRef(false);
  const isCoalescedPendingRef = React.useRef(false);
  const manualPauseRef = React.useRef(false);
  const sequenceRef = React.useRef(0);
  const consecutiveFailuresRef = React.useRef(0);

  const clearScheduledTimer = React.useCallback(() => {
    if (timerHandleRef.current !== undefined) {
      clearTimeout(timerHandleRef.current);
      timerHandleRef.current = undefined;
    }
  }, []);

  const safeSetState = React.useCallback((updater: (previous: IInternalState) => IInternalState) => {
    if (isDisposedRef.current) {
      return;
    }
    setState(updater);
  }, []);

  const runCycle = React.useCallback(
    (reason: RefreshReason): void => {
      if (isDisposedRef.current) {
        return;
      }

      if (isRefreshInFlightRef.current) {
        isCoalescedPendingRef.current = true;
        return;
      }

      isRefreshInFlightRef.current = true;
      const mySequence = ++sequenceRef.current;
      const startedAt = new Date(now());

      safeSetState((previous) => ({
        ...previous,
        isInitialLoading: !previous.hasLoadedOnce,
        isBackgroundRefreshing: previous.hasLoadedOnce,
        lastRefreshStarted: startedAt
      }));

      refreshRef.current(reason).then(
        () => {
          isRefreshInFlightRef.current = false;
          if (isDisposedRef.current || mySequence !== sequenceRef.current) {
            scheduleIfCoalesced();
            return;
          }

          consecutiveFailuresRef.current = 0;
          const completedAt = new Date(now());

          safeSetState((previous) => ({
            ...previous,
            isInitialLoading: false,
            isBackgroundRefreshing: false,
            hasLoadedOnce: true,
            lastRefreshCompleted: completedAt,
            consecutiveFailures: 0
          }));

          scheduleNext('success');
        },
        () => {
          isRefreshInFlightRef.current = false;
          if (isDisposedRef.current || mySequence !== sequenceRef.current) {
            scheduleIfCoalesced();
            return;
          }

          consecutiveFailuresRef.current += 1;

          safeSetState((previous) => ({
            ...previous,
            isInitialLoading: false,
            isBackgroundRefreshing: false,
            hasLoadedOnce: previous.hasLoadedOnce,
            consecutiveFailures: consecutiveFailuresRef.current
          }));

          scheduleNext('failure');
        }
      );

      function scheduleIfCoalesced(): void {
        if (isCoalescedPendingRef.current) {
          isCoalescedPendingRef.current = false;
          runCycle('manual');
        }
      }

      function scheduleNext(outcome: 'success' | 'failure'): void {
        if (isCoalescedPendingRef.current) {
          isCoalescedPendingRef.current = false;
          runCycle('manual');
          return;
        }

        if (consecutiveFailuresRef.current >= maxConsecutiveFailuresBeforePause) {
          safeSetState((previous) => ({
            ...previous,
            isPaused: true,
            pauseReason: 'repeated-failures',
            nextRefreshAt: undefined
          }));
          return;
        }

        if (!configurationRef.current.enabled || manualPauseRef.current) {
          return;
        }

        if (visibilityNetworkSource.isDocumentHidden()) {
          safeSetState((previous) => ({
            ...previous,
            isPaused: true,
            pauseReason: 'hidden-tab',
            nextRefreshAt: undefined
          }));
          return;
        }

        if (!visibilityNetworkSource.isOnline()) {
          safeSetState((previous) => ({
            ...previous,
            isPaused: true,
            pauseReason: 'offline',
            nextRefreshAt: undefined
          }));
          return;
        }

        const intervalMs = configurationRef.current.intervalSeconds * 1000;
        const delayMs =
          outcome === 'failure'
            ? computeBackoffDelayMs(consecutiveFailuresRef.current, { baseDelayMs: 1000, maxDelayMs: 30000 })
            : applyJitter(intervalMs);

        const nextRefreshAt = new Date(now() + delayMs);

        safeSetState((previous) => ({
          ...previous,
          isPaused: false,
          pauseReason: undefined,
          nextRefreshAt
        }));

        clearScheduledTimer();
        timerHandleRef.current = setTimeout(() => {
          timerHandleRef.current = undefined;
          runCycle('interval');
        }, delayMs);
      }
    },
    [clearScheduledTimer, maxConsecutiveFailuresBeforePause, now, safeSetState, visibilityNetworkSource]
  );

  const refreshNow = React.useCallback(() => {
    clearScheduledTimer();
    runCycle('manual');
  }, [clearScheduledTimer, runCycle]);

  const pause = React.useCallback(() => {
    manualPauseRef.current = true;
    clearScheduledTimer();
    safeSetState((previous) => ({
      ...previous,
      isPaused: true,
      pauseReason: 'manual',
      nextRefreshAt: undefined
    }));
  }, [clearScheduledTimer, safeSetState]);

  const resume = React.useCallback(() => {
    manualPauseRef.current = false;
    safeSetState((previous) => ({ ...previous, isPaused: false, pauseReason: undefined }));
    if (configurationRef.current.enabled) {
      runCycle('manual');
    }
  }, [runCycle, safeSetState]);

  // Mount: initial load, visibility/online subscriptions, and final cleanup.
  // Deliberately an empty dependency array — this must run exactly once per
  // component instance. `configuration.enabled`/`intervalSeconds` changes are
  // read live via `configurationRef` inside `runCycle`, not re-triggered here,
  // which is what prevents a duplicate timer on every re-render.
  React.useEffect(() => {
    isDisposedRef.current = false;
    runCycle('initial');

    const unsubscribe = visibilityNetworkSource.subscribe({
      onHidden: () => {
        clearScheduledTimer();
        safeSetState((previous) => ({ ...previous, isPaused: true, pauseReason: 'hidden-tab', nextRefreshAt: undefined }));
      },
      onVisible: () => {
        if (!configurationRef.current.enabled || manualPauseRef.current) {
          return;
        }
        // Stale data may have accumulated while hidden; refresh immediately
        // rather than waiting out whatever was left of the old interval.
        runCycle('visibility');
      },
      onOffline: () => {
        clearScheduledTimer();
        safeSetState((previous) => ({ ...previous, isPaused: true, pauseReason: 'offline', nextRefreshAt: undefined }));
      },
      onOnline: () => {
        if (!configurationRef.current.enabled || manualPauseRef.current) {
          return;
        }
        runCycle('online');
      }
    });

    return () => {
      isDisposedRef.current = true;
      clearScheduledTimer();
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    refreshNow,
    pause,
    resume
  };
}
