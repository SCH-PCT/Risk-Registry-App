import * as React from 'react';
import { PrimaryButton, DefaultButton, MessageBar, MessageBarType } from '@fluentui/react';

import { getRiskRegistryDataField, RiskRegistryDataFieldKey } from '../../../config/listSchema';
import { useRiskRegistryDetail } from '../../../hooks/useRiskRegistryDetail';
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning';
import { useActiveStepUrlSync } from '../../../hooks/useActiveStepUrlSync';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { FormFieldErrorSummary } from '../../../components/common/FormFieldErrorSummary';
import { PermissionAwareAction } from '../../../components/common/PermissionAwareAction';
import { GoBackButton } from '../../../components/common/GoBackButton';
import { RefreshStatus } from '../../../components/feedback/RefreshStatus';
import { RefreshNowButton } from '../../../components/feedback/RefreshNowButton';
import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';
import { RiskWorkflowStepNumber } from '../../../utilities/riskStepParam';
import { IRiskRegistryDetailProps } from './IRiskRegistryDetailProps';
import { DETAIL_STEPS } from './detailSections';
import { StepCard } from './StepCard';
import { WorkflowStepper } from './WorkflowStepper';
import { StepFooter } from './StepFooter';
import { FieldRenderer } from './FieldRenderer';
import { ConflictBanner } from './ConflictBanner';
import { RiskRegistryDetailNew } from './RiskRegistryDetailNew';
import { PRIMARY_BUTTON_STYLES, SECONDARY_BUTTON_STYLES } from './buttonStyles';
import { fieldDomId, focusField } from './fieldDomId';
import { buildUrlWithItemId } from '../../../utilities/itemIdentifier';
import styles from './RiskRegistryDetail.module.scss';

const RiskRegistryDetailLoaded: React.FC<IRiskRegistryDetailProps & { itemId: number }> = ({
  itemId,
  repositories,
  permissions,
  listTitle,
  refreshConfiguration,
  showLastRefreshed,
  selectedStep,
  isAdminView,
  goBackUrl
}) => {
  const detail = useRiskRegistryDetail({ itemId, listTitle, repositories, permissions, refreshConfiguration });

  useUnsavedChangesWarning(detail.edit.isEditing && detail.edit.isDirty);

  // Shared between `WorkflowStepper` (tile highlight) and `StepFooter`
  // (Previous/Next) so the two controls can never disagree about which
  // step is current. Also keeps the page's `step` URL parameter in sync —
  // see `useActiveStepUrlSync`.
  const { activeStep, setActiveStep } = useActiveStepUrlSync(selectedStep);

  const [pendingCancel, setPendingCancel] = React.useState(false);
  // The step the user tried to navigate to while mid-edit with unsaved
  // changes — set only long enough to show the Save/Discard/Cancel prompt
  // below; `undefined` means no such prompt is pending.
  const [pendingStepChange, setPendingStepChange] = React.useState<RiskWorkflowStepNumber | undefined>(undefined);
  const [liveMessage, setLiveMessage] = React.useState('');

  const manualRefreshRequestedRef = React.useRef(false);
  const lastAnnouncedCompletionRef = React.useRef<number | undefined>(undefined);

  // Announce only the refreshes the user explicitly asked for via "Refresh
  // now" — not every automatic background cycle, per the requirement that
  // routine polling stays silent to assistive technology.
  React.useEffect(() => {
    const completedAt = detail.refreshState.lastRefreshCompleted?.getTime();
    if (
      manualRefreshRequestedRef.current &&
      completedAt !== undefined &&
      completedAt !== lastAnnouncedCompletionRef.current
    ) {
      manualRefreshRequestedRef.current = false;
      lastAnnouncedCompletionRef.current = completedAt;
      setLiveMessage('Risk record refreshed.');
    }
  }, [detail.refreshState.lastRefreshCompleted]);

  const handleManualRefresh = (): void => {
    manualRefreshRequestedRef.current = true;
    detail.refreshNow();
  };

  if (detail.loadState === 'fatal-error' && detail.errorKind) {
    return (
      <ErrorState
        kind={detail.errorKind}
        onRetry={detail.errorKind === 'transient' ? detail.refreshNow : undefined}
        itemId={itemId}
        showGoBackLink
        goBackUrl={goBackUrl}
      />
    );
  }

  if (detail.loadState === 'loading' || !detail.item) {
    return <LoadingState label="Loading risk record…" />;
  }

  const mode: 'read' | 'edit' = detail.edit.isEditing ? 'edit' : 'read';
  const values = detail.edit.isEditing ? detail.edit.draftValues : detail.item.fields;

  const handleCancelClick = (): void => {
    if (detail.edit.isDirty) {
      setPendingCancel(true);
    } else {
      detail.cancelEdit();
    }
  };

  const handleSaveClick = (): void => {
    detail.save().catch(() => {
      // `save()` resolves `false` and sets `saveError`/field errors for
      // every handled failure; this catch is a backstop against an
      // unexpected rejection only, so the page never shows an unhandled
      // promise rejection to the user.
    });
  };

  /**
   * Guards every step-tile / Previous / Next click: if there are unsaved
   * edits, the step does not change yet — `pendingStepChange` opens a
   * Save/Discard/Cancel prompt instead (below) — matching `handleCancelClick`'s
   * existing "Discard changes?" prompt for the same underlying risk (losing
   * edits without a clear choice to save them first).
   */
  const handleStepChangeRequest = (step: RiskWorkflowStepNumber): void => {
    if (step === activeStep) {
      return;
    }
    if (detail.edit.isEditing && detail.edit.isDirty) {
      setPendingStepChange(step);
    } else {
      setActiveStep(step);
    }
  };

  const handleSaveAndChangeStep = (): void => {
    const step = pendingStepChange;
    setPendingStepChange(undefined);
    if (step === undefined) {
      return;
    }
    detail
      .save()
      .then((success) => {
        if (success) {
          setActiveStep(step);
        }
        // A failed save already surfaces via `detail.saveError`/field
        // errors (same as the header's Save button) — the user stays on
        // the current step to see and fix it, rather than being moved away
        // from the invalid edit.
      })
      .catch(() => {
        // Backstop against an unexpected rejection only, matching `handleSaveClick`.
      });
  };

  const handleDiscardAndChangeStep = (): void => {
    const step = pendingStepChange;
    setPendingStepChange(undefined);
    if (step === undefined) {
      return;
    }
    detail.cancelEdit();
    setActiveStep(step);
  };

  const fieldErrorList = (Object.keys(detail.edit.fieldErrors) as RiskRegistryDataFieldKey[]).map((key) => ({
    fieldKey: key,
    label: getRiskRegistryDataField(key).displayName,
    message: detail.edit.fieldErrors[key] as string
  }));

  return (
    <div className={styles.root}>
      <div role="status" aria-live="polite" className={styles.visuallyHiddenLive}>
        {liveMessage}
      </div>

      {detail.conflict && (
        <ConflictBanner onReload={detail.reloadFromConflict} onKeepEditing={detail.dismissConflict} />
      )}

      {detail.saveError && (
        <MessageBar messageBarType={MessageBarType.error} role="alert">
          {detail.saveError}
        </MessageBar>
      )}

      <header className={styles.header}>
        <GoBackButton goBackUrl={goBackUrl} />

        <div className={styles.headerTop}>
          <div className={styles.titleField}>
            <FieldRenderer
              fieldKey="title"
              // Always read-only here, regardless of the page's edit/read
              // mode — the header is an identifier banner, not an editing
              // surface. Step 1's instance of this same field (see
              // `detailSections.ts`) is where "Risk Title" is actually
              // edited; both read the same `title` value.
              mode="read"
              value={values.title}
              // Distinct from Step 1's rendering of the same field — both
              // show the same `title` value, but need different DOM ids to
              // avoid an id collision.
              domId={`${fieldDomId('title')}-header`}
              labelOverride={`Risk ID: ${typeof values.riskId === 'number' ? values.riskId : '—'}`}
            />
          </div>

          <div className={styles.headerStatus}>
            <FieldRenderer
              fieldKey="riskStatus"
              mode={mode}
              value={values.riskStatus}
              error={detail.edit.fieldErrors.riskStatus}
              onChange={detail.setFieldValue}
            />
          </div>

          <div className={styles.headerActions}>
            <PermissionAwareAction isPermitted={!detail.edit.isEditing ? detail.canEdit : undefined}>
              <PrimaryButton text="Edit" onClick={detail.startEdit} styles={PRIMARY_BUTTON_STYLES} />
            </PermissionAwareAction>

            {detail.edit.isEditing && (
              <>
                <PrimaryButton
                  text={detail.edit.isSaving ? 'Saving…' : 'Save'}
                  onClick={handleSaveClick}
                  disabled={!detail.edit.isDirty || !detail.edit.isValid || detail.edit.isSaving}
                  styles={PRIMARY_BUTTON_STYLES}
                />
                <DefaultButton
                  text="Cancel"
                  onClick={handleCancelClick}
                  disabled={detail.edit.isSaving}
                  styles={SECONDARY_BUTTON_STYLES}
                />
              </>
            )}
          </div>
        </div>

        <WorkflowStepper
          riskStatus={typeof values.riskStatus === 'string' ? values.riskStatus : undefined}
          activeStep={activeStep}
          onStepChange={handleStepChangeRequest}
        />

        <div className={styles.headerMeta}>
          <div className={styles.refreshRow}>
            <RefreshStatus
              state={detail.refreshState}
              showLastRefreshed={showLastRefreshed}
              isShowingStaleData={detail.isShowingStaleData}
            />
            <RefreshNowButton isRefreshing={detail.refreshState.isBackgroundRefreshing} onRefreshNow={handleManualRefresh} />
          </div>
        </div>
      </header>

      {detail.edit.isEditing && fieldErrorList.length > 0 && (
        <FormFieldErrorSummary errors={fieldErrorList} onFocusField={(key) => focusField(key as RiskRegistryDataFieldKey)} />
      )}

      <div className={styles.sections}>
        {/*
          Per explicit confirmation: with `adminview=true`, every step shows
          at once (the original, always-expanded design). Otherwise, only
          the active step's section renders at all — not just collapsed —
          so the page below the header shows exactly one step.
        */}
        {(isAdminView ? DETAIL_STEPS : DETAIL_STEPS.filter((step) => step.stepNumber === activeStep)).map((step) => (
          <StepCard
            key={step.id}
            step={step}
            mode={mode}
            values={values}
            fieldErrors={detail.edit.fieldErrors}
            onFieldChange={detail.setFieldValue}
            riskBusinessId={typeof values.riskId === 'number' ? values.riskId : undefined}
            riskItemId={itemId}
            documents={repositories.documents}
            people={repositories.people}
            documentsSection={detail.relatedSections.documents}
            onDocumentsChanged={detail.refreshNow}
            onSectionSubmit={handleSaveClick}
            isSectionSubmitDisabled={!detail.edit.isDirty || !detail.edit.isValid || detail.edit.isSaving}
          />
        ))}
      </div>

      <StepFooter
        activeStep={activeStep}
        onStepChange={handleStepChangeRequest}
        onSubmit={handleSaveClick}
        submitLabel={detail.edit.isSaving ? 'Submitting…' : 'Submit'}
        isSubmitDisabled={!detail.edit.isDirty || !detail.edit.isValid || detail.edit.isSaving}
      />

      <ConfirmDialog
        isOpen={pendingCancel}
        title="Discard changes?"
        message="You have unsaved changes on this risk record. Discard them?"
        confirmButtonText="Discard"
        isDestructive
        onConfirm={() => {
          setPendingCancel(false);
          detail.cancelEdit();
        }}
        onCancel={() => setPendingCancel(false)}
      />

      <ConfirmDialog
        isOpen={pendingStepChange !== undefined}
        title="Unsaved changes"
        message="You have unsaved changes on this step. Save them, discard them, or stay here before moving to another step."
        confirmButtonText="Save Changes"
        onConfirm={handleSaveAndChangeStep}
        secondaryButtonText="Discard Changes"
        onSecondaryAction={handleDiscardAndChangeStep}
        isSecondaryDestructive
        cancelButtonText="Stay on This Step"
        onCancel={() => setPendingStepChange(undefined)}
      />
    </div>
  );
};

/**
 * Root component for the Risk Registry Detail web part.
 *
 * Branches three ways on the query-string item identifier (requirement
 * #1-2), without ever calling `useRiskRegistryDetail` for a URL that was
 * never going to resolve to an existing item:
 *
 * - A valid `id` (or an id this component just created — see below) mounts
 *   the existing-item view/edit flow.
 * - A **missing** `id` (`identifierResult.reason === 'missing'`) is treated
 *   as "create a new risk record", not an error — the page has no record
 *   to show yet, but that is an expected, supported state here.
 * - Any other invalid `id` (not a positive integer, out of range, etc.)
 *   still renders the handled `invalid-identifier` state: a present but
 *   malformed value is a bad link, not a request to create something new.
 *
 * Once the creation form successfully creates an item, this component
 * switches straight to the existing-item flow for that new item's id
 * (updating the address bar to match via `history.replaceState`) rather
 * than re-deriving `identifierResult` from a page reload.
 */
export const RiskRegistryDetail: React.FC<IRiskRegistryDetailProps> = (props) => {
  const [createdItemId, setCreatedItemId] = React.useState<number | undefined>(undefined);

  if (props.identifierResult.isValid && props.identifierResult.itemId !== undefined) {
    return <RiskRegistryDetailLoaded {...props} itemId={props.identifierResult.itemId} />;
  }

  if (createdItemId !== undefined) {
    return <RiskRegistryDetailLoaded {...props} itemId={createdItemId} />;
  }

  if (props.identifierResult.reason === 'missing') {
    return (
      <RiskRegistryDetailNew
        listTitle={props.listTitle}
        repositories={props.repositories}
        permissions={props.permissions}
        selectedStep={props.selectedStep}
        isAdminView={props.isAdminView}
        goBackUrl={props.goBackUrl}
        onCreated={(item: IRiskRegistryItem) => {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', buildUrlWithItemId(window.location.href, item.id));
          }
          setCreatedItemId(item.id);
        }}
      />
    );
  }

  return <ErrorState kind="invalid-identifier" showGoBackLink goBackUrl={props.goBackUrl} />;
};

export default RiskRegistryDetail;

// Re-export for tests that need the DOM id convention without importing the
// internal helper module directly.
export { fieldDomId };
