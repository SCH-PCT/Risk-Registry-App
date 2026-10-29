import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { RiskRegistryList } from './RiskRegistryList';
import { IRiskRegistryListProps } from './IRiskRegistryListProps';
import { MockRiskRegistryListRepository } from '../../../data/repositories/mock/MockRiskRegistryListRepository';
import { RiskRegistryError } from '../../../data/repositories/IRiskRegistryRepository';
import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';

/** Seven distinct items so the default 5-per-page setting produces two pages without touching the page-size control. */
function buildSevenItemsForPagination(): IRiskRegistryItem[] {
  return Array.from({ length: 7 }, (_, index) => ({
    id: 100 + index,
    etag: '',
    fields: { riskId: 100 + index, title: `Pagination Sample Risk ${index + 1}`, riskStatus: 'New' }
  }));
}

function buildProps(overrides: Partial<IRiskRegistryListProps> = {}): IRiskRegistryListProps {
  return {
    repository: new MockRiskRegistryListRepository(),
    // Auto-refresh disabled so no background timer is left running after a
    // test ends — the initial load still happens regardless, matching
    // `RiskRegistryDetail.test.tsx`'s convention for the same reason.
    refreshConfiguration: { enabled: false, intervalSeconds: 60 },
    showLastRefreshed: true,
    detailPageUrl: undefined,
    webAbsoluteUrl: 'https://contoso.sharepoint.com/sites/RiskRegistry',
    ...overrides
  };
}

describe('RiskRegistryList — loading and rendering', () => {
  it('renders every fetched card once loaded', async () => {
    render(<RiskRegistryList {...buildProps()} />);

    expect(await screen.findByText(/Automated Alaris Infusion Pump/i)).toBeInTheDocument();
    expect(screen.getByText(/Surgical Specimen Mislabeling/i)).toBeInTheDocument();
    expect(screen.getByText(/Look-Alike Sound-Alike/i)).toBeInTheDocument();
    expect(screen.getByText(/CT Scanner Contrast Extravasation/i)).toBeInTheDocument();
    expect(screen.getByText(/Central Line-Associated Bloodstream Infection/i)).toBeInTheDocument();
  });
});

describe('RiskRegistryList — KPI tiles', () => {
  it('computes counts from the fetched snapshot, not a fabricated placeholder', async () => {
    render(<RiskRegistryList {...buildProps()} />);

    await screen.findByText(/Automated Alaris Infusion Pump/i);

    // 3 of the 5 sample items carry the "4 -" (worst) priority rating, which
    // maps to display Tier 1 Critical — see `riskPriorityTier.ts`.
    expect(screen.getByRole('group', { name: 'Critical / Tier 1 Risks' }).textContent).toContain('3');
    // Exactly one sample item is in "Evaluation".
    expect(screen.getByRole('group', { name: 'Pending CQPS Review' }).textContent).toContain('1');
    // Exactly two sample items are "Assigned In-Progress".
    expect(screen.getByRole('group', { name: 'Active CAPs in Progress' }).textContent).toContain('2');
  });
});

describe('RiskRegistryList — search filter', () => {
  it('narrows the card list to titles matching the search text', async () => {
    render(<RiskRegistryList {...buildProps()} />);

    await screen.findByText(/Automated Alaris Infusion Pump/i);

    fireEvent.change(screen.getByPlaceholderText(/Search by Risk ID or title/i), { target: { value: 'CLABSI' } });

    await waitFor(() => {
      expect(screen.getByText(/Central Line-Associated Bloodstream Infection/i)).toBeInTheDocument();
      expect(screen.queryByText(/Automated Alaris Infusion Pump/i)).not.toBeInTheDocument();
    });
  });

  it('shows the empty state and a reset affordance when nothing matches', async () => {
    render(<RiskRegistryList {...buildProps()} />);

    await screen.findByText(/Automated Alaris Infusion Pump/i);

    fireEvent.change(screen.getByPlaceholderText(/Search by Risk ID or title/i), { target: { value: 'nonexistent risk' } });

    expect(await screen.findByText(/No risk records match the current filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
  });
});

describe('RiskRegistryList — status filter', () => {
  it('narrows the card list to the selected status', async () => {
    render(<RiskRegistryList {...buildProps()} />);

    await screen.findByText(/Automated Alaris Infusion Pump/i);

    fireEvent.change(screen.getByLabelText('Status:'), { target: { value: 'New' } });

    await waitFor(() => {
      expect(screen.getByText(/CT Scanner Contrast Extravasation/i)).toBeInTheDocument();
      expect(screen.queryByText(/Automated Alaris Infusion Pump/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Status: New/)).toBeInTheDocument();
  });
});

describe('RiskRegistryList — pagination', () => {
  it('moves to the next page and updates the visible cards', async () => {
    const repository = new MockRiskRegistryListRepository({ items: buildSevenItemsForPagination() });
    render(<RiskRegistryList {...buildProps({ repository })} />);

    // Default page size is 5, so page 1 of 7 items shows the first 5.
    await screen.findByText('Pagination Sample Risk 1');
    expect(screen.getByText('Pagination Sample Risk 5')).toBeInTheDocument();
    expect(screen.queryByText('Pagination Sample Risk 6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    await waitFor(() => {
      expect(screen.getByText('Pagination Sample Risk 6')).toBeInTheDocument();
      expect(screen.getByText('Pagination Sample Risk 7')).toBeInTheDocument();
      expect(screen.queryByText('Pagination Sample Risk 1')).not.toBeInTheDocument();
    });
  });
});

describe('RiskRegistryList — error state', () => {
  it('shows a retryable error when the initial load fails', async () => {
    const repository = new MockRiskRegistryListRepository({
      failWith: new RiskRegistryError('transient', 'boom')
    });

    render(<RiskRegistryList {...buildProps({ repository })} />);

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('RiskRegistryList — detail page navigation', () => {
  it('omits New Risk Intake when no detail page URL is configured', async () => {
    render(<RiskRegistryList {...buildProps({ detailPageUrl: undefined })} />);

    await screen.findByText(/Automated Alaris Infusion Pump/i);

    expect(screen.queryByRole('button', { name: /New Risk Intake/i })).not.toBeInTheDocument();
  });

  it('shows New Risk Intake when a detail page URL is configured', async () => {
    render(<RiskRegistryList {...buildProps({ detailPageUrl: 'https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/RiskDetail.aspx' })} />);

    await screen.findByText(/Automated Alaris Infusion Pump/i);

    expect(screen.getByRole('button', { name: /New Risk Intake/i })).toBeInTheDocument();
  });
});
