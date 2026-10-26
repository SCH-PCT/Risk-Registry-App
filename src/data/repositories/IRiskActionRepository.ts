import { IRiskAction } from '../../models/domain/IRiskRelatedRecord';

/** Read access to the actions related to one risk. Relationship unverified — see SCHEMA-TODO.md. */
export interface IRiskActionRepository {
  getForRisk(riskItemId: number): Promise<IRiskAction[]>;
}
