import { buildUpdatePayload, extractEtag, mapRiskRegistryItem } from './riskRegistryMapper';
import { IRiskRegistryItemDto } from '../../models/dto/IRiskRegistryItemDto';

describe('extractEtag', () => {
  it('reads odata.etag when present', () => {
    expect(extractEtag({ 'odata.etag': '"1"' })).toBe('"1"');
  });

  it('reads @odata.etag when present', () => {
    expect(extractEtag({ '@odata.etag': '"2"' })).toBe('"2"');
  });

  it('reads __metadata.etag when present', () => {
    expect(extractEtag({ __metadata: { etag: '"3"' } })).toBe('"3"');
  });

  it('returns undefined when no etag property is present', () => {
    expect(extractEtag({ Id: 1 })).toBeUndefined();
  });
});

describe('mapRiskRegistryItem', () => {
  const baseDto: IRiskRegistryItemDto = {
    Id: 482,
    Modified: '2026-10-01T12:00:00Z',
    Title: 'Automated Alaris Pump Dose Rate Discrepancy',
    RiskID: 142,
    RiskStatus: 'Assigned In-Progress',
    HasHarmToPatientVisitorWorkforce: 'No',
    ReviewandupdateofattachedSBARisc: true,
    EvaluatorAssigned: { Id: 11, Title: 'Dr. James Romero, MD', EMail: 'james.romero@example.org' }
  };

  it('maps system fields and simple typed fields', () => {
    const item = mapRiskRegistryItem({ item: baseDto, etag: '"1"' });

    expect(item.id).toBe(482);
    expect(item.etag).toBe('"1"');
    expect(item.modified?.toISOString()).toBe('2026-10-01T12:00:00.000Z');
    expect(item.fields.title).toBe('Automated Alaris Pump Dose Rate Discrepancy');
    expect(item.fields.riskId).toBe(142);
    expect(item.fields.riskStatus).toBe('Assigned In-Progress');
    expect(item.fields.sbarReviewComplete).toBe(true);
  });

  it('maps a People field into the application Person shape', () => {
    const item = mapRiskRegistryItem({ item: baseDto, etag: '"1"' });

    expect(item.fields.evaluatorAssigned).toEqual({
      id: 11,
      displayName: 'Dr. James Romero, MD',
      email: 'james.romero@example.org'
    });
  });

  it('omits a field entirely rather than mapping null/undefined to a sentinel', () => {
    const dto: IRiskRegistryItemDto = { Id: 1, RiskSummary: null };
    const item = mapRiskRegistryItem({ item: dto, etag: '"1"' });

    expect('riskSummary' in item.fields).toBe(false);
  });

  it('sanitizes a Note field, stripping any embedded markup', () => {
    const dto: IRiskRegistryItemDto = {
      Id: 1,
      RiskSummary: 'Pump rate was <script>alert(1)</script> wrong during check.'
    };
    const item = mapRiskRegistryItem({ item: dto, etag: '"1"' });

    expect(item.fields.riskSummary).toBe('Pump rate was alert(1) wrong during check.');
    expect(item.fields.riskSummary).not.toMatch(/[<>]/);
  });

  it('survives a field whose raw value does not match its declared type', () => {
    const dto: IRiskRegistryItemDto = { Id: 1, RiskStatus: 12345 as unknown as string };
    const item = mapRiskRegistryItem({ item: dto, etag: '"1"' });

    expect(item.fields.riskStatus).toBeUndefined();
  });
});

describe('buildUpdatePayload', () => {
  it('maps draft logical keys to verified internal names', () => {
    const payload = buildUpdatePayload({ riskStatus: 'Evaluation', capUpdated: true });

    expect(payload).toEqual({ RiskStatus: 'Evaluation', CAPUpdated: true });
  });

  it('writes a resolved People field as its SharePoint-site-user id, keyed with the "Id" suffix', () => {
    const payload = buildUpdatePayload({
      evaluatorAssigned: { id: 11, displayName: 'Dr. James Romero, MD', email: 'james.romero@example.org' },
      riskStatus: 'Evaluation'
    });

    expect(payload).toEqual({ EvaluatorAssignedId: 11, RiskStatus: 'Evaluation' });
  });

  it('clears a People field to null rather than sending it malformed when it somehow still has no resolved id', () => {
    const payload = buildUpdatePayload({ evaluatorAssigned: { displayName: 'Someone', loginName: 'i:0#.f|membership|someone@example.org' } });
    expect(payload).toEqual({ EvaluatorAssignedId: null });
  });

  it('clears a People field to null when explicitly set to undefined', () => {
    const payload = buildUpdatePayload({ evaluatorAssigned: undefined });
    expect(payload).toEqual({ EvaluatorAssignedId: null });
  });

  it('writes null for a field explicitly cleared to undefined', () => {
    const payload = buildUpdatePayload({ riskRatingJustification: undefined });
    expect(payload).toEqual({ RiskRatingJustification: null });
  });
});
