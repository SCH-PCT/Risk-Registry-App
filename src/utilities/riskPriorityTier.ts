/**
 * Maps the real `riskPriorityRating` Choice field (`listSchema.ts` —
 * "1 - Noncompliance" ... "4 - ... and caused harm") onto the four-tier
 * severity scale the List web part's design shows ("Tier 1 Critical" ...
 * "Tier 4 Low"). The two scales run in opposite directions: the field's `4`
 * is the worst outcome, so it is Tier 1 (most severe) in the display scale.
 */

export type RiskSeverityTier = 1 | 2 | 3 | 4;

export interface IRiskSeverityTierInfo {
  readonly tier: RiskSeverityTier;
  readonly label: string;
}

const TIER_BY_RATING_PREFIX: ReadonlyArray<{ readonly prefix: string; readonly info: IRiskSeverityTierInfo }> = [
  { prefix: '4 -', info: { tier: 1, label: 'Tier 1 Critical' } },
  { prefix: '3 -', info: { tier: 2, label: 'Tier 2 High' } },
  { prefix: '2 -', info: { tier: 3, label: 'Tier 3 Moderate' } },
  { prefix: '1 -', info: { tier: 4, label: 'Tier 4 Low' } }
];

/** `undefined` when `riskPriorityRating` has not been set yet. */
export function mapPriorityRatingToTier(riskPriorityRating: string | undefined): IRiskSeverityTierInfo | undefined {
  if (!riskPriorityRating) {
    return undefined;
  }

  const match = TIER_BY_RATING_PREFIX.find((entry) => riskPriorityRating.indexOf(entry.prefix) === 0);
  return match?.info;
}
