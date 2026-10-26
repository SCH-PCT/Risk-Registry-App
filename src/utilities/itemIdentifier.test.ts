import { describeItemIdentifierError, parseItemId, parseItemIdFromUrl } from './itemIdentifier';

describe('parseItemId', () => {
  it('accepts a positive integer string', () => {
    expect(parseItemId('482')).toEqual({ isValid: true, itemId: 482 });
  });

  it('rejects a missing value', () => {
    expect(parseItemId(undefined)).toEqual({ isValid: false, reason: 'missing' });
    expect(parseItemId(null)).toEqual({ isValid: false, reason: 'missing' });
    expect(parseItemId('')).toEqual({ isValid: false, reason: 'missing' });
    expect(parseItemId('   ')).toEqual({ isValid: false, reason: 'missing' });
  });

  it('rejects zero', () => {
    expect(parseItemId('0')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
  });

  it('rejects a negative number', () => {
    expect(parseItemId('-4')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
  });

  it('rejects a decimal value', () => {
    expect(parseItemId('4.5')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
  });

  it('rejects a value with leading zeros', () => {
    expect(parseItemId('007')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
  });

  it('rejects a value with trailing whitespace or extra characters', () => {
    expect(parseItemId('482 ')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
    expect(parseItemId('482abc')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
    expect(parseItemId('abc482')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
  });

  it('rejects a value that is too large to be a safe integer', () => {
    expect(parseItemId('99999999999999999999')).toEqual({ isValid: false, reason: 'out-of-range' });
  });

  it('rejects a value beyond the 32-bit item id range', () => {
    expect(parseItemId('9999999999')).toEqual({ isValid: false, reason: 'out-of-range' });
  });

  it('rejects an injection attempt disguised as an id', () => {
    expect(parseItemId("482; DROP TABLE")).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
    expect(parseItemId('<script>')).toEqual({ isValid: false, reason: 'not-a-positive-integer' });
  });
});

describe('parseItemIdFromUrl', () => {
  it('reads a valid id from the query string', () => {
    expect(parseItemIdFromUrl('https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/Detail.aspx?id=482')).toEqual({
      isValid: true,
      itemId: 482
    });
  });

  it('rejects a page with no id parameter', () => {
    expect(parseItemIdFromUrl('https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/Detail.aspx')).toEqual({
      isValid: false,
      reason: 'missing'
    });
  });

  it('rejects an invalid id parameter', () => {
    expect(parseItemIdFromUrl('https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/Detail.aspx?id=abc')).toEqual({
      isValid: false,
      reason: 'not-a-positive-integer'
    });
  });

  it('handles an unparseable url without throwing', () => {
    expect(parseItemIdFromUrl('not a url at all')).toEqual({ isValid: false, reason: 'missing' });
  });
});

describe('describeItemIdentifierError', () => {
  it('returns non-empty, user-safe text for every reason', () => {
    const reasons: Array<Parameters<typeof describeItemIdentifierError>[0]> = [
      'missing',
      'not-a-positive-integer',
      'out-of-range',
      undefined
    ];

    for (const reason of reasons) {
      const message = describeItemIdentifierError(reason);
      expect(message.length).toBeGreaterThan(0);
      // Never echoes a raw query-string value back into the message.
      expect(message).not.toMatch(/[<>]/);
    }
  });
});
