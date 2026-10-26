import { IRiskActivity } from '../../models/domain/IRiskRelatedRecord';

/** Read access to the activities related to one risk. Relationship unverified — see SCHEMA-TODO.md. */
export interface IRiskActivityRepository {
  getForRisk(riskItemId: number): Promise<IRiskActivity[]>;
}
