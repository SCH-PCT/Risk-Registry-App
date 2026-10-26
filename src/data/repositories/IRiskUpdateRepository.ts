import { IRiskUpdateRecord } from '../../models/domain/IRiskRelatedRecord';

/** Read access to the periodic updates related to one risk. Relationship unverified — see SCHEMA-TODO.md. */
export interface IRiskUpdateRepository {
  getForRisk(riskItemId: number): Promise<IRiskUpdateRecord[]>;
}
