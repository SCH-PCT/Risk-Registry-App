import * as React from 'react';

import { RiskRegistryDataFieldKey } from '../config/listSchema';
import { DetailErrorKind } from '../components/common/ErrorState';
import { IRiskAction, IRiskActivity, IRiskAssignment, IRiskUpdateRecord } from '../models/domain/IRiskRelatedRecord';
import { IRiskDocument } from '../models/domain/IRiskDocument';
import { IRiskRegistryItem, RiskRegistryFieldValue } from '../models/domain/IRiskRegistryItem';
import {
  accessDeniedSection,
  errorSection,
  IRelatedEntitySectionState,
  loadedSection,
  loadingSection,
  notConfiguredSection
} from '../models/domain/IRelatedEntitySection';
import { IRiskRegistryEditState, RiskRegistryDraftValues, RiskRegistryFieldErrors } from '../models/viewModels/IRiskRegistryEditState';
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
import { IRiskActionRepository } from '../data/repositories/IRiskActionRepository';
import { IRiskActivityRepository } from '../data/repositories/IRiskActivityRepository';
import { IRiskAssignmentRepository } from '../data/repositories/IRiskAssignmentRepository';
import { IRiskDocumentRepository } from '../data/repositories/IRiskDocumentRepository';
import { IRiskUpdateRepository } from '../data/repositories/IRiskUpdateRepository';
import { IPeopleRepository } from '../data/repositories/IPeopleRepository';
import { IRiskRegistryRepository, RiskRegistryError, RiskRegistrySaveConflictError } from '../data/repositories/IRiskRegistryRepository';
import { IWebPermissionsService } from '../data/services/IWebPermissionsService';
import { resolvePersonFieldsForSave } from '../data/services/personFieldResolution';
import { IRefreshConfiguration } from '../state/RefreshCoordinator';
import { useAutoRefresh } from './useAutoRefresh';

export interface IRiskRegistryDetailRepositories {
  readonly riskRegistry: IRiskRegistryRepository;
  readonly actions: IRiskActionRepository;
  readonly activities: IRiskActivityRepository;
  readonly updates: IRiskUpdateRepository;
  readonly assignments: IRiskAssignmentRepository;
  readonly documents: IRiskDocumentRepository;
  readonly people: IPeopleRepository;
}

export interface IUseRiskRegistryDetailOptions {
  readonly itemId: number;
  readonly listTitle: string;
  readonly repositories: IRiskRegistryDetailRepositories;
  readonly permissions: IWebPermissionsService;
  readonly refreshConfiguration: IRefreshConfiguration;
}

export interface IRiskRegistryDetailConflict {
  readonly serverItem: IRiskRegistryItem;
}

const EMPTY_EDIT_STATE: IRiskRegistryEditState = {
  isEditing: false,
  baselineValues: {},
  draftValues: {},
  fieldErrors: {},
  isDirty: false,
  isValid: true,
  isSaving: false
};

function shallowValuesEqual(a: RiskRegistryFieldValue, b: RiskRegistryFieldValue): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function computeIsDirty(baseline: RiskRegistryDraftValues, draft: RiskRegistryDraftValues): boolean {
  const keys = Array.from(
    new Set<RiskRegistryDataFieldKey>([
      ...(Object.keys(baseline) as RiskRegistryDataFieldKey[]),
      ...(Object.keys(draft) as RiskRegistryDataFieldKey[])
    ])
  );

  for (const key of keys) {
    if (!shallowValuesEqual(baseline[key], draft[key])) {
      return true;
    }
  }
  return false;
}

function computeChangedFields(baseline: RiskRegistryDraftValues, draft: RiskRegistryDraftValues): RiskRegistryDraftValues {
  const changed: RiskRegistryDraftValues = {};
  for (const key of Object.keys(draft) as RiskRegistryDataFieldKey[]) {
    if (!shallowValuesEqual(baseline[key], draft[key])) {
      changed[key] = draft[key];
    }
  }
  return changed;
}

function classifyLoadError(error: unknown): DetailErrorKind {
  if (error instanceof RiskRegistryError) {
    switch (error.kind) {
      case 'not-found':
        return 'not-found';
      case 'access-denied':
        return 'access-denied';
      case 'invalid-configuration':
        return 'invalid-configuration';
      case 'transient':
        return 'transient';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

async function loadRelatedSection<T>(
  load: () => Promise<T[]>
): Promise<IRelatedEntitySectionState<T>> {
  try {
    const items = await load();
    return loadedSection(items);
  } catch (error) {
    if (error instanceof RiskRegistryError) {
      if (error.kind === 'invalid-configuration') {
        return notConfiguredSection();
      }
      if (error.kind === 'access-denied') {
        return accessDeniedSection();
      }
    }
    return errorSection('This information could not be loaded.');
  }
}

export interface IUseRiskRegistryDetailResult {
  readonly loadState: 'loading' | 'loaded' | 'fatal-error';
  readonly errorKind?: DetailErrorKind;
  readonly item?: IRiskRegistryItem;
  readonly isShowingStaleData: boolean;
  readonly relatedSections: {
    readonly actions: IRelatedEntitySectionState<IRiskAction>;
    readonly activities: IRelatedEntitySectionState<IRiskActivity>;
    readonly updates: IRelatedEntitySectionState<IRiskUpdateRecord>;
    readonly assignments: IRelatedEntitySectionState<IRiskAssignment>;
    readonly documents: IRelatedEntitySectionState<IRiskDocument>;
  };
  readonly canEdit: boolean | undefined;
  readonly edit: IRiskRegistryEditState;
  readonly saveError?: string;
  readonly conflict?: IRiskRegistryDetailConflict;
  readonly startEdit: () => void;
  readonly cancelEdit: () => void;
  readonly setFieldValue: (key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue) => void;
  readonly save: () => Promise<boolean>;
  readonly reloadFromConflict: () => void;
  readonly dismissConflict: () => void;
  readonly refreshNow: () => void;
  readonly refreshState: ReturnType<typeof useAutoRefresh>;
}

export function useRiskRegistryDetail(options: IUseRiskRegistryDetailOptions): IUseRiskRegistryDetailResult {
  const { itemId, listTitle, repositories, permissions, refreshConfiguration } = options;

  const [item, setItem] = React.useState<IRiskRegistryItem | undefined>(undefined);
  const [fatalErrorKind, setFatalErrorKind] = React.useState<DetailErrorKind | undefined>(undefined);
  const [isShowingStaleData, setIsShowingStaleData] = React.useState(false);
  const [canEdit, setCanEdit] = React.useState<boolean | undefined>(undefined);
  const [conflict, setConflict] = React.useState<IRiskRegistryDetailConflict | undefined>(undefined);
  const [saveError, setSaveError] = React.useState<string | undefined>(undefined);
  const [edit, setEdit] = React.useState<IRiskRegistryEditState>(EMPTY_EDIT_STATE);

  const [relatedSections, setRelatedSections] = React.useState<IUseRiskRegistryDetailResult['relatedSections']>({
    actions: loadingSection(),
    activities: loadingSection(),
    updates: loadingSection(),
    assignments: loadingSection(),
    documents: loadingSection()
  });

  // Guards every `set*` call that resumes after an `await` inside
  // `runRefreshCycle`/`save` below — unlike `useAutoRefresh`'s own internal
  // state (which it already guards against firing post-unmount), nothing
  // protected *this* hook's state until now. A refresh or save in flight when
  // the component unmounts would otherwise resolve later and call `setItem`
  // etc. on a dead component — harmless in the browser (React just warns),
  // but fatal in the Jest/jsdom test environment if it fires after that
  // test file's environment has already been torn down.
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Mutable refs so the refresh callback (identity-stable, read by
  // useAutoRefresh) always sees current edit state without needing to be
  // recreated — the same pattern useAutoRefresh itself uses internally.
  const editRef = React.useRef(edit);
  editRef.current = edit;

  // `runRefreshCycle` is memoized against `[itemId, repositories]` only — it
  // must not be recreated on every `item` update, or `useAutoRefresh` would
  // see a new `refresh` identity each cycle. It still needs the *current*
  // `item` (for the documents folder lookup), so that value is read through
  // a ref rather than captured in the callback's closure.
  const itemRef = React.useRef(item);
  itemRef.current = item;

  const runRefreshCycle = React.useCallback(async (): Promise<void> => {
    const [primaryResult, actionsResult, activitiesResult, updatesResult, assignmentsResult, documentsResult] =
      await Promise.allSettled([
        repositories.riskRegistry.getById(itemId),
        loadRelatedSection(() => repositories.actions.getForRisk(itemId)),
        loadRelatedSection(() => repositories.activities.getForRisk(itemId)),
        loadRelatedSection(() => repositories.updates.getForRisk(itemId)),
        loadRelatedSection(() => repositories.assignments.getForRisk(itemId)),
        loadRelatedSection(() =>
          repositories.documents.getForRisk(itemRef.current?.fields.riskId as number | undefined)
        )
      ]);

    if (!isMountedRef.current) {
      return;
    }

    if (primaryResult.status === 'rejected') {
      const kind = classifyLoadError(primaryResult.reason);

      if (kind === 'not-found' || kind === 'access-denied') {
        // The record is gone or no longer visible to this user — showing
        // stale content would be actively misleading, so the fatal state
        // replaces it rather than merely flagging staleness.
        setFatalErrorKind(kind);
        setItem(undefined);
      } else if (!itemRef.current) {
        // No data ever loaded (this was the initial load): surface the error.
        setFatalErrorKind(kind);
      } else {
        // A background refresh failed transiently: keep the previous data on
        // screen and flag it as possibly stale, per the no-blank-the-page rule.
        setIsShowingStaleData(true);
      }

      // Related sections may still have useful data even when the primary
      // record failed this cycle; apply whichever of them succeeded.
      applyRelatedResults();
      return;
    }

    const freshItem = primaryResult.value;
    setFatalErrorKind(undefined);
    setIsShowingStaleData(false);

    if (editRef.current.isEditing) {
      // Never replace values in an active edit form. Only detect whether the
      // server copy has moved on, surfaced as a conflict banner.
      if (freshItem.etag !== editRef.current.baselineEtag) {
        setConflict({ serverItem: freshItem });
      }
    } else {
      setItem(freshItem);
      setEdit((previous) => ({
        ...previous,
        baselineValues: { ...freshItem.fields },
        baselineEtag: freshItem.etag,
        draftValues: { ...freshItem.fields }
      }));
      setConflict(undefined);
    }

    applyRelatedResults();

    function applyRelatedResults(): void {
      setRelatedSections({
        actions: actionsResult.status === 'fulfilled' ? actionsResult.value : errorSection('This information could not be loaded.'),
        activities:
          activitiesResult.status === 'fulfilled' ? activitiesResult.value : errorSection('This information could not be loaded.'),
        updates: updatesResult.status === 'fulfilled' ? updatesResult.value : errorSection('This information could not be loaded.'),
        assignments:
          assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : errorSection('This information could not be loaded.'),
        documents:
          documentsResult.status === 'fulfilled' ? documentsResult.value : errorSection('This information could not be loaded.')
      });
    }
  }, [itemId, repositories]);

  const refreshState = useAutoRefresh({
    refresh: runRefreshCycle,
    configuration: refreshConfiguration
  });

  // Permission check: once per item, independent of the refresh cycle — an
  // edit permission does not change on the cadence business data does.
  React.useEffect(() => {
    let isCancelled = false;
    permissions.canEditItem(listTitle, itemId).then(
      (result) => {
        if (!isCancelled) {
          setCanEdit(result);
        }
      },
      () => {
        if (!isCancelled) {
          setCanEdit(false);
        }
      }
    );
    return () => {
      isCancelled = true;
    };
  }, [itemId, listTitle, permissions]);

  const startEdit = React.useCallback(() => {
    if (!item || canEdit !== true) {
      return;
    }
    setEdit({
      isEditing: true,
      baselineValues: { ...item.fields },
      baselineEtag: item.etag,
      draftValues: { ...item.fields },
      fieldErrors: {},
      isDirty: false,
      isValid: true,
      isSaving: false
    });
    setSaveError(undefined);
  }, [canEdit, item]);

  const cancelEdit = React.useCallback(() => {
    setEdit(EMPTY_EDIT_STATE);
    setSaveError(undefined);
  }, []);

  const setFieldValue = React.useCallback((key: RiskRegistryDataFieldKey, value: RiskRegistryFieldValue) => {
    setEdit((previous) => {
      const draftValues = { ...previous.draftValues, [key]: value };
      const fieldErrors: RiskRegistryFieldErrors = { ...previous.fieldErrors };
      const message = validateFieldValue(key, value);
      if (message) {
        fieldErrors[key] = message;
      } else {
        delete fieldErrors[key];
      }

      // A field's visibility/requiredness can depend on another field's
      // value (see `fieldMetadata.ts`'s `CONDITIONAL_FIELD_RULES`) — re-check
      // every field affected by this change, since the standard
      // single-field check above does not know about those cross-field
      // rules.
      for (const affectedKey of getConditionalFieldKeysAffectedBy(key)) {
        const message = validateConditionalField(affectedKey, draftValues);
        if (message) {
          fieldErrors[affectedKey] = message;
        } else {
          delete fieldErrors[affectedKey];
        }
      }

      const isDirty = computeIsDirty(previous.baselineValues, draftValues);
      const isValid = Object.keys(fieldErrors).length === 0;

      return { ...previous, draftValues, fieldErrors, isDirty, isValid };
    });
  }, []);

  const save = React.useCallback(async (): Promise<boolean> => {
    if (!item) {
      return false;
    }

    const current = editRef.current;
    // A field no longer shown (e.g. the user picked "Other" then changed
    // their selection away from it) should not leave its stale value
    // behind in SharePoint — clear it before validating/saving, not just
    // before rendering.
    const draftValues = clearHiddenFieldValues(current.draftValues);
    const fieldErrors: RiskRegistryFieldErrors = {
      ...validateDraft(draftValues),
      ...validateRequiredFieldsPresent(draftValues),
      ...validateConditionalRequirements(draftValues)
    };

    if (Object.keys(fieldErrors).length > 0) {
      setEdit((previous) => ({ ...previous, fieldErrors, isValid: false }));
      return false;
    }

    setEdit((previous) => ({ ...previous, isSaving: true }));
    setSaveError(undefined);

    try {
      // A Person field just picked this session carries only a directory
      // login until now (see `IRiskRegistryPerson.loginName`) — resolve it
      // to a real SharePoint site user before diffing against the baseline
      // or building the update payload, both of which need the resolved
      // value. Resolution failures (e.g. a transient directory error) are
      // handled by the same catch below as any other save failure.
      const resolvedDraftValues = await resolvePersonFieldsForSave(draftValues, repositories.people);

      // "Risk ID" (the business field) must track the item's own system id —
      // correct it here on every save, not just at creation, in case the two
      // have ever drifted apart (e.g. an older record from before this was
      // enforced, or a manual list edit).
      const correctedDraftValues: RiskRegistryDraftValues =
        resolvedDraftValues.riskId !== item.id ? { ...resolvedDraftValues, riskId: item.id } : resolvedDraftValues;

      const changedFields = computeChangedFields(current.baselineValues, correctedDraftValues);
      if (Object.keys(changedFields).length === 0) {
        // Nothing changed; treat as a no-op success rather than a round trip.
        if (isMountedRef.current) {
          setEdit(EMPTY_EDIT_STATE);
        }
        return true;
      }

      const payload = buildUpdatePayload(changedFields);
      const savedItem = await repositories.riskRegistry.update(item.id, item.etag, payload);

      if (!isMountedRef.current) {
        return true;
      }

      setItem(savedItem);
      setEdit(EMPTY_EDIT_STATE);
      setConflict(undefined);
      // "After a successful save ... refresh immediately and restart the
      // normal interval" — `update()` already re-read the item above; this
      // additionally resets the auto-refresh schedule's own clock so the
      // next automatic cycle is a full interval from the save, not from
      // whenever the pre-edit cycle last ran.
      refreshState.refreshNow();
      return true;
    } catch (error) {
      if (!isMountedRef.current) {
        return false;
      }

      if (error instanceof RiskRegistrySaveConflictError) {
        setConflict({ serverItem: error.serverItem });
        setEdit((previous) => ({ ...previous, isSaving: false }));
        return false;
      }

      setSaveError('This risk record could not be saved. Please try again.');
      setEdit((previous) => ({ ...previous, isSaving: false }));
      return false;
    }
  }, [item, repositories]);

  const reloadFromConflict = React.useCallback(() => {
    if (!conflict) {
      return;
    }
    setItem(conflict.serverItem);
    setEdit(EMPTY_EDIT_STATE);
    setConflict(undefined);
    setSaveError(undefined);
  }, [conflict]);

  const dismissConflict = React.useCallback(() => {
    setConflict(undefined);
  }, []);

  return {
    loadState: fatalErrorKind ? 'fatal-error' : item ? 'loaded' : 'loading',
    errorKind: fatalErrorKind,
    item,
    isShowingStaleData,
    relatedSections,
    canEdit,
    edit,
    saveError,
    conflict,
    startEdit,
    cancelEdit,
    setFieldValue,
    save,
    reloadFromConflict,
    dismissConflict,
    refreshNow: refreshState.refreshNow,
    refreshState
  };
}
