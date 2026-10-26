import { RISK_UPDATES } from '../../../config/listSchema';
import { IRiskUpdateRecord } from '../../../models/domain/IRiskRelatedRecord';
import { IRiskUpdateRepository } from '../IRiskUpdateRepository';
import { assertRelatedListConfigured } from './unverifiedRelatedListError';

/** See `assertRelatedListConfigured` — `RiskUpdates`' schema is not yet verified. */
export class PnpRiskUpdateRepository implements IRiskUpdateRepository {
  public async getForRisk(_riskItemId: number): Promise<IRiskUpdateRecord[]> {
    assertRelatedListConfigured(RISK_UPDATES);
    return [];
  }
}
