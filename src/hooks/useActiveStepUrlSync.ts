import * as React from 'react';

import { RiskWorkflowStepNumber, buildUrlWithStep } from '../utilities/riskStepParam';

export interface IUseActiveStepUrlSyncResult {
  readonly activeStep: RiskWorkflowStepNumber;
  /** Updates `activeStep` and the page's `step` query-string parameter together, so the two can never drift apart. */
  readonly setActiveStep: (step: RiskWorkflowStepNumber) => void;
}

/**
 * Tracks which step tile is "active" (`WorkflowStepper`'s highlight,
 * `StepFooter`'s Previous/Next), kept in sync with the page's `step`
 * query-string parameter via `history.replaceState` — the same convention
 * `itemIdentifier.ts`'s `buildUrlWithItemId` already uses for the `id`
 * parameter, chosen over a real navigation so a step change never adds a
 * browser-history entry per click, but still survives a page refresh or a
 * copied/shared link.
 */
export function useActiveStepUrlSync(initialStep: RiskWorkflowStepNumber): IUseActiveStepUrlSyncResult {
  const [activeStep, setActiveStepState] = React.useState<RiskWorkflowStepNumber>(initialStep);

  const setActiveStep = React.useCallback((step: RiskWorkflowStepNumber) => {
    setActiveStepState(step);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', buildUrlWithStep(window.location.href, step));
    }
  }, []);

  return { activeStep, setActiveStep };
}
