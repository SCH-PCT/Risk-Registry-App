import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { RiskListCard } from './RiskListCard';
import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';

function buildItem(overrides: Partial<IRiskRegistryItem> = {}): IRiskRegistryItem {
  return {
    id: 482,
    etag: '"1"',
    fields: { riskId: 142, title: 'Automated Alaris Infusion Pump Dose Rate Discrepancy' },
    ...overrides
  };
}

const TITLE = 'Automated Alaris Infusion Pump Dose Rate Discrepancy';

describe('RiskListCard — title link', () => {
  it('links the title to the detail page using the system id, not the RiskID business field', () => {
    render(
      <RiskListCard
        item={buildItem()}
        detailUrl="https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/Risk-Registry-Detail.aspx"
        webAbsoluteUrl="https://contoso.sharepoint.com/sites/RiskRegistry"
      />
    );

    // Exact name match: the whole card is also `role="link"` (clicking
    // anywhere on the row navigates too), and its accessible name is the
    // entire row's text — only the title's own `<a>` matches the title text
    // exactly.
    const link = screen.getByRole('link', { name: TITLE });
    expect(link).toHaveAttribute(
      'href',
      'https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/Risk-Registry-Detail.aspx?id=482'
    );
  });

  it('appends to an existing query string with "&" instead of a second "?"', () => {
    render(
      <RiskListCard
        item={buildItem()}
        detailUrl="https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/Risk-Registry-Detail.aspx?source=list"
        webAbsoluteUrl="https://contoso.sharepoint.com/sites/RiskRegistry"
      />
    );

    const link = screen.getByRole('link', { name: TITLE });
    expect(link).toHaveAttribute(
      'href',
      'https://contoso.sharepoint.com/sites/RiskRegistry/SitePages/Risk-Registry-Detail.aspx?source=list&id=482'
    );
  });

  it('renders the title as plain text, with no card-level link affordance, when no detail page URL is configured', () => {
    render(<RiskListCard item={buildItem()} detailUrl={undefined} webAbsoluteUrl="https://contoso.sharepoint.com/sites/RiskRegistry" />);

    expect(screen.getByText(/Automated Alaris Infusion Pump/i)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
