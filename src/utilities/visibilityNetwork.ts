/**
 * Thin, testable wrapper over the Page Visibility API and the browser's
 * online/offline events.
 *
 * `useAutoRefresh` depends on this rather than touching `document`/`window`
 * directly, so tests can simulate a hidden tab or a dropped connection
 * without a real browser environment driving it.
 */

export interface IVisibilityNetworkCallbacks {
  readonly onHidden?: () => void;
  readonly onVisible?: () => void;
  readonly onOffline?: () => void;
  readonly onOnline?: () => void;
}

export interface IVisibilityNetworkSource {
  readonly isDocumentHidden: () => boolean;
  readonly isOnline: () => boolean;
  readonly subscribe: (callbacks: IVisibilityNetworkCallbacks) => () => void;
}

/** Real browser implementation. Safe to construct outside a browser; methods no-op without `window`. */
export function createBrowserVisibilityNetworkSource(): IVisibilityNetworkSource {
  return {
    isDocumentHidden: () =>
      typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
    isOnline: () => (typeof navigator !== 'undefined' ? navigator.onLine !== false : true),
    subscribe: (callbacks: IVisibilityNetworkCallbacks) => {
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        return () => {
          // Nothing was attached.
        };
      }

      const handleVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') {
          callbacks.onHidden?.();
        } else {
          callbacks.onVisible?.();
        }
      };

      const handleOffline = (): void => callbacks.onOffline?.();
      const handleOnline = (): void => callbacks.onOnline?.();

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      };
    }
  };
}
