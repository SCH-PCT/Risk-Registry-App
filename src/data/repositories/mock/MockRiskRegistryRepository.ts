/**
 * In-memory {@link IRiskRegistryRepository} for tests and local development
 * without a live site.
 */

import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';
import { RiskRegistryRawFieldValue } from '../../../models/dto/IRiskRegistryItemDto';
import { IRiskRegistryRepository, RiskRegistryError, RiskRegistrySaveConflictError } from '../IRiskRegistryRepository';

/**
 * A small, representative sample item covering every field type.
 *
 * `fields` is merged explicitly rather than via a trailing `...overrides`
 * spread: spreading `overrides` after the literal's own `fields` key would
 * let a caller's partial `fields` override *replace* the defaults wholesale
 * (object spread takes the last occurrence of a key verbatim, it does not
 * recursively merge) — so a test asking for one changed field would silently
 * lose every other default field too.
 */
export function buildSampleRiskRegistryItem(overrides: Partial<IRiskRegistryItem> = {}): IRiskRegistryItem {
  const { fields: fieldOverrides, ...otherOverrides } = overrides;

  return {
    id: 482,
    etag: '"1"',
    modified: new Date('2026-10-01T12:00:00Z'),
    ...otherOverrides,
    fields: {
      title: 'Automated Alaris Pump Dose Rate Discrepancy',
      riskId: 142,
      riskStatus: 'Assigned In-Progress',
      riskSummary: 'Pump dose rate did not match the ordered rate during a routine infusion check.',
      hasHarmToPatientVisitorWorkforce: 'No',
      eFeedbackNumber: 48213,
      riskIdentificationMethods: 'CQPS Rounding/Observation',
      sbarReviewComplete: true,
      primarySeverityCategory: 'Patient Harm',
      riskPriorityRating: '2 - Noncompliance with safety risks',
      accountableExecutive: { id: 11, displayName: 'Dr. James Romero, MD', email: 'james.romero@example.org' },
      vpDetermination: 'Accepted',
      assignmentType: 'Correction',
      correctionCategory: 'Quality Committee',
      qualityCommittee: 'Medication Safety',
      capStatus: 'In Progress',
      // Required once `capStatus` is "In Progress" (see `fieldMetadata.ts`'s
      // `CONDITIONAL_FIELD_RULES`) — filled here so this baseline fixture is
      // itself a valid record and saving an unrelated field (e.g. the
      // title) in a test never trips a newly-required CAP field by surprise.
      summaryOfWorkCompleted: 'Replaced the faulty pump sensor and verified calibration against the ordered rate.',
      escalationsIssuesBarriers: 'None at this time.',
      capClosureStatus: 'Pending',
      capCompleteReadyForReview: false,
      ...fieldOverrides
    }
  };
}

export interface IMockRiskRegistryRepositoryOptions {
  readonly item?: IRiskRegistryItem;
  /** Rejects `getById` with this instead of returning, for exercising error states. */
  readonly failGetWith?: RiskRegistryError;
  /** Rejects `update` with this instead of succeeding. */
  readonly failUpdateWith?: Error;
  /** Rejects `create` with this instead of succeeding. */
  readonly failCreateWith?: Error;
  readonly delayMs?: number;
}

export class MockRiskRegistryRepository implements IRiskRegistryRepository {
  private _item: IRiskRegistryItem;
  private readonly _options: IMockRiskRegistryRepositoryOptions;
  private _nextNewItemId: number;

  public getByIdCallCount = 0;
  public updateCallCount = 0;
  public createCallCount = 0;

  public constructor(options: IMockRiskRegistryRepositoryOptions = {}) {
    this._options = options;
    this._item = options.item ?? buildSampleRiskRegistryItem();
    this._nextNewItemId = this._item.id + 1;
  }

  /** Simulates the server record changing out from under the client, for conflict tests. */
  public simulateServerChange(updater: (item: IRiskRegistryItem) => IRiskRegistryItem): void {
    this._item = updater(this._item);
  }

  public async getById(itemId: number): Promise<IRiskRegistryItem> {
    this.getByIdCallCount += 1;

    if (this._options.delayMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, this._options.delayMs));
    }

    if (this._options.failGetWith) {
      throw this._options.failGetWith;
    }

    if (itemId !== this._item.id) {
      throw new RiskRegistryError('not-found', 'The risk record was not found.');
    }

    return this._item;
  }

  public async update(
    itemId: number,
    etag: string,
    payload: Readonly<Record<string, RiskRegistryRawFieldValue>>
  ): Promise<IRiskRegistryItem> {
    this.updateCallCount += 1;

    if (this._options.failUpdateWith) {
      throw this._options.failUpdateWith;
    }

    if (itemId !== this._item.id) {
      throw new RiskRegistryError('not-found', 'The risk record was not found.');
    }

    if (etag !== this._item.etag) {
      throw new RiskRegistrySaveConflictError(this._item);
    }

    const nextFields = { ...this._item.fields };
    for (const key of Object.keys(payload)) {
      // The mock applies the raw payload keyed by internal name back onto
      // the domain item's logical-name field bag for simplicity; real
      // mapping happens in `riskRegistryMapper.ts` against a live response.
      (nextFields as Record<string, unknown>)[key] = payload[key] ?? undefined;
    }

    this._item = {
      ...this._item,
      etag: `"${Number(this._item.etag.replace(/\D/g, '') || '1') + 1}"`,
      modified: new Date(),
      fields: nextFields
    };

    return this._item;
  }

  public async create(payload: Readonly<Record<string, RiskRegistryRawFieldValue>>): Promise<IRiskRegistryItem> {
    this.createCallCount += 1;

    if (this._options.delayMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, this._options.delayMs));
    }

    if (this._options.failCreateWith) {
      throw this._options.failCreateWith;
    }

    // The mock applies the raw payload keyed by internal name directly onto
    // the new item's logical-name field bag, for the same reason `update()`
    // does above: real mapping happens in `riskRegistryMapper.ts` against a
    // live response, which this in-memory stand-in never produces.
    const fields: Record<string, unknown> = {};
    for (const key of Object.keys(payload)) {
      fields[key] = payload[key] ?? undefined;
    }

    this._item = {
      id: this._nextNewItemId,
      etag: '"1"',
      modified: new Date(),
      fields: fields as IRiskRegistryItem['fields']
    };
    this._nextNewItemId += 1;

    return this._item;
  }
}
