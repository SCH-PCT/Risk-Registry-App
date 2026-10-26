import { RISK_ACTIONS } from '../../../config/listSchema';
import { IRiskAction } from '../../../models/domain/IRiskRelatedRecord';
import { IRiskActionRepository } from '../IRiskActionRepository';
import { assertRelatedListConfigured } from './unverifiedRelatedListError';

/** See `assertRelatedListConfigured` — `RiskActions`' schema is not yet verified. */
export class PnpRiskActionRepository implements IRiskActionRepository {
  public async getForRisk(_riskItemId: number): Promise<IRiskAction[]> {
    assertRelatedListConfigured(RISK_ACTIONS);
    return [];
  }
}
