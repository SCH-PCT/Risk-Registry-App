/**
 * Application-facing navigation model.
 *
 * Everything on a domain item has already been validated: `url` has passed the scheme
 * check, `title` is non-empty, and `sortOrder` is a real number. The React component
 * therefore renders without re-deciding anything about safety, which is what keeps the
 * security check in exactly one place.
 */

/** Maximum rendered depth. The top bar shows top-level items with one submenu level. */
export const MAX_NAVIGATION_DEPTH = 2;

/** A navigation link that survived validation. */
export interface INavigationItem {
  /** List item ID. Stable React key — `title` is not assumed unique on this list. */
  readonly id: number;

  /** Display text. Guaranteed non-empty and trimmed. */
  readonly title: string;

  /**
   * Link target, exactly as authored, after passing `isSafeNavigationUrl`.
   *
   * The authored form is preserved rather than the normalised one: normalisation
   * lowercases and decodes for *comparison*, and putting that in an `href` would send
   * users to a mangled URL. Matching uses `normalizeUrl` at compare time instead.
   */
  readonly url: string;

  /** Resolved display order. Rows with no `SortOrder` sort after those that have one. */
  readonly sortOrder: number;

  /** True when the link leaves the SharePoint site's origin. */
  readonly isExternal: boolean;

  /** Second-level items. Capped at {@link MAX_NAVIGATION_DEPTH}; never deeper. */
  readonly children: readonly INavigationItem[];
}

/**
 * Why a row was dropped. Surfaced as diagnostics for the site owner, never as an error
 * to the end user — a bad navigation row must not take the page down.
 */
export type NavigationDiagnosticReason =
  /** `Title` was absent, empty or whitespace. The row can be neither labelled nor a parent. */
  | 'missing-title'
  /** `URL` was absent or empty. */
  | 'missing-url'
  /** `URL` resolved to a scheme outside http/https. Rejected before reaching an href. */
  | 'unsafe-url'
  /** `Parent` matched more than one row, because `Title` is not assumed unique. Promoted to top level. */
  | 'ambiguous-parent'
  /** `Parent` pointed at the row itself, or at a cycle. Promoted to top level. */
  | 'circular-parent'
  /** The row sat below the supported depth and was not rendered. */
  | 'depth-exceeded';

/** One dropped or demoted row, with enough detail for a site owner to fix the list. */
export interface INavigationDiagnostic {
  readonly itemId: number;
  readonly reason: NavigationDiagnosticReason;
  /** Human-readable explanation. Contains list configuration only — never user data. */
  readonly detail: string;
}

/** The full navigation configuration for one site. */
export interface INavigationConfiguration {
  /** Top-level items in display order. */
  readonly items: readonly INavigationItem[];

  /**
   * Rows that were dropped or demoted, in list order.
   *
   * Kept rather than discarded so a misconfigured list is diagnosable without database
   * access. The component does not render these; the customizer logs them once.
   */
  readonly diagnostics: readonly INavigationDiagnostic[];
}

/** Branding shown to the left of the links. */
export interface ISiteBranding {
  /** Site title from SPFx page context. */
  readonly title: string;

  /**
   * Absolute site logo URL, or `undefined` when the site has no logo.
   *
   * `undefined` specifically means "render the title alone". It must never become an
   * empty string handed to an `<img src>`, which is what produces a broken-image icon.
   */
  readonly logoUrl?: string;

  /** Where the branding links to — the site home. */
  readonly homeUrl: string;
}
