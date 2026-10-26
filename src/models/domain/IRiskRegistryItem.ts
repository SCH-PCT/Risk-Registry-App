import { RiskRegistryDataFieldKey } from '../../config/listSchema';

/** Application-facing shape of a resolved People field value. */
export interface IRiskRegistryPerson {
  /** The SharePoint site user id — required to save. Present for a value read from the server; absent for a value just picked from directory search and not yet resolved (see `loginName`). */
  readonly id?: number;
  readonly displayName: string;
  readonly email?: string;
  /**
   * Claims-encoded directory login (e.g. `i:0#.f|membership|user@tenant.onmicrosoft.com`),
   * set only on a value just picked from `IPeopleRepository.searchPeople` that
   * has no `id` yet. `resolvePersonFieldsForSave` uses it to resolve the pick
   * to this site's user via `IPeopleRepository.ensurePerson` before saving —
   * SharePoint's Person-field update payload needs a site user id, which a
   * fresh tenant search result does not carry.
   */
  readonly loginName?: string;
}

/**
 * The value a single `RiskRegistryData` field can hold once mapped into the
 * application. Note/Text content has already passed through
 * `sanitizeNoteText` by the time it reaches here — nothing downstream needs
 * to sanitize it again.
 */
export type RiskRegistryFieldValue = string | number | boolean | IRiskRegistryPerson | undefined;

/**
 * A fully mapped `RiskRegistryData` item.
 *
 * `fields` is keyed by the same logical names as `RISK_REGISTRY_DATA_FIELDS`
 * in `config/listSchema.ts` — the field catalog and the domain model share
 * one vocabulary, which is what lets the generic field renderer iterate the
 * catalog and read `item.fields[key]` without a parallel per-field mapping.
 */
export interface IRiskRegistryItem {
  /** The SharePoint system item ID. This, not the `riskId` field, is what routing uses. */
  readonly id: number;
  /** Concurrency token for `IRiskRegistryRepository.update`. */
  readonly etag: string;
  readonly modified?: Date;
  /** System `Created` date. `undefined` when the query that produced this item did not select it. */
  readonly created?: Date;
  /** System `Author` (Created By). `undefined` when the query that produced this item did not select/expand it. */
  readonly submittedBy?: IRiskRegistryPerson;
  readonly fields: Readonly<Partial<Record<RiskRegistryDataFieldKey, RiskRegistryFieldValue>>>;
}

/** One field's current value plus whatever makes it independently addressable for errors/focus. */
export interface IRiskRegistryFieldState {
  readonly key: RiskRegistryDataFieldKey;
  readonly value: RiskRegistryFieldValue;
}
