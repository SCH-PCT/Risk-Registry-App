import * as React from 'react';
import { Icon } from '@fluentui/react';

import { RiskWorkflowStepNumber } from '../../../utilities/riskStepParam';
import { WORKFLOW_STEP_PILLS } from './WorkflowStepper';
import { stepDomId } from './StepCard';
import styles from './StepFooter.module.scss';

export interface IStepFooterProps {
  /** Mirrors `WorkflowStepper`'s `activeStep` — the two stay in sync via the same parent-owned state. */
  readonly activeStep: RiskWorkflowStepNumber;
  readonly onStepChange: (step: RiskWorkflowStepNumber) => void;
  readonly onSubmit: () => void;
  readonly submitLabel: string;
  readonly isSubmitDisabled: boolean;
}

const MIN_STEP: RiskWorkflowStepNumber = 1;
const MAX_STEP: RiskWorkflowStepNumber = 4;

/**
 * Sticky bottom action bar matching the design — Previous / Submit / Next
 * Step. Previous and Next walk the same ordered step list `WorkflowStepper`
 * renders as tiles (`WORKFLOW_STEP_PILLS`), moving the same `activeStep`
 * selection a tile click would, so the header stepper and this bar can
 * never disagree about which step is current.
 *
 * `onSubmit`/`submitLabel`/`isSubmitDisabled` are supplied by the caller
 * rather than hard-coded here, because what "Submit" does differs between
 * the existing-item view (saves edits) and the new-item form (creates the
 * record) — this component only owns the step-navigation half of the bar.
 */
export const StepFooter: React.FC<IStepFooterProps> = ({
  activeStep,
  onStepChange,
  onSubmit,
  submitLabel,
  isSubmitDisabled
}) => {
  const goToStep = (step: RiskWorkflowStepNumber): void => {
    onStepChange(step);
    const pill = WORKFLOW_STEP_PILLS.find((candidate) => candidate.stepNumber === step);
    if (pill) {
      document.getElementById(stepDomId(pill.stepId))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.side}>
        <button
          type="button"
          className={styles.previousButton}
          disabled={activeStep <= MIN_STEP}
          onClick={() => goToStep((activeStep - 1) as RiskWorkflowStepNumber)}
        >
          <Icon iconName="ChevronLeft" aria-hidden="true" />
          Previous
        </button>
      </div>

      <div className={styles.center}>
        <button type="button" className={styles.submitButton} disabled={isSubmitDisabled} onClick={onSubmit}>
          <Icon iconName="CheckMark" aria-hidden="true" />
          {submitLabel}
        </button>
      </div>

      <div className={`${styles.side} ${styles.sideEnd}`}>
        <button
          type="button"
          className={styles.nextButton}
          disabled={activeStep >= MAX_STEP}
          onClick={() => goToStep((activeStep + 1) as RiskWorkflowStepNumber)}
        >
          Next Step
          <Icon iconName="ChevronRight" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
};

export default StepFooter;
