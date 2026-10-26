import { INavigationItem, ISiteBranding } from '../../../models/domain/INavigationItem';

/**
 * Everything the navigation bar renders from.
 *
 * The component makes no SharePoint calls and holds no repository or service reference:
 * it receives resolved data and renders it. That keeps it testable with plain objects,
 * and keeps the security decision about `url` upstream in the mapper where it belongs —
 * by the time a URL reaches these props it has already passed the scheme check.
 */
export interface ITopNavigationProps {
  /** Site title and logo from SPFx page context. */
  readonly branding: ISiteBranding;

  /** Top-level items, already ordered and validated. */
  readonly items: readonly INavigationItem[];

  /**
   * ID of the item matching the current page, or undefined when none does.
   *
   * Undefined is a normal state — a user can be on a page the navigation does not list —
   * and renders with nothing highlighted rather than a fallback selection.
   */
  readonly activeItemId?: number;

  /**
   * Site absolute URL, used to resolve relative hrefs for display.
   *
   * Passed rather than read from context so the component stays free of SPFx.
   */
  readonly siteAbsoluteUrl: string;

  /** True while the first load is in flight. */
  readonly isLoading?: boolean;

  /**
   * Message shown when navigation could not be loaded.
   *
   * Rendered quietly and only when there are no items to show: a failed navigation
   * refresh must not put an error banner across the top of every page.
   */
  readonly errorMessage?: string;
}
