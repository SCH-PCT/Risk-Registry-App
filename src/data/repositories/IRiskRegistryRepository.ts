/**
 * Read/write access to the primary `RiskRegistryData` item.
 *
 * An interface rather than a class so the Detail web part's hooks can be
 * exercised against a mock without an SPFx context, and so PnPjs stops at
 * the implementation — nothing above this layer knows OData exists.
 */

import { IRiskRegistryItem } from '../../models/domain/IRiskRegistryItem';
import { RiskRegistryRawFieldValue } from '../../models/dto/IRiskRegistryItemDto';

export type RiskRegistryErrorKind =
  | 'invalid-identifier'
  | 'not-found'
  | 'access-denied'
  | 'invalid-configuration'
  | 'transient';

/**
 * A read/write failure carrying enough context to decide what to render.
 * Deliberately not a plain `Error` — see `NavigationError` for the same
 * reasoning: the distinction between "misconfigured", "not found", "denied"
 * and "transient" drives both UI state and retry behaviour.
 */
export class RiskRegistryError extends Error {
  public readonly kind: RiskRegistryErrorKind;
  public readonly isRetryable: boolean;

  public constructor(kind: RiskRegistryErrorKind, message: string) {
    super(message);
    this.name = 'RiskRegistryError';
    this.kind = kind;
    this.isRetryable = kind === 'transient';
    Object.setPrototypeOf(this, RiskRegistryError.prototype);
  }
}

/**
 * Thrown by `update` when the server copy's ETag no longer matches the one
 * the edit was based on. Carries the freshly-read server item so the caller
 * can offer "reload" or "compare" without a second round trip.
 */
export class RiskRegistrySaveConflictError extends Error {
  public readonly serverItem: IRiskRegistryItem;

  public constructor(serverItem: IRiskRegistryItem) {
    super('The record was changed by someone else since it was loaded.');
    this.name = 'RiskRegistrySaveConflictError';
    this.serverItem = serverItem;
    Object.setPrototypeOf(this, RiskRegistrySaveConflictError.prototype);
  }
}

export interface IRiskRegistryRepository {
  /**
   * Fetches one item by its SharePoint system ID.
   * Rejects with {@link RiskRegistryError} for every failure mode.
   */
  getById(itemId: number): Promise<IRiskRegistryItem>;

  /**
   * Updates the fields in `payload` (raw internal-name keys — see
   * `mappers/riskRegistryMapper.ts#buildUpdatePayload`), guarded by `etag`.
   *
   * Rejects with {@link RiskRegistrySaveConflictError} on an ETag mismatch,
   * or {@link RiskRegistryError} for every other failure mode. Resolves with
   * the freshly-read item (new ETag included) on success.
   */
  update(
    itemId: number,
    etag: string,
    payload: Readonly<Record<string, RiskRegistryRawFieldValue>>
  ): Promise<IRiskRegistryItem>;

  /**
   * Creates a new `RiskRegistryData` item from `payload` (raw internal-name
   * keys — see `mappers/riskRegistryMapper.ts#buildUpdatePayload`).
   *
   * Rejects with {@link RiskRegistryError} for every failure mode. Resolves
   * with the freshly-read item (system `ID` and ETag included) on success.
   */
  create(payload: Readonly<Record<string, RiskRegistryRawFieldValue>>): Promise<IRiskRegistryItem>;
}
