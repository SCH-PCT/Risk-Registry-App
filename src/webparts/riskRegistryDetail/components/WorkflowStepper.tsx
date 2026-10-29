import * as React from 'react';
import { Icon } from '@fluentui/react';

import { RiskWorkflowStepNumber } from '../../../utilities/riskStepParam';
import { stepDomId } from './StepCard';
import styles from './WorkflowStepper.module.scss';

export interface IWorkflowStepperProps {
  readonly riskStatus?: string;
  /** Which tile renders in the "selected" style — see `riskStepParam.ts`. */
  readonly activeStep: RiskWorkflowStepNumber;
  /** Called with a tile's step number when it is clicked. */
  readonly onStepChange: (step: RiskWorkflowStepNumber) => void;
  /**
   * Tiles that render disabled and ignore clicks — used by the "create new"
   * form (`RiskRegistryDetailNew.tsx`) to block Steps 2-4 until the record
   * actually exists. `undefined`/omitted means every tile is clickable,
   * which is always the case for an existing record (view or edit mode).
   */
  readonly disabledSteps?: readonly RiskWorkflowStepNumber[];
}

export interface IStepPill {
  readonly stepNumber: RiskWorkflowStepNumber;
  readonly stepId: string;
  readonly label: string;
  readonly description: string;
  readonly iconName: string;
}

/**
 * The four numbered steps, in order — shared with `StepFooter`, whose
 * Previous/Next buttons walk this same list, so the two controls can never
 * disagree about step order, ids, or how many steps there are.
 */
export const WORKFLOW_STEP_PILLS: readonly IStepPill[] = [
  { stepNumber: 1, stepId: 'intake', label: 'Intake & SBAR', description: 'Frontline reporting & harm data', iconName: 'TextDocument' },
  {
    stepNumber: 2,
    stepId: 'clinical-evaluation',
    label: 'Clinical Evaluation',
    description: 'Severity tier & CQPS priority',
    iconName: 'Health'
  },
  {
    stepNumber: 3,
    stepId: 'vp-assignment',
    label: 'VP Assignment',
    description: 'Executive routing & lead sign-off',
    iconName: 'Permissions'
  },
  { stepNumber: 4, stepId: 'cap', label: 'Action & CAP', description: 'Remediation milestones & closure', iconName: 'Repair' }
];

/**
 * The step-tile row under the record title, matching the design.
 *
 * Which tile renders "selected" is controlled state — `activeStep`/
 * `onStepChange` — owned by the parent (`RiskRegistryDetail.tsx`), not this
 * component, because `StepFooter`'s Previous/Next buttons need to move the
 * same selection and the two controls would drift out of sync if each kept
 * its own copy. `riskStatus` is used only for display: the selected tile's
 * chip shows the record's actual status text instead of a generic
 * "In progress" label.
 */
export const WorkflowStepper: React.FC<IWorkflowStepperProps> = ({ riskStatus, activeStep, onStepChange, disabledSteps }) => {
  const handleClick = (stepId: string, stepNumber: RiskWorkflowStepNumber): void => {
    onStepChange(stepNumber);
    document.getElementById(stepDomId(stepId))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <ul className={styles.stepper}>
      {WORKFLOW_STEP_PILLS.map((pill) => {
        const isActive = pill.stepNumber === activeStep;
        const isDisabled = disabledSteps?.includes(pill.stepNumber) ?? false;
        return (
          <li key={pill.stepId} className={styles.item}>
            <button
              type="button"
              className={`${styles.tile} ${isActive ? styles.active : ''} ${isDisabled ? styles.disabled : ''}`}
              disabled={isDisabled}
              onClick={() => handleClick(pill.stepId, pill.stepNumber)}
            >
              <span className={styles.tileTop}>
                <span className={styles.stepEyebrow}>Step {String(pill.stepNumber).padStart(2, '0')}</span>
                <span className={`${styles.statusChip} ${isActive ? styles.statusChipActive : ''}`}>
                  <Icon iconName={isActive ? 'LightningBolt' : 'Clock'} aria-hidden="true" />
                  {isActive ? riskStatus ?? 'In progress' : 'Pending'}
                </span>
              </span>
              <span className={styles.tileMain}>
                <span className={styles.tileIcon}>
                  <Icon iconName={pill.iconName} aria-hidden="true" />
                </span>
                <span className={styles.tileTitle}>
                  {pill.stepNumber}. {pill.label}
                </span>
              </span>
              <span className={styles.tileDescription}>{pill.description}</span>
              {isActive && <span className={styles.activeBar} aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default WorkflowStepper;
