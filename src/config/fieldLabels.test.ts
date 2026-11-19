import {
  getRiskRegistryDataFieldLabel,
  getRiskRegistryDataFieldLabelFor,
  resetRiskRegistryDataFieldLabels,
  resolveFieldLabels,
  setRiskRegistryDataFieldLabels
} from './fieldLabels';
import { getRiskRegistryDataField, RISK_REGISTRY_DATA_FIELDS } from './listSchema';

describe('fieldLabels', () => {
  afterEach(() => resetRiskRegistryDataFieldLabels());

  it('uses the catalog display name before labels are loaded', () => {
    expect(getRiskRegistryDataFieldLabel('capCompleteReadyForReview')).toBe('CAP draft complete and ready for review?');
  });

  it('prefers RiskRegistryDataColumns, then the live display name, then the catalog', () => {
    const { labels, fallbacks } = resolveFieldLabels(
      [{ internalName: 'RiskID', title: 'Risk Number' }, { internalName: 'RiskStatus', title: '  ' }],
      [{ internalName: 'RiskStatus', title: 'Status (live)' }]
    );

    expect(labels.riskId).toBe('Risk Number');
    expect(labels.riskStatus).toBe('Status (live)');
    expect(labels.title).toBe('Risk Title');

    const fallbackKeys = fallbacks.map((f) => f.key);
    expect(fallbackKeys).not.toContain('riskId');
    expect(fallbacks.find((f) => f.key === 'riskStatus')?.source).toBe('RiskRegistryData display name');
    expect(fallbacks.find((f) => f.key === 'title')?.source).toBe('catalog display name');
    expect(fallbacks.length).toBe(Object.keys(RISK_REGISTRY_DATA_FIELDS).length - 1);
  });

  it('serves loaded labels by key and by definition', () => {
    setRiskRegistryDataFieldLabels({ riskId: 'Risk Number' });
    expect(getRiskRegistryDataFieldLabel('riskId')).toBe('Risk Number');
    expect(getRiskRegistryDataFieldLabelFor(getRiskRegistryDataField('riskId'))).toBe('Risk Number');
    expect(getRiskRegistryDataFieldLabelFor(getRiskRegistryDataField('title'))).toBe('Risk Title');
  });
});
