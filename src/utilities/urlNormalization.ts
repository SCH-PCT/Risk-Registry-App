/**
 * URL normalisation for navigation active-item matching.
 *
 * `appTopNavigation.URL` is assumed to be a plain **Text** column (unverified on this
 * site — see `config/listSchema.ts` and SCHEMA-TODO.md). SharePoint applies no
 * validation to a Text column, so every value arriving here is treated as untrusted,
 * arbitrarily-shaped user input regardless of what discovery eventually confirms. It
 * may be absolute, server-relative, document-relative, percent-encoded, cased
 * differently from the address bar, carry a query string or fragment, or be a
 * `javascript:` URL that would become a site-wide script vector once placed in an
 * `href`.
 *
 * Three separate jobs live in this file and must not be conflated:
 *
 *  1. `isSafeNavigationUrl` — a security gate. Decides whether a value may ever reach
 *     an `href`. Fails closed.
 *  2. `resolveNavigationUrl` — the href builder. Pins a relative value to the site so the
 *     browser cannot resolve it against a deeper page. Applies the same scheme gate.
 *  3. `normalizeUrl` / `isSameBasePage` — a matching aid. Decides whether a link points
 *     at the page currently being viewed. Never widens what is considered safe.
 *
 * Nothing here mutates or "repairs" a bad value. A malformed navigation URL is a
 * configuration error in the list, and guessing at the author's intent would turn a
 * visible misconfiguration into a silent wrong link.
 */

/** Schemes permitted in an `href`. Everything else is rejected. */
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * A URL reduced to the form used for comparisons.
 *
 * Query string and fragment are deliberately absent: they are dropped during
 * normalisation because base-page matching ignores them.
 */
export interface INormalizedUrl {
  /** Lowercase `scheme://host[:port]`, e.g. `https://contoso.sharepoint.com`. */
  readonly origin: string;
  /** Lowercase, percent-decoded, leading-slash path with no trailing slash. Root is `/`. */
  readonly path: string;
  /**
   * `origin + path`. The value to compare — comparing `path` alone would match a link
   * to another tenant that happens to share a path.
   */
  readonly key: string;
  /** True when the URL resolves to a different origin than the site. */
  readonly isExternal: boolean;
}

/**
 * Percent-decodes one path segment, leaving it untouched if it is not valid encoding.
 *
 * `decodeURIComponent` throws a `URIError` on a malformed sequence such as `%zz` or a
 * truncated `%2`. A navigation list is authored by hand, so malformed encoding is a
 * realistic input; the raw segment is the best available representation of it and is
 * far preferable to discarding the whole URL.
 */
function decodeSegment(segment: string): string {
  let decoded: string;

  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return segment;
  }

  // Decoding `%2F` yields a real `/`, which would become a path separator as soon as the
  // segments are rejoined — inventing a directory boundary the author never wrote and
  // making `/a%2Fb` compare equal to `/a/b`. Re-escaping it keeps the segment structure
  // exactly as the URL defined it while still decoding everything else.
  return decoded.replace(/\//g, '%2F');
}

/**
 * Decodes a path **segment by segment** rather than whole.
 *
 * Decoding the whole path at once would turn an encoded `%2F` into a real separator
 * and invent a directory boundary the author never wrote. Splitting first keeps the
 * segment structure fixed while still normalising `%20` in page names such as
 * `/SitePages/Risk%20List.aspx`.
 */
function decodePath(path: string): string {
  return path.split('/').map(decodeSegment).join('/');
}

/**
 * Removes a trailing slash, except from the root path.
 *
 * `/sites/riskregistry/` and `/sites/riskregistry` are the same page; `/` and `` are
 * not — collapsing the root to an empty string would make it match nothing.
 */
function stripTrailingSlash(path: string): string {
  if (path.length > 1 && path.charAt(path.length - 1) === '/') {
    return path.substring(0, path.length - 1);
  }
  return path;
}

/**
 * Ensures a base URL ends in `/` before it is used to resolve a relative reference.
 *
 * Without this, RFC 3986 resolution discards the last segment: resolving
 * `SitePages/Home.aspx` against `https://host/sites/RiskRegistry` yields
 * `https://host/sites/SitePages/Home.aspx` — the wrong site. SPFx hands us
 * `pageContext.web.absoluteUrl` with no trailing slash, so this is the normal case,
 * not an edge case.
 */
function asResolvableBase(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.charAt(trimmed.length - 1) === '/' ? trimmed : `${trimmed}/`;
}

/**
 * Parses a raw value into a `URL`, resolving relative references against the site.
 *
 * Returns `undefined` for anything unparseable. Note that this deliberately parses
 * `javascript:` and `data:` successfully — scheme filtering is a separate decision made
 * by the caller, so that the security check lives in exactly one place instead of being
 * an accident of what happened to parse.
 */
function parse(rawUrl: string | undefined, baseUrl?: string): URL | undefined {
  if (typeof rawUrl !== 'string') {
    return undefined;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  const base = asResolvableBase(baseUrl);

  try {
    return base ? new URL(trimmed, base) : new URL(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * True when the value is safe to place in an `href`.
 *
 * This is the only gate between the `URL` text column and the DOM. It fails closed:
 * anything that does not parse, or that resolves to a scheme outside
 * {@link ALLOWED_PROTOCOLS}, is rejected. `javascript:`, `data:`, `vbscript:`, `file:`
 * and `blob:` are all rejected by that rule rather than by a blocklist, so a scheme
 * nobody anticipated is rejected too.
 *
 * A relative value is only judged safe when a base URL is supplied, because without one
 * there is no way to know what it resolves to.
 */
export function isSafeNavigationUrl(rawUrl: string | undefined, baseUrl?: string): boolean {
  const parsed = parse(rawUrl, baseUrl);
  return parsed !== undefined && ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase());
}

/**
 * Resolves a raw list value into the absolute URL to place in an `href`, or `undefined`
 * when it is unparseable or not a safe scheme.
 *
 * This exists because a relative value resolves against **two different bases** depending
 * on who does the resolving. {@link isSafeNavigationUrl} resolves against the site, but a
 * browser resolves a relative `href` against the *current page*, and on SharePoint the
 * current page lives one directory deeper than the site root. An authored value of
 * `sites/RiskRegistry/SitePages/Risks.aspx` viewed from
 * `/sites/RiskRegistry/SitePages/Home.aspx` would therefore navigate to
 * `/sites/RiskRegistry/SitePages/sites/RiskRegistry/SitePages/Risks.aspx` — a link that
 * was validated against one target and then followed to another.
 *
 * Resolving here settles that at map time, against the same base the validation used, so
 * the href means the same thing on every page in the site. This is not a repair of a bad
 * value: an absolute or server-relative URL passes through unchanged apart from RFC 3986
 * normalisation, and nothing is guessed about the author's intent.
 *
 * Unlike {@link normalizeUrl} the result is **not** lowercased and keeps its query string
 * and fragment, because this value is navigated to rather than compared.
 */
export function resolveNavigationUrl(rawUrl: string | undefined, baseUrl?: string): string | undefined {
  const parsed = parse(rawUrl, baseUrl);

  if (!parsed || !ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
    return undefined;
  }

  return parsed.href;
}

/**
 * Reduces a URL to its comparable form, or `undefined` if it cannot be parsed or is
 * not a safe navigation scheme.
 *
 * Applies, in order: relative resolution against the site, scheme filtering, removal of
 * query string and fragment, per-segment percent-decoding, trailing-slash removal, and
 * lowercasing.
 *
 * Lowercasing is correct here despite SharePoint paths being case-*preserving*: the
 * address bar, the list value and a hand-typed link routinely disagree on case for the
 * same page, and treating those as different pages would leave the navigation with
 * nothing highlighted.
 */
export function normalizeUrl(rawUrl: string | undefined, baseUrl?: string): INormalizedUrl | undefined {
  const parsed = parse(rawUrl, baseUrl);

  if (!parsed || !ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
    return undefined;
  }

  // `URL.pathname` has already dropped `?query` and `#fragment` and resolved any
  // `.`/`..` segments, which is precisely the base-page identity we want to compare.
  const path = stripTrailingSlash(decodePath(parsed.pathname)).toLowerCase();
  const origin = `${parsed.protocol}//${parsed.host}`.toLowerCase();

  const siteOrigin = parse(baseUrl)?.origin?.toLowerCase();

  return {
    origin,
    path: path || '/',
    key: `${origin}${path || '/'}`,
    isExternal: siteOrigin !== undefined && siteOrigin !== origin
  };
}

/**
 * True when two URLs address the same base page.
 *
 * "Base page" means the query string and fragment are ignored, so
 * `/SitePages/Risks.aspx?filter=open` and `/SitePages/Risks.aspx#risk-3` both match
 * the navigation link `/SitePages/Risks.aspx`. That is what makes a top-level
 * navigation item stay highlighted while the user filters or jumps within the page.
 *
 * Both sides must normalise successfully; an unparseable or unsafe URL matches nothing,
 * including another unparseable URL.
 */
export function isSameBasePage(
  candidateUrl: string | undefined,
  currentUrl: string | undefined,
  baseUrl?: string
): boolean {
  const candidate = normalizeUrl(candidateUrl, baseUrl);
  const current = normalizeUrl(currentUrl, baseUrl);

  if (!candidate || !current) {
    return false;
  }

  return candidate.key === current.key;
}
