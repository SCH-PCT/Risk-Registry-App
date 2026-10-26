/**
 * Navigation configuration cache and refresh policy.
 *
 * NAVIGATION REFRESH POLICY — this service is where it is implemented:
 *
 *  1. Configuration is loaded once during customizer initialisation.
 *  2. It is cached in memory, briefly.
 *  3. The active item is re-evaluated on every SharePoint page navigation. That is a
 *     pure comparison against the new URL and needs no network call, which is why
 *     `getActiveItemId` is separate from `getNavigation`.
 *  4. Configuration is refetched only when the cache has expired *and* a page
 *     navigation occurs.
 *
 * The navigation deliberately does **not** use the business-data auto-refresh
 * framework planned for the List/Detail web parts (see IMPLEMENTATION-PLAN.md Phase 5).
 * That framework polls on a timer because risk data changes while a user watches it.
 * Navigation configuration changes when an administrator edits a list, perhaps
 * monthly. Polling it would put a request on every open tab in the site, forever, to
 * observe nothing. This matches the brief's explicit requirement that the navigation
 * customizer must not poll business-data lists.
 *
 * The cache is memory-only. `appTopNavigation` is assumed to carry only low-volatility
 * navigation configuration (unverified — see `config/listSchema.ts`), so it is the one
 * list eligible for caching at all, but the blanket ban on
 * `localStorage`/`sessionStorage` still applies.
 */

import {
  INavigationConfiguration,
  INavigationItem,
  ISiteBranding
} from '../../models/domain/INavigationItem';
import { INavigationRepository } from '../repositories/INavigationRepository';
import { isSameBasePage } from '../../utilities/urlNormalization';

/**
 * How long a cached configuration is served before a page navigation will refetch it.
 *
 * Five minutes trades staleness against request volume: an administrator who edits the
 * navigation sees the change within one navigation after five minutes, without every
 * page view in the site issuing a request. Nothing refetches on a timer, so an idle tab
 * makes no requests at all regardless of this value.
 */
export const NAVIGATION_CACHE_TTL_MS = 5 * 60 * 1000;

/** Injectable clock, so cache-expiry tests need no timer manipulation. */
export type Clock = () => number;

export interface INavigationServiceOptions {
  readonly cacheTtlMs?: number;
  readonly now?: Clock;
}

/** What the customizer needs to render, resolved together. */
export interface INavigationState {
  readonly configuration: INavigationConfiguration;
  /** ID of the item matching the current page, or undefined when none matches. */
  readonly activeItemId?: number;
}

export class NavigationService {
  private readonly _repository: INavigationRepository;
  private readonly _cacheTtlMs: number;
  private readonly _now: Clock;

  private _cached?: INavigationConfiguration;
  private _cachedAt: number = 0;

  /**
   * The in-flight request, if any.
   *
   * Two navigations in quick succession after expiry would otherwise issue two
   * identical requests. Sharing the promise makes concurrent callers collapse onto one,
   * which matters because this code runs in the top placeholder of every page.
   */
  private _inFlight?: Promise<INavigationConfiguration>;

  private _isDisposed: boolean = false;

  public constructor(repository: INavigationRepository, options: INavigationServiceOptions = {}) {
    this._repository = repository;
    this._cacheTtlMs = options.cacheTtlMs ?? NAVIGATION_CACHE_TTL_MS;
    this._now = options.now ?? (() => Date.now());
  }

  /** True when nothing is cached, or the cached copy has aged out. */
  public get isExpired(): boolean {
    return this._cached === undefined || this._now() - this._cachedAt >= this._cacheTtlMs;
  }

  /** The cached configuration, without triggering a fetch. */
  public get cached(): INavigationConfiguration | undefined {
    return this._cached;
  }

  /**
   * Returns the configuration, fetching only if the cache is empty or expired.
   *
   * This is policy steps 1 and 2, and the fetch half of step 4.
   */
  public async getNavigation(): Promise<INavigationConfiguration> {
    if (!this.isExpired && this._cached) {
      return this._cached;
    }

    return this._fetch();
  }

  /**
   * Discards the cache and refetches unconditionally.
   *
   * The deterministic refresh path required alongside the cache: an administrator who
   * has just edited the list needs a way to see the change that does not depend on
   * guessing when a TTL elapsed.
   */
  public async refresh(): Promise<INavigationConfiguration> {
    this._cached = undefined;
    this._cachedAt = 0;
    // Drop any in-flight request too, so a refresh issued during a stale fetch is not
    // answered with the result that fetch was already committed to returning.
    this._inFlight = undefined;

    return this._fetch();
  }

  /**
   * Serves a page-navigation event.
   *
   * Policy steps 3 and 4 together: the active item is always re-evaluated against the
   * new URL, and the configuration is refetched only if the cache has expired. When it
   * has not, this makes no network request at all.
   *
   * A failed refetch returns the previous configuration rather than propagating: losing
   * the navigation bar because one refresh failed is a worse outcome than briefly
   * showing configuration that is a few minutes stale.
   */
  public async handlePageNavigation(currentUrl: string, siteAbsoluteUrl: string): Promise<INavigationState> {
    let configuration = this._cached;

    if (this.isExpired) {
      try {
        configuration = await this.getNavigation();
      } catch (error) {
        if (!configuration) {
          throw error; // Nothing cached to fall back to; the caller must handle it.
        }
      }
    }

    const resolved = configuration ?? { items: [], diagnostics: [] };

    return {
      configuration: resolved,
      activeItemId: findActiveItemId(resolved.items, currentUrl, siteAbsoluteUrl)
    };
  }

  /**
   * Releases the cache and blocks late responses from repopulating it.
   *
   * Called from `onDispose`. Without the flag, a fetch that resolves after disposal
   * would write to a service the customizer has already let go of.
   */
  public dispose(): void {
    this._isDisposed = true;
    this._cached = undefined;
    this._inFlight = undefined;
  }

  private async _fetch(): Promise<INavigationConfiguration> {
    if (this._inFlight) {
      return this._inFlight;
    }

    // `then`/`catch` rather than `finally`: the SPFx build targets an ES level whose
    // lib does not declare Promise.prototype.finally, and both paths must clear the
    // in-flight slot or a failed fetch would wedge the service on a rejected promise.
    const request = this._repository.getNavigation().then(
      (configuration) => {
        this._inFlight = undefined;

        if (!this._isDisposed) {
          this._cached = configuration;
          this._cachedAt = this._now();
        }

        return configuration;
      },
      (error) => {
        this._inFlight = undefined;
        throw error;
      }
    );

    this._inFlight = request;

    return request;
  }
}

/**
 * Finds the navigation item matching the current page.
 *
 * Children are searched before parents, and the parent of a matching child is not
 * itself returned: the active item is the specific page, and the component decides
 * separately whether to mark the ancestor as containing it.
 *
 * Returns `undefined` when the user is on a page no link points at — a normal state,
 * not an error. Nothing is highlighted, rather than the first item being highlighted
 * arbitrarily.
 */
export function findActiveItemId(
  items: readonly INavigationItem[],
  currentUrl: string,
  siteAbsoluteUrl: string
): number | undefined {
  for (const item of items) {
    for (const child of item.children) {
      if (isSameBasePage(child.url, currentUrl, siteAbsoluteUrl)) {
        return child.id;
      }
    }

    if (isSameBasePage(item.url, currentUrl, siteAbsoluteUrl)) {
      return item.id;
    }
  }

  return undefined;
}

/**
 * Builds branding from SPFx page context.
 *
 * The logo URL comes from `pageContext.web.logoUrl` and is never stored in the
 * navigation list: duplicating it there would create a second source of truth that
 * silently goes stale when a site owner changes the logo in site settings.
 *
 * An absent logo is normalised to `undefined` here — not at render time — so that
 * exactly one place decides what "no logo" means. SharePoint returns an empty string
 * for a site without one, and an empty string reaching an `<img src>` is precisely what
 * renders a broken-image icon.
 */
export function buildSiteBranding(web: {
  title: string;
  absoluteUrl: string;
  logoUrl?: string;
}): ISiteBranding {
  const logoUrl = typeof web.logoUrl === 'string' ? web.logoUrl.trim() : '';

  return {
    title: web.title,
    logoUrl: logoUrl.length > 0 ? logoUrl : undefined,
    homeUrl: web.absoluteUrl
  };
}
