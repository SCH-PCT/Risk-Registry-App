/**
 * Maps the real `riskStatus` Choice field (`listSchema.ts`) onto the same
 * four-step workflow the Detail web part's `WorkflowStepper` shows (Intake →
 * Clinical Evaluation → VP Assignment → CAP), for the List web part's
 * per-card step progress indicator.
 *
 * `RiskWorkflowStepNumber` already exists for this exact four-step model —
 * reused here rather than inventing a parallel numbering.
 */

import { RiskWorkflowStepNumber } from './riskStepParam';

export interface IRiskStatusStepInfo {
  /** The furthest step this status reflects. */
  readonly stepNumber: RiskWorkflowStepNumber;
  /** True once the record has left the active workflow (corrected or rejected) — every step renders complete. */
  readonly isTerminal: boolean;
}

const STEP_BY_STATUS: Readonly<Record<string, IRiskStatusStepInfo>> = {
  New: { stepNumber: 1, isTerminal: false },
  Evaluation: { stepNumber: 2, isTerminal: false },
  Rejected: { stepNumber: 2, isTerminal: true },
  'Pending Assignment': { stepNumber: 3, isTerminal: false },
  'Deferred Risk Accepted': { stepNumber: 3, isTerminal: true },
  'Assigned In-Progress': { stepNumber: 4, isTerminal: false },
  'Corrected - Monitoring': { stepNumber: 4, isTerminal: true },
  'Corrected - Unmonitored': { stepNumber: 4, isTerminal: true },
  'Corrected - Hard Fix': { stepNumber: 4, isTerminal: true }
};

const DEFAULT_STEP_INFO: IRiskStatusStepInfo = { stepNumber: 1, isTerminal: false };

/** Never throws — an unrecognized or missing status falls back to step 1, not-terminal. */
export function mapRiskStatusToStep(riskStatus: string | undefined): IRiskStatusStepInfo {
  if (!riskStatus) {
    return DEFAULT_STEP_INFO;
  }
  return STEP_BY_STATUS[riskStatus] ?? DEFAULT_STEP_INFO;
}
