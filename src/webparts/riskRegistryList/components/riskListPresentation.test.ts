import { computePaginationPages, initialsFor, statusToneFor } from './riskListPresentation';

describe('statusToneFor', () => {
  it('maps a Corrected status to success', () => {
    expect(statusToneFor('Corrected - Hard Fix')).toBe('success');
  });

  it('maps Assigned In-Progress to warning', () => {
    expect(statusToneFor('Assigned In-Progress')).toBe('warning');
  });

  it('falls back to neutral for an unset status', () => {
    expect(statusToneFor(undefined)).toBe('neutral');
  });
});

describe('initialsFor', () => {
  it('builds initials from a first and last name', () => {
    expect(initialsFor('Dr. Michael Davies, MD')).toBe('DM');
  });

  it('falls back to a single initial when there is only one name part', () => {
    expect(initialsFor('Cher')).toBe('C');
  });
});

describe('computePaginationPages', () => {
  it('lists every page with no ellipsis when the total is small', () => {
    expect(computePaginationPages(1, 3)).toEqual([1, 2, 3]);
  });

  it('shows a single page for a one-page result set', () => {
    expect(computePaginationPages(1, 1)).toEqual([1]);
  });

  it('windows around the current page and collapses the gap to the last page into one ellipsis', () => {
    expect(computePaginationPages(1, 29)).toEqual([1, 2, 3, 4, 'ellipsis', 29]);
  });
});
