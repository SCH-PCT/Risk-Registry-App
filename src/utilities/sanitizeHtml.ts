/**
 * Defensive sanitization for Note/clinical-text fields.
 *
 * ## Why this exists despite `RichText="FALSE"` on every Note field
 *
 * Every `Note` field on `RiskRegistryData` (`RiskSummary`, `DetailsofHarm`,
 * `SummaryofWorkCompleted`, etc.) is verified plain text — `RichText` is not
 * set to `TRUE` in the live schema, so SharePoint itself stores and returns
 * these as plain strings, not HTML. React already treats every string this
 * solution renders as a text node, never as markup, so there is no live XSS
 * path through these fields today.
 *
 * This module exists anyway, as the single defended choke point, because:
 *
 *  1. A field's `RichText` setting is a site-owner-controlled property that
 *     can change after this code ships, without a corresponding code review.
 *  2. `dangerouslySetInnerHTML` is never used in this solution (grep-verified
 *     by convention, not just by absence) — if that ever changes, the value
 *     must pass through here first, and nowhere else.
 *  3. A plain-text field can still contain literal HTML-looking text (a user
 *     pasted a snippet, or typed `<script>` as an example) that must render
 *     as visible text, never be interpreted — stripping tags here guarantees
 *     that even if a caller mistakenly used `dangerouslySetInnerHTML` later.
 *
 * `sanitizeNoteText` is the one function the Detail web part calls on every
 * Note-typed field before display. It does not attempt to preserve any HTML
 * structure — these fields are plain text, so there is none to preserve —
 * it only guarantees the output contains no tags, scripts or entities that
 * could be misinterpreted if a future caller renders it unsafely.
 */

/** Strips anything that looks like an HTML/XML tag. */
const TAG_PATTERN = /<[^>]*>/g;

/** Strips `javascript:`/`data:`-style scheme prefixes that sometimes appear in pasted text. */
const DANGEROUS_SCHEME_PATTERN = /\b(?:javascript|data|vbscript):/gi;

/**
 * Sanitizes a Note/clinical-text field value for safe display.
 *
 * Returns an empty string for `null`/`undefined`/non-string input rather than
 * throwing — a missing note is a normal, common state for these optional
 * fields, not an error.
 */
// eslint-disable-next-line @rushstack/no-new-null -- describes the SharePoint REST payload, which sends `null` for an empty column
export function sanitizeNoteText(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(TAG_PATTERN, '').replace(DANGEROUS_SCHEME_PATTERN, '').trim();
}

/** True when the raw value contains markup or a dangerous scheme that sanitization removed. */
// eslint-disable-next-line @rushstack/no-new-null -- describes the SharePoint REST payload, which sends `null` for an empty column
export function containsUnsafeMarkup(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return TAG_PATTERN.test(value) || DANGEROUS_SCHEME_PATTERN.test(value);
}
