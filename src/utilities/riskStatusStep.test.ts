import { mapRiskStatusToStep } from './riskStatusStep';

describe('mapRiskStatusToStep', () => {
  it('maps New to step 1, not terminal', () => {
    expect(mapRiskStatusToStep('New')).toEqual({ stepNumber: 1, isTerminal: false });
  });

  it('maps Evaluation to step 2, not terminal', () => {
    expect(mapRiskStatusToStep('Evaluation')).toEqual({ stepNumber: 2, isTerminal: false });
  });

  it('maps Rejected to step 2, terminal', () => {
    expect(mapRiskStatusToStep('Rejected')).toEqual({ stepNumber: 2, isTerminal: true });
  });

  it('maps Assigned In-Progress to step 4, not terminal', () => {
    expect(mapRiskStatusToStep('Assigned In-Progress')).toEqual({ stepNumber: 4, isTerminal: false });
  });

  it.each(['Corrected - Monitoring', 'Corrected - Unmonitored', 'Corrected - Hard Fix'])(
    'maps %s to step 4, terminal',
    (status) => {
      expect(mapRiskStatusToStep(status)).toEqual({ stepNumber: 4, isTerminal: true });
    }
  );

  it('falls back to step 1, not terminal, for an unset status', () => {
    expect(mapRiskStatusToStep(undefined)).toEqual({ stepNumber: 1, isTerminal: false });
  });

  it('falls back to step 1, not terminal, for an unrecognized status rather than throwing', () => {
    expect(mapRiskStatusToStep('Some Future Status')).toEqual({ stepNumber: 1, isTerminal: false });
  });
});
