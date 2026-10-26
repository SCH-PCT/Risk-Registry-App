/**
 * Shared refresh types and the page-scoped coordinator every Risk Registry
 * business web part uses.
 *
 * Two separate jobs live here, deliberately kept in one small file because
 * they are two views of the same problem (don't do redundant work on a
 * shared page):
 *
 *  1. **In-flight request deduplication.** If two Risk Registry components on
 *     the same page both ask for the same key (e.g. the same risk item) in
 *     the same tick, the second caller gets the first caller's in-flight
 *     promise rather than issuing a duplicate request.
 *  2. **Manual cross-component refresh signal.** A successful save in one
 *     component can tell others "topic X changed" without a global browser
 *     variable or a third-party event bus — just a typed subscribe/notify
 *     keyed by topic string, scoped to one `RefreshCoordinator` instance.
 *
 * This is a coalescing layer, not a store: nothing here retains fetched data
 * after the in-flight promise settles, and no business-data payload is ever
 * logged. Each web part still works correctly as the only Risk Registry
 * component on the page — the coordinator degrades to a no-op dedupe/no-op
 * notify in that case, never a required dependency.
 */

/** Property-pane-controlled refresh configuration for one web part instance. */
export interface IRefreshConfiguration {
  readonly enabled: boolean;
  readonly intervalSeconds: number;
}

/** Everything `useAutoRefresh` exposes to a consuming component. */
export interface IRefreshState {
  readonly isInitialLoading: boolean;
  readonly isBackgroundRefreshing: boolean;
  readonly lastRefreshStarted?: Date;
  readonly lastRefreshCompleted?: Date;
  readonly nextRefreshAt?: Date;
  readonly consecutiveFailures: number;
  readonly isPaused: boolean;
  readonly pauseReason?: 'hidden-tab' | 'offline' | 'disabled' | 'repeated-failures' | 'manual';
}

type Unsubscribe = () => void;

/**
 * Page-scoped coordinator. One instance is created per page (typically via a
 * module-level singleton handed out through SPFx Dynamic Data or a shared
 * service factory) and passed to every Risk Registry web part that wants to
 * participate; a component that never receives one simply doesn't dedupe or
 * notify, and continues to work alone.
 */
export class RefreshCoordinator {
  private readonly _inFlight = new Map<string, Promise<unknown>>();
  private readonly _subscribers = new Map<string, Set<() => void>>();

  /**
   * Runs `operation` under `key`, or returns the already-in-flight promise
   * for that key if one exists.
   *
   * The promise is removed from the map as soon as it settles (success or
   * failure) — this is in-flight deduplication only, never a cache of a
   * completed result.
   */
  public async dedupe<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this._inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = operation().finally(() => {
      this._inFlight.delete(key);
    });

    this._inFlight.set(key, promise);
    return promise;
  }

  /** Subscribes to a manual refresh signal for `topic`. Returns an unsubscribe function. */
  public subscribe(topic: string, handler: () => void): Unsubscribe {
    let handlers = this._subscribers.get(topic);
    if (!handlers) {
      handlers = new Set();
      this._subscribers.set(topic, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
      if (handlers && handlers.size === 0) {
        this._subscribers.delete(topic);
      }
    };
  }

  /** Notifies every subscriber of `topic` that it should refresh. Safe to call with no subscribers. */
  public notify(topic: string): void {
    const handlers = this._subscribers.get(topic);
    if (!handlers) {
      return;
    }
    // Snapshot before iterating: a handler may unsubscribe itself, which
    // would otherwise mutate the Set mid-iteration.
    for (const handler of Array.from(handlers)) {
      handler();
    }
  }

  /** For tests and disposal: drops every in-flight entry and subscriber without resolving/rejecting them. */
  public dispose(): void {
    this._inFlight.clear();
    this._subscribers.clear();
  }
}
