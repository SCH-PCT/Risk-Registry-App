/**
 * Parses and validates the SharePoint list item identifier the Detail web part
 * is routed with.
 *
 * ## Why the system `ID`, not the `RiskID` business field
 *
 * `RiskRegistryData` carries two identifiers (see `config/listSchema.ts`):
 * the system `ID` (SharePoint's Counter field — always present, always unique,
 * what `items.getById()` resolves against) and `RiskID` (a business-facing
 * Number field that is NOT required and NOT unique-enforced). Routing on the
 * business field would mean a blank or duplicate value makes a risk
 * unreachable or ambiguous; the system ID never has that failure mode. This
 * module therefore validates and resolves the system ID only.
 *
 * ## The query-string contract
 *
 * The web part reads the item from the `id` query-string parameter, e.g.
 * `...?id=482`. The value must be a positive integer with no extra characters
 * — SharePoint item IDs are never zero, negative, fractional or non-numeric,
 * so anything else is rejected before a network call is made rather than
 * being sent to the server and producing an opaque error.
 */

/** Name of the query-string parameter the Detail web part reads. */
export const RISK_ITEM_ID_QUERY_PARAM = 'id';

/** Upper bound sanity check. SharePoint item IDs are 32-bit; this rejects garbage early. */
const MAX_SAFE_ITEM_ID = 2147483647;

/** Exactly one or more digits, no sign, no decimal point, no leading/trailing whitespace. */
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

export type ItemIdentifierErrorReason = 'missing' | 'not-a-positive-integer' | 'out-of-range';

export interface IItemIdentifierResult {
  readonly isValid: boolean;
  readonly itemId?: number;
  readonly reason?: ItemIdentifierErrorReason;
}

/**
 * Validates a raw query-string value as a SharePoint item ID.
 *
 * Deliberately strict: `"007"`, `"4.0"`, `"4 "`, `"-4"` and `"0"` are all
 * rejected. A hand-edited or copied URL is the realistic source of a bad
 * value here, and silently coercing it (e.g. via `parseInt`, which stops at
 * the first non-digit) would resolve to a different item than the one in the
 * URL — the wrong-record failure mode is worse than a clear rejection.
 */
// eslint-disable-next-line @rushstack/no-new-null -- `URLSearchParams#get` returns `null`, not `undefined`, for a missing parameter
export function parseItemId(raw: string | null | undefined): IItemIdentifierResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { isValid: false, reason: 'missing' };
  }

  if (!POSITIVE_INTEGER_PATTERN.test(raw)) {
    return { isValid: false, reason: 'not-a-positive-integer' };
  }

  const itemId = Number(raw);

  if (!Number.isSafeInteger(itemId) || itemId > MAX_SAFE_ITEM_ID) {
    return { isValid: false, reason: 'out-of-range' };
  }

  return { isValid: true, itemId };
}

/**
 * Reads and validates {@link RISK_ITEM_ID_QUERY_PARAM} from a URL.
 *
 * Accepts a full URL string so callers can pass `window.location.href` and
 * this stays unit-testable without a real `window`.
 */
export function parseItemIdFromUrl(href: string): IItemIdentifierResult {
  try {
    const url = new URL(href, 'https://localhost');
    return parseItemId(url.searchParams.get(RISK_ITEM_ID_QUERY_PARAM));
  } catch {
    return { isValid: false, reason: 'missing' };
  }
}

/**
 * Builds a URL with {@link RISK_ITEM_ID_QUERY_PARAM} set to `itemId`, preserving
 * every other query parameter.
 *
 * Used once a new item has been created from the "blank `id`" creation form,
 * to move the page's address bar to the item it just created — via
 * `history.replaceState`, not a navigation — so a page refresh afterward
 * reopens the same record instead of the creation form again.
 */
export function buildUrlWithItemId(href: string, itemId: number): string {
  const url = new URL(href, 'https://localhost');
  url.searchParams.set(RISK_ITEM_ID_QUERY_PARAM, String(itemId));
  return url.toString();
}

/** Human-readable (and non-sensitive) explanation for each rejection reason. */
export function describeItemIdentifierError(reason: ItemIdentifierErrorReason | undefined): string {
  switch (reason) {
    case 'missing':
      return `The page link is missing the '${RISK_ITEM_ID_QUERY_PARAM}' parameter.`;
    case 'not-a-positive-integer':
      return `The '${RISK_ITEM_ID_QUERY_PARAM}' parameter in the page link is not valid.`;
    case 'out-of-range':
      return `The '${RISK_ITEM_ID_QUERY_PARAM}' parameter in the page link is out of range.`;
    default:
      return 'The page link is not valid.';
  }
}
