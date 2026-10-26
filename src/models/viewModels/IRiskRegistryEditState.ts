import { RiskRegistryDataFieldKey } from '../../config/listSchema';
import { RiskRegistryFieldValue } from '../domain/IRiskRegistryItem';

/** One field's current draft value plus its validation outcome, keyed by logical field name. */
export type RiskRegistryDraftValues = Partial<Record<RiskRegistryDataFieldKey, RiskRegistryFieldValue>>;

export type RiskRegistryFieldErrors = Partial<Record<RiskRegistryDataFieldKey, string>>;

/** Edit-form state for the Detail web part, independent of how it is rendered. */
export interface IRiskRegistryEditState {
  readonly isEditing: boolean;
  /** The values as loaded from the server — the baseline `isDirty` compares against. */
  readonly baselineValues: RiskRegistryDraftValues;
  /**
   * The item ETag the edit was started from. Tracked separately from
   * `baselineValues` (not folded into it as a synthetic field) specifically
   * so that `isDirty` — a diff between `baselineValues` and `draftValues` —
   * never has to special-case a key that is not a real `RiskRegistryData`
   * field, which `fieldMetadata.ts`'s per-field validation does not know
   * how to handle either.
   */
  readonly baselineEtag?: string;
  /** The values as currently typed, including unchanged ones. */
  readonly draftValues: RiskRegistryDraftValues;
  readonly fieldErrors: RiskRegistryFieldErrors;
  readonly isDirty: boolean;
  readonly isValid: boolean;
  readonly isSaving: boolean;
}
