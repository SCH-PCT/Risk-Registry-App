/**
 * Best-effort guess at which of the Detail web part's four numbered steps a
 * risk is currently in, from its `RiskStatus` text.
 *
 * `RiskRegistryData` has no field that records a verified "current stage" —
 * `RiskStatus` is a free-standing Choice field, not a pointer into the
 * Intake/Clinical Evaluation/VP Assignment/CAP sequence the design's header
 * stepper visualizes. This is therefore a keyword heuristic, not a fact — the
 * same trade-off `utilities/statusTone.ts#resolveStatusTone` already makes
 * elsewhere in this web part — a wrong guess costs a little visual emphasis
 * on the wrong pill, never incorrect information, since the pill a user
 * actually wants (the literal `RiskStatus` text) is always shown regardless
 * of which one lights up.
 *
 * Order matters: later-stage keywords are checked first, so a status like
 * "CAP Correction In Progress" (which also contains nothing clinical-sounding)
 * still resolves to the CAP step rather than falling through to Intake.
 */
export function resolveActiveWorkflowStep(riskStatus: string | undefined): 1 | 2 | 3 | 4 {
  if (typeof riskStatus !== 'string' || riskStatus.trim().length === 0) {
    return 1;
  }

  const normalized = riskStatus.toLowerCase();

  if (
    normalized.indexOf('cap') !== -1 ||
    normalized.indexOf('correct') !== -1 ||
    normalized.indexOf('mitigat') !== -1 ||
    normalized.indexOf('closure') !== -1 ||
    normalized.indexOf('assessment audit') !== -1 ||
    normalized.indexOf('deferment') !== -1
  ) {
    return 4;
  }

  if (normalized.indexOf('vp') !== -1 || normalized.indexOf('executive') !== -1 || normalized.indexOf('determination') !== -1) {
    return 3;
  }

  if (
    normalized.indexOf('clinical') !== -1 ||
    normalized.indexOf('evaluation') !== -1 ||
    normalized.indexOf('severity') !== -1 ||
    normalized.indexOf('cqps') !== -1
  ) {
    return 2;
  }

  return 1;
}
