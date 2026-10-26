import { parseIsAdminView, parseIsAdminViewFromUrl } from './adminViewParam';

describe('parseIsAdminView', () => {
  it('is true only for the literal "true" value', () => {
    expect(parseIsAdminView('true')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(parseIsAdminView('True')).toBe(true);
    expect(parseIsAdminView('TRUE')).toBe(true);
  });

  it('is false when the parameter is missing', () => {
    expect(parseIsAdminView(undefined)).toBe(false);
    expect(parseIsAdminView(null)).toBe(false);
  });

  it('is false for any other value, not just a literal "false"', () => {
    expect(parseIsAdminView('false')).toBe(false);
    expect(parseIsAdminView('1')).toBe(false);
    expect(parseIsAdminView('')).toBe(false);
    expect(parseIsAdminView('yes')).toBe(false);
  });
});

describe('parseIsAdminViewFromUrl', () => {
  it('reads the adminview parameter from a full URL', () => {
    expect(parseIsAdminViewFromUrl('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482&adminview=true')).toBe(true);
  });

  it('is false when the parameter is absent', () => {
    expect(parseIsAdminViewFromUrl('https://contoso.sharepoint.com/sites/x/RiskDetail.aspx?id=482')).toBe(false);
  });

  it('is false for a malformed URL', () => {
    expect(parseIsAdminViewFromUrl('not a url')).toBe(false);
  });
});
