import * as React from 'react';
import { PrimaryButton, MessageBar, MessageBarType } from '@fluentui/react';

import { getRiskRegistryDataField, RiskRegistryDataFieldKey } from '../../../config/listSchema';
import { RiskWorkflowStepNumber } from '../../../utilities/riskStepParam';
import { useRiskRegistryCreate } from '../../../hooks/useRiskRegistryCreate';
import { useActiveStepUrlSync } from '../../../hooks/useActiveStepUrlSync';
import { IRiskRegistryDetailRepositories } from '../../../hooks/useRiskRegistryDetail';
import { IWebPermissionsService } from '../../../data/services/IWebPermissionsService';
import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';
import { FormFieldErrorSummary } from '../../../components/common/FormFieldErrorSummary';
import { DETAIL_STEPS } from './detailSections';
import { StepCard } from './StepCard';
import { WorkflowStepper } from './WorkflowStepper';
import { StepFooter } from './StepFooter';
import { PRIMARY_BUTTON_STYLES } from './buttonStyles';
import { fieldDomId, focusField } from './fieldDomId';
import styles from './RiskRegistryDetail.module.scss';

export interface IRiskRegistryDetailNewProps {
  readonly listTitle: string;
  readonly repositories: IRiskRegistryDetailRepositories;
  readonly permissions: IWebPermissionsService;
  /** Which `WorkflowStepper` tile renders in the "selected" style — see `riskStepParam.ts`. */
  readonly selectedStep: RiskWorkflowStepNumber;
  /** Whether every step renders at once (`true`) or only the active tile (`false`) — see `adminViewParam.ts`. */
  readonly isAdminView: boolean;
  /** Called once the item has been created — the caller hands off to the normal view/edit flow. */
  readonly onCreated: (item: IRiskRegistryItem) => void;
}

/**
 * The "blank `id` parameter" state: a form for creating a new
 * `RiskRegistryData` item rather than viewing/editing an existing one.
 *
 * Always rendered in edit mode — there is nothing to view yet. Reuses the
 * same section layout, field renderer and validation as the existing-item
 * form so the two can never drift on what a valid value looks like for a
 * given field. There are deliberately no related-entity sections here: none
 * of them can exist for an item that has not been created yet.
 *
 * The "Risk Identification" step itself is deliberately not rendered here —
 * per explicit confirmation, a new record starts with `riskStatus` defaulted
 * to "New" (see `useRiskRegistryCreate`) and `riskId` backfilled from the
 * item's own system id immediately after creation, so neither needs to be
 * set by hand. The required `title` field ("Risk Title") is still editable
 * here: it is one of Step 1's fields (see `detailSections.ts`), not part of
 * the hidden identification step.
 */
export const RiskRegistryDetailNew: React.FC<IRiskRegistryDetailNewProps> = ({
  listTitle,
  repositories,
  permissions,
  selectedStep,
  isAdminView,
  onCreated
}) => {
  const create = useRiskRegistryCreate({ listTitle, repository: repositories.riskRegistry, people: repositories.people, permissions });

  // Shared between `WorkflowStepper` (tile highlight) and `StepFooter`
  // (Previous/Next), matching `RiskRegistryDetail.tsx`'s existing-item flow.
  const { activeStep, setActiveStep } = useActiveStepUrlSync(selectedStep);

  const handleCreateClick = (): void => {
    create.create().then((item) => {
      if (item) {
        onCreated(item);
      }
    }).catch(() => {
      // `create()` resolves `undefined` and sets `saveError`/field errors for
      // every handled failure; this catch is a backstop against an
      // unexpected rejection only, so the page never shows an unhandled
      // promise rejection to the user.
    });
  };

  const fieldErrorList = (Object.keys(create.fieldErrors) as RiskRegistryDataFieldKey[]).map((key) => ({
    fieldKey: key,
    label: getRiskRegistryDataField(key).displayName,
    message: create.fieldErrors[key] as string
  }));

  if (create.canCreate === false) {
    return (
      <MessageBar messageBarType={MessageBarType.error} role="alert">
        You do not have permission to create a new risk record.
      </MessageBar>
    );
  }

  return (
    <div className={styles.root}>
      {create.saveError && (
        <MessageBar messageBarType={MessageBarType.error} role="alert">
          {create.saveError}
        </MessageBar>
      )}

      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleField}>
            <h2>New risk record</h2>
          </div>

          <div className={styles.headerActions}>
            <PrimaryButton
              text={create.isSaving ? 'Creating…' : 'Create'}
              onClick={handleCreateClick}
              disabled={create.isSaving || create.canCreate !== true}
              styles={PRIMARY_BUTTON_STYLES}
            />
          </div>
        </div>

        <WorkflowStepper
          riskStatus={typeof create.draftValues.riskStatus === 'string' ? create.draftValues.riskStatus : undefined}
          activeStep={activeStep}
          onStepChange={setActiveStep}
        />
      </header>

      {fieldErrorList.length > 0 && (
        <FormFieldErrorSummary errors={fieldErrorList} onFocusField={(key) => focusField(key as RiskRegistryDataFieldKey)} />
      )}

      <div className={styles.sections}>
        {/* See `RiskRegistryDetail.tsx`'s matching comment — only the active step's section renders unless `adminview=true`. */}
        {(isAdminView ? DETAIL_STEPS : DETAIL_STEPS.filter((step) => step.stepNumber === activeStep)).map((step) => (
          <StepCard
            key={step.id}
            step={step}
            mode="edit"
            values={create.draftValues}
            fieldErrors={create.fieldErrors}
            onFieldChange={create.setFieldValue}
            riskBusinessId={typeof create.draftValues.riskId === 'number' ? create.draftValues.riskId : undefined}
            documents={repositories.documents}
            people={repositories.people}
            isCreateMode
            onSectionSubmit={handleCreateClick}
            isSectionSubmitDisabled={create.isSaving || create.canCreate !== true}
          />
        ))}
      </div>

      <StepFooter
        activeStep={activeStep}
        onStepChange={setActiveStep}
        onSubmit={handleCreateClick}
        submitLabel={create.isSaving ? 'Submitting…' : 'Submit'}
        isSubmitDisabled={create.isSaving || create.canCreate !== true}
      />
    </div>
  );
};

export default RiskRegistryDetailNew;

// Re-exported so tests can locate a given field's input without importing
// the internal helper module directly, matching `RiskRegistryDetail.tsx`.
export { fieldDomId };
