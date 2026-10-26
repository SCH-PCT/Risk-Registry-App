import * as React from 'react';

import { RiskRegistryDataFieldKey } from '../config/listSchema';
import { IRiskRegistryItem, RiskRegistryFieldValue } from '../models/domain/IRiskRegistryItem';
import { RiskRegistryDraftValues, RiskRegistryFieldErrors } from '../models/viewModels/IRiskRegistryEditState';
import { buildUpdatePayload } from '../data/mappers/riskRegistryMapper';
import {
  clearHiddenFieldValues,
  getConditionalFieldKeysAffectedBy,
  validateConditionalField,
  validateConditionalRequirements,
  validateDraft,
  validateFieldValue,
  validateRequiredFieldsPresent
} from '../data/services/fieldMetadata';
import { IRiskRegistryRepository } from '../data/repositories/IRiskRegistryRepository';
import { IPeopleRepository } from '../data/repositories/IPeopleRepository';
import { IWebPermissionsService } from '../data/services/IWebPermissionsService';
import { resolvePersonFieldsForSave } from '../data/services/personFieldResolution';

export interface IUseRiskRegistryCreateOptions {
  readonly listTitle: string;
  readonly repository: IRiskRegistryRepository;
  readonly people: IPeopleRepository;
  readonly permissions: IWebPermissionsService;
}

export interface IUseRiskRegistryCreateResult {
  /** `undefined` while the permission check is still in flight. */
  readonly canCreate: boolean | undefined;
  readonly draftValues: RiskRegistryDraftValues;
  readonly fieldErrors: RiskRegistryFieldErrors;
  readonly isValid: boolean;
  readonly isSaving: boolean;
  readonly saveError?: string;
  readonly setFieldValue: (key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue) => void;
  /** Resolves with the created item on success, or `undefined` on a handled failure (errors are already recorded in state). */
  readonly create: () => Promise<IRiskRegistryItem | undefined>;
}

/**
 * Drives the "blank `id` parameter" new-item form — a brand-new
 * `RiskRegistryData` item with no baseline, no ETag, and no related
 * sections (none can exist yet for an item that has not been created).
 *
 * Deliberately not folded into `useRiskRegistryDetail`: that hook's state
 * shape (baseline/draft diffing, ETag concurrency, refresh, related-section
 * loading) only makes sense once an item exists. Field validation is shared
 * via `fieldMetadata.ts` so the two forms can never silently diverge on what
 * "valid" means for a given field.
 */
export function useRiskRegistryCreate(options: IUseRiskRegistryCreateOptions): IUseRiskRegistryCreateResult {
  const { listTitle, repository, people, permissions } = options;

  const [canCreate, setCanCreate] = React.useState<boolean | undefined>(undefined);
  // `riskStatus` defaults to "New" — the "Risk Identification" step (where a
  // user could otherwise set it) is hidden for the duration of creation, so
  // a brand-new record needs a sensible status from the start rather than
  // an unset one.
  const [draftValues, setDraftValues] = React.useState<RiskRegistryDraftValues>({ riskStatus: 'New' });
  const [fieldErrors, setFieldErrors] = React.useState<RiskRegistryFieldErrors>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | undefined>(undefined);

  const draftRef = React.useRef(draftValues);
  draftRef.current = draftValues;

  // See the matching guard in `useRiskRegistryDetail.ts` — `create()` below
  // resumes after an `await`, and without this a create still in flight when
  // the component unmounts would call `setIsSaving`/`setSaveError` on a dead
  // component once it resolves.
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    let isCancelled = false;
    permissions.canAddItems(listTitle).then(
      (result) => {
        if (!isCancelled) {
          setCanCreate(result);
        }
      },
      () => {
        if (!isCancelled) {
          setCanCreate(false);
        }
      }
    );
    return () => {
      isCancelled = true;
    };
  }, [listTitle, permissions]);

  const setFieldValue = React.useCallback((key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue) => {
    const draftValues = { ...draftRef.current, [key]: value };
    setDraftValues(draftValues);
    setFieldErrors((previous) => {
      const next: RiskRegistryFieldErrors = { ...previous };
      const message = validateFieldValue(key, value);
      if (message) {
        next[key] = message;
      } else {
        delete next[key];
      }

      // A field's visibility/requiredness can depend on another field's
      // value (see `fieldMetadata.ts`'s `CONDITIONAL_FIELD_RULES`) — re-check
      // every field affected by this change, since the standard
      // single-field check above does not know about those cross-field
      // rules.
      for (const affectedKey of getConditionalFieldKeysAffectedBy(key)) {
        const message = validateConditionalField(affectedKey, draftValues);
        if (message) {
          next[affectedKey] = message;
        } else {
          delete next[affectedKey];
        }
      }

      return next;
    });
  }, []);

  const create = React.useCallback(async (): Promise<IRiskRegistryItem | undefined> => {
    // A field no longer shown (e.g. the user picked "Other" then changed
    // their selection away from it) should not be sent with its stale
    // value — clear it before validating/creating, not just before
    // rendering.
    const current = clearHiddenFieldValues(draftRef.current);

    const errors: RiskRegistryFieldErrors = {
      ...validateDraft(current),
      ...validateRequiredFieldsPresent(current),
      ...validateConditionalRequirements(current)
    };

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return undefined;
    }

    setIsSaving(true);
    setSaveError(undefined);

    try {
      // A Person field just picked this session carries only a directory
      // login until now (see `IRiskRegistryPerson.loginName`) — resolve it
      // to a real SharePoint site user before building the create payload.
      const resolvedCurrent = await resolvePersonFieldsForSave(current, people);
      const payload = buildUpdatePayload(resolvedCurrent);
      let createdItem = await repository.create(payload);

      // "Risk ID" (the business field) is hidden during creation too, so
      // back it with the item's own system id immediately once one exists —
      // correcting it even if some other value came back from creation.
      if (createdItem.fields.riskId !== createdItem.id) {
        try {
          createdItem = await repository.update(
            createdItem.id,
            createdItem.etag,
            buildUpdatePayload({ riskId: createdItem.id })
          );
        } catch {
          // Best-effort backfill: the record was created successfully
          // either way, so a failed backfill should not block handing off
          // to the normal view/edit flow — RiskID can still be set by hand.
        }
      }

      if (isMountedRef.current) {
        setIsSaving(false);
      }
      return createdItem;
    } catch {
      if (isMountedRef.current) {
        setSaveError('This risk record could not be created. Please try again.');
        setIsSaving(false);
      }
      return undefined;
    }
  }, [repository, people]);

  return {
    canCreate,
    draftValues,
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
    isSaving,
    saveError,
    setFieldValue,
    create
  };
}
