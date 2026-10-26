/**
 * Reads the `adminview` query-string parameter that controls whether the
 * Detail web part shows every step at once or only the active one, e.g.
 * `...?id=482&step=3&adminview=true`.
 *
 * Like `step` (see `riskStepParam.ts`), a missing or malformed value has no
 * invalid-page failure mode — it only changes how many steps render, never
 * which data loads — so this resolves a safe default (`false`, i.e. "only
 * the active step") for anything other than exactly `"true"`, rather than
 * exposing a rejection state every caller would otherwise have to handle.
 */

/** Name of the query-string parameter that enables showing every step at once. */
export const ADMIN_VIEW_QUERY_PARAM = 'adminview';

/**
 * Validates a raw query-string value as the admin-view flag.
 *
 * Only the literal `"true"` (case-insensitive) turns admin view on; a
 * missing parameter, an empty value, or anything else (`"false"`, `"1"`,
 * a typo) all resolve to `false` — matching the requirement that admin view
 * is off unless the parameter is present and exactly `"true"`.
 */
// eslint-disable-next-line @rushstack/no-new-null -- `URLSearchParams#get` returns `null`, not `undefined`, for a missing parameter
export function parseIsAdminView(raw: string | null | undefined): boolean {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'true';
}

/**
 * Reads and validates {@link ADMIN_VIEW_QUERY_PARAM} from a URL.
 *
 * Accepts a full URL string so callers can pass `window.location.href` and
 * this stays unit-testable without a real `window`.
 */
export function parseIsAdminViewFromUrl(href: string): boolean {
  try {
    const url = new URL(href, 'https://localhost');
    return parseIsAdminView(url.searchParams.get(ADMIN_VIEW_QUERY_PARAM));
  } catch {
    return false;
  }
}
