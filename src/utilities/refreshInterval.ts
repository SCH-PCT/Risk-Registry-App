/**
 * Validation and scheduling math for the auto-refresh interval.
 *
 * Kept separate from the hook that uses it so the arithmetic — which is the
 * part most likely to be subtly wrong (off-by-one jitter bounds, a fallback
 * that doesn't actually trigger) — is testable as plain functions, the same
 * reasoning `navigationOverflow.ts` documents for its own extraction.
 */

/** The only values the property pane dropdown offers, per the brief. */
export const ALLOWED_REFRESH_INTERVALS_SECONDS: readonly number[] = [30, 60, 120, 300, 600, 900];

/** Used when a stored property is missing, invalid, or predates this property existing. */
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 60;

export const MIN_REFRESH_INTERVAL_SECONDS = 30;
export const MAX_REFRESH_INTERVAL_SECONDS = 900;

/**
 * Validates a stored interval value, falling back to the default rather than
 * throwing. An invalid or absent property must never take the whole web part
 * down, and must migrate silently — no page-author republish required.
 */
export function resolveRefreshIntervalSeconds(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_REFRESH_INTERVAL_SECONDS &&
    value <= MAX_REFRESH_INTERVAL_SECONDS &&
    ALLOWED_REFRESH_INTERVALS_SECONDS.indexOf(value) !== -1
  ) {
    return value;
  }

  return DEFAULT_REFRESH_INTERVAL_SECONDS;
}

/**
 * Applies small randomized jitter to an interval so multiple web parts and
 * clients polling the same list do not all request at exactly the same
 * instant. ±10% keeps the effective cadence close to what the page author
 * configured while still desynchronising clients.
 */
export function applyJitter(intervalMs: number, random: () => number = Math.random): number {
  const jitterRatio = 0.1;
  const span = intervalMs * jitterRatio;
  // Uniform in [intervalMs - span, intervalMs + span].
  return Math.round(intervalMs - span + random() * span * 2);
}
