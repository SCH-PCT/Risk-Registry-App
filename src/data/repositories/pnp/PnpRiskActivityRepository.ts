import { RISK_ACTIVITIES } from '../../../config/listSchema';
import { IRiskActivity } from '../../../models/domain/IRiskRelatedRecord';
import { IRiskActivityRepository } from '../IRiskActivityRepository';
import { assertRelatedListConfigured } from './unverifiedRelatedListError';

/** See `assertRelatedListConfigured` — `RiskActivities`' schema is not yet verified. */
export class PnpRiskActivityRepository implements IRiskActivityRepository {
  public async getForRisk(_riskItemId: number): Promise<IRiskActivity[]> {
    assertRelatedListConfigured(RISK_ACTIVITIES);
    return [];
  }
}
