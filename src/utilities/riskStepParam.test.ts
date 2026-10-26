import { buildUrlWithStep, parseSelectedStep, parseSelectedStepFromUrl } from './riskStepParam';

describe('parseSelectedStep', () => {
  it('accepts each in-range step number', () => {
    expect(parseSelectedStep('1')).toBe(1);
    expect(parseSelectedStep('2')).toBe(2);
    expect(parseSelectedStep('3')).toBe(3);
    expect(parseSelectedStep('4')).toBe(4);
  });

  it('defaults to step 1 when blank', () => {
    expect(parseSelectedStep(undefined)).toBe(1);
    expect(parseSelectedStep(null)).toBe(1);
    expect(parseSelectedStep('')).toBe(1);
    expect(parseSelectedStep('   ')).toBe(1);
  });

  it('defaults to step 1 for a non-numeric value', () => {
    expect(parseSelectedStep('abc')).toBe(1);
  });

  it('defaults to step 1 for an out-of-range value', () => {
    expect(parseSelectedStep('0')).toBe(1);
    expect(parseSelectedStep('5')).toBe(1);
    expect(parseSelectedStep('-1')).toBe(1);
  });

  it('defaults to step 1 for a fractional value', () => {
    expect(parseSelectedStep('2.5')).toBe(1);
  });
});

describe('parseSelectedStepFromUrl', () => {
  it('reads the step parameter from a full URL', () => {
    expect(parseSelectedStepFromUrl('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482&step=3')).toBe(3);
  });

  it('defaults to step 1 when the parameter is absent', () => {
    expect(parseSelectedStepFromUrl('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482')).toBe(1);
  });

  it('defaults to step 1 for a malformed URL', () => {
    expect(parseSelectedStepFromUrl('not a url')).toBe(1);
  });
});

describe('buildUrlWithStep', () => {
  it('sets the step parameter, preserving every other query parameter', () => {
    const url = buildUrlWithStep('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482&step=1', 3);
    expect(url).toBe('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482&step=3');
  });

  it('adds the step parameter when it was absent', () => {
    const url = buildUrlWithStep('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482', 2);
    expect(url).toBe('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482&step=2');
  });
});
