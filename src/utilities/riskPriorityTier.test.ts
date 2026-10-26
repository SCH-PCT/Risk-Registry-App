import { mapPriorityRatingToTier } from './riskPriorityTier';

describe('mapPriorityRatingToTier', () => {
  it('maps the real "4 -" choice to Tier 1 Critical (the ratings and display scales run in opposite directions)', () => {
    expect(
      mapPriorityRatingToTier(
        '4 - Noncomliance with safety risks that have reached the patient/visitor/workforce and caused harm (temporary or permanent)'
      )
    ).toEqual({ tier: 1, label: 'Tier 1 Critical' });
  });

  it('maps "3 -" to Tier 2 High', () => {
    expect(
      mapPriorityRatingToTier('3 - Noncomliance with safety risks that have reached the patient/visitor/workforce')
    ).toEqual({ tier: 2, label: 'Tier 2 High' });
  });

  it('maps "2 -" to Tier 3 Moderate', () => {
    expect(mapPriorityRatingToTier('2 - Noncompliance with safety risks')).toEqual({ tier: 3, label: 'Tier 3 Moderate' });
  });

  it('maps "1 -" to Tier 4 Low', () => {
    expect(mapPriorityRatingToTier('1 - Noncompliance')).toEqual({ tier: 4, label: 'Tier 4 Low' });
  });

  it('returns undefined when unset, rather than guessing a tier', () => {
    expect(mapPriorityRatingToTier(undefined)).toBeUndefined();
  });

  it('returns undefined for a value that matches no known prefix', () => {
    expect(mapPriorityRatingToTier('Not a real choice')).toBeUndefined();
  });
});
