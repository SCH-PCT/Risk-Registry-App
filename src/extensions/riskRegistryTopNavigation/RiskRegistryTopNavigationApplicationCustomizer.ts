import { Log } from '@microsoft/sp-core-library';
import {
  BaseApplicationCustomizer,
  PlaceholderContent,
  PlaceholderName
} from '@microsoft/sp-application-base';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { NavigationError } from '../../data/repositories/INavigationRepository';
import { PnpNavigationRepository } from '../../data/repositories/pnp/PnpNavigationRepository';
import { buildSiteBranding, NavigationService } from '../../data/services/navigationService';
import { INavigationConfiguration, ISiteBranding } from '../../models/domain/INavigationItem';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { ITopNavigationProps } from './components/ITopNavigationProps';
import { TopNavigation } from './components/TopNavigation';

const LOG_SOURCE: string = 'RiskRegistryTopNavigationApplicationCustomizer';

/**
 * Renders the Risk Registry top navigation into the SPFx Top placeholder.
 *
 * ## Scope of what this component touches
 *
 * It renders into the `Top` placeholder only. Unlike the reference implementation
 * this was ported from, it does **not** hide or show SharePoint's own page header and
 * command bar — that feature relied on undocumented DOM selectors against SharePoint's
 * internals and was specific to that project's requirements, not this one's. The
 * suite bar, page header and command bar are left exactly as SharePoint renders them.
 *
 * ## Lifecycle
 *
 * `onInit` loads the configuration once and renders. `navigatedEvent` — the supported
 * SPFx notification for SharePoint's client-side page transitions — re-evaluates which
 * item is current. `onDispose` removes the handler, unmounts React and disposes the
 * placeholder.
 *
 * The `navigatedEvent` subscription is what makes the bar correct after a soft
 * navigation. Without it the placeholder survives the transition with a stale
 * highlight, because no full page load occurs to re-run initialisation.
 */
export default class RiskRegistryTopNavigationApplicationCustomizer extends BaseApplicationCustomizer<
  Record<string, never>
> {
  private _topPlaceholder?: PlaceholderContent;
  private _service?: NavigationService;
  private _branding?: ISiteBranding;

  private _configuration: INavigationConfiguration = { items: [], diagnostics: [] };
  private _activeItemId?: number;
  private _isLoading: boolean = true;
  private _errorMessage?: string;

  /**
   * Set in `onDispose`. Async work started before disposal can still resolve
   * afterwards, and rendering into a detached placeholder at that point would leak a
   * React tree that nothing will ever unmount.
   */
  private _isTornDown: boolean = false;

  /** Guards against logging the same list misconfiguration on every page transition. */
  private _haveLoggedDiagnostics: boolean = false;

  public async onInit(): Promise<void> {
    Log.info(LOG_SOURCE, 'Initialising Risk Registry top navigation.');

    // Bound once and stored, because SPEvent.remove matches on identity: subscribing
    // with an inline arrow function would make the handler impossible to remove and
    // leak a subscription per page.
    this.context.application.navigatedEvent.add(this, this._onNavigated);

    this._branding = buildSiteBranding(this.context.pageContext.web);
    this._service = new NavigationService(new PnpNavigationRepository(this.context));

    // Policy step 1: load the configuration during initialisation.
    await this._loadNavigation();

    // Not awaited by onInit's contract, but the placeholder may not exist yet on first
    // init — `_onNavigated` runs immediately after and creates it.
    this._render();

    return Promise.resolve();
  }

  /**
   * Handles a SharePoint client-side page transition.
   *
   * Policy steps 3 and 4. The active item is always recomputed against the new URL —
   * a pure comparison, no network — and the configuration is refetched only if its
   * cache has expired. Navigating around the site therefore costs nothing until the
   * TTL lapses.
   */
  private _onNavigated = (): void => {
    if (this._isTornDown) {
      return;
    }

    // `navigatedEvent` handlers are synchronous, so the promise is deliberately not
    // awaited. `_refreshActiveItem` handles its own failures; the catch here is a
    // backstop so a bug in it can never surface as an unhandled rejection.
    this._refreshActiveItem().catch((error: unknown) => {
      Log.warn(LOG_SOURCE, `Navigation update failed after page navigation: ${String(error)}`);
    });
  };

  private async _refreshActiveItem(): Promise<void> {
    if (!this._service || this._isTornDown) {
      return;
    }

    try {
      const state = await this._service.handlePageNavigation(
        window.location.href,
        this.context.pageContext.web.absoluteUrl
      );

      if (this._isTornDown) {
        return;
      }

      this._configuration = state.configuration;
      this._activeItemId = state.activeItemId;
      this._errorMessage = undefined;
    } catch (error) {
      // The previous configuration is kept on screen. A navigation bar that disappears
      // because one refresh failed is worse than one showing slightly stale links.
      this._handleError(error);
    }

    this._render();
  }

  private async _loadNavigation(): Promise<void> {
    if (!this._service) {
      return;
    }

    try {
      this._configuration = await this._service.getNavigation();

      this._activeItemId = (
        await this._service.handlePageNavigation(
          window.location.href,
          this.context.pageContext.web.absoluteUrl
        )
      ).activeItemId;

      this._errorMessage = undefined;
      this._logDiagnostics();
    } catch (error) {
      this._handleError(error);
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Records a failure and decides what, if anything, the user is told.
   *
   * Configuration faults are worth surfacing — somebody has to create or fix the list.
   * Transient faults are not: the user cannot act on them, and an error strip across
   * the top of every page is worse than a navigation bar that is briefly absent.
   */
  private _handleError(error: unknown): void {
    const navigationError = error instanceof NavigationError ? error : undefined;

    Log.warn(
      LOG_SOURCE,
      `Navigation load failed (${navigationError?.kind ?? 'unknown'}): ` +
        `${error instanceof Error ? error.message : String(error)}`
    );

    if (navigationError && !navigationError.isRetryable) {
      this._errorMessage = navigationError.message;
    } else {
      this._errorMessage = undefined;
    }
  }

  /**
   * Reports dropped rows once per page load.
   *
   * These name only list configuration — a title and a reason — and never row data, so
   * nothing user-entered beyond a link label reaches the log.
   */
  private _logDiagnostics(): void {
    if (this._haveLoggedDiagnostics || this._configuration.diagnostics.length === 0) {
      return;
    }

    this._haveLoggedDiagnostics = true;

    for (const diagnostic of this._configuration.diagnostics) {
      Log.warn(
        LOG_SOURCE,
        `Navigation item ${diagnostic.itemId} was not rendered (${diagnostic.reason}): ${diagnostic.detail}`
      );
    }
  }

  /**
   * Creates the Top placeholder on first use and renders into it.
   *
   * `tryCreateContent` returns undefined when the page does not offer a Top placeholder
   * — some page types do not. That is a supported outcome, not a failure: the extension
   * simply renders nothing and leaves the page as SharePoint built it.
   */
  private _render(): void {
    if (this._isTornDown || !this._branding) {
      return;
    }

    if (!this._topPlaceholder) {
      this._topPlaceholder = this.context.placeholderProvider.tryCreateContent(
        PlaceholderName.Top,
        { onDispose: this._onPlaceholderDisposed }
      );

      if (!this._topPlaceholder) {
        Log.info(LOG_SOURCE, 'This page has no Top placeholder; navigation was not rendered.');
        return;
      }
    }

    if (!this._topPlaceholder.domElement) {
      return;
    }

    const props: ITopNavigationProps = {
      branding: this._branding,
      items: this._configuration.items,
      activeItemId: this._activeItemId,
      siteAbsoluteUrl: this.context.pageContext.web.absoluteUrl,
      isLoading: this._isLoading,
      errorMessage: this._errorMessage
    };

    // Wrapped in a boundary because this component renders in the Top placeholder of
    // **every page in the site**. An uncaught render error here would otherwise unmount
    // the navigation site-wide; with the boundary it degrades to a message in the strip.
    ReactDOM.render(
      React.createElement(
        ErrorBoundary,
        { componentName: 'site navigation' },
        React.createElement(TopNavigation, props)
      ),
      this._topPlaceholder.domElement
    );
  }

  /**
   * Called when SharePoint disposes the placeholder independently of this component,
   * which happens on some page transitions.
   *
   * The reference is dropped so the next render creates a fresh placeholder rather than
   * writing into a detached element and rendering nothing visible.
   */
  private _onPlaceholderDisposed = (): void => {
    this._topPlaceholder = undefined;
  };

  /**
   * Releases everything acquired in `onInit`.
   *
   * The unsubscribe prevents the handler firing against a disposed component; the
   * unmount runs React's own cleanup, including the component's ResizeObserver
   * disconnect, which would otherwise keep observing a detached node; and disposing
   * the service drops the cache and blocks a late response from writing into it.
   */
  public onDispose(): void {
    this._isTornDown = true;

    this.context.application.navigatedEvent.remove(this, this._onNavigated);

    if (this._topPlaceholder?.domElement) {
      ReactDOM.unmountComponentAtNode(this._topPlaceholder.domElement);
    }

    this._topPlaceholder?.dispose();
    this._topPlaceholder = undefined;

    this._service?.dispose();
    this._service = undefined;

    Log.info(LOG_SOURCE, 'Risk Registry top navigation disposed.');

    super.onDispose();
  }
}
