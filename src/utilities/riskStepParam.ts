/**
 * Reads the `step` query-string parameter that selects which of the Detail
 * web part's four numbered step tiles (`WorkflowStepper`) renders in the
 * "selected" style, e.g. `...?id=482&step=3`.
 *
 * Unlike the `id` parameter (see `itemIdentifier.ts`), a bad or missing
 * value here has no invalid-page failure mode to guard against — it only
 * changes which tile is visually highlighted, never which data loads — so
 * this resolves a safe default (step 1) for anything blank, non-numeric, or
 * outside the 1-4 range, rather than exposing a rejection state every
 * caller would otherwise have to handle.
 */

/** Name of the query-string parameter that selects the highlighted step. */
export const RISK_STEP_QUERY_PARAM = 'step';

export type RiskWorkflowStepNumber = 1 | 2 | 3 | 4;

const VALID_STEPS: readonly RiskWorkflowStepNumber[] = [1, 2, 3, 4];

function isValidStep(value: number): value is RiskWorkflowStepNumber {
  return VALID_STEPS.indexOf(value as RiskWorkflowStepNumber) !== -1;
}

/**
 * Validates a raw query-string value as the selected step number.
 *
 * Blank, non-numeric, fractional, or out-of-range values all resolve to
 * step 1 rather than being rejected — this parameter is cosmetic, so
 * "default to the first step" is a complete answer, not a fallback for a
 * missing error-handling path.
 */
// eslint-disable-next-line @rushstack/no-new-null -- `URLSearchParams#get` returns `null`, not `undefined`, for a missing parameter
export function parseSelectedStep(raw: string | null | undefined): RiskWorkflowStepNumber {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return 1;
  }

  const parsed = Number(raw);
  return isValidStep(parsed) ? parsed : 1;
}

/**
 * Reads and validates {@link RISK_STEP_QUERY_PARAM} from a URL.
 *
 * Accepts a full URL string so callers can pass `window.location.href` and
 * this stays unit-testable without a real `window`.
 */
export function parseSelectedStepFromUrl(href: string): RiskWorkflowStepNumber {
  try {
    const url = new URL(href, 'https://localhost');
    return parseSelectedStep(url.searchParams.get(RISK_STEP_QUERY_PARAM));
  } catch {
    return 1;
  }
}

/**
 * Builds a URL with {@link RISK_STEP_QUERY_PARAM} set to `step`, preserving
 * every other query parameter.
 *
 * Mirrors `itemIdentifier.ts`'s `buildUrlWithItemId` — used the same way,
 * via `history.replaceState` rather than a navigation, so clicking a step
 * tile or Previous/Next keeps the address bar (and therefore a refresh or a
 * shared link) in sync with which step is showing, without adding a new
 * browser-history entry per click.
 */
export function buildUrlWithStep(href: string, step: RiskWorkflowStepNumber): string {
  const url = new URL(href, 'https://localhost');
  url.searchParams.set(RISK_STEP_QUERY_PARAM, String(step));
  return url.toString();
}
