import { RISK_ASSIGNMENTS } from '../../../config/listSchema';
import { IRiskAssignment } from '../../../models/domain/IRiskRelatedRecord';
import { IRiskAssignmentRepository } from '../IRiskAssignmentRepository';
import { assertRelatedListConfigured } from './unverifiedRelatedListError';

/** See `assertRelatedListConfigured` — `RiskAssignments`' schema is not yet verified. */
export class PnpRiskAssignmentRepository implements IRiskAssignmentRepository {
  public async getForRisk(_riskItemId: number): Promise<IRiskAssignment[]> {
    assertRelatedListConfigured(RISK_ASSIGNMENTS);
    return [];
  }
}
