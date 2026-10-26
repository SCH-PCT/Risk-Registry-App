import { IRiskAssignment } from '../../models/domain/IRiskRelatedRecord';

/** Read access to the assignments related to one risk. Relationship unverified — see SCHEMA-TODO.md. */
export interface IRiskAssignmentRepository {
  getForRisk(riskItemId: number): Promise<IRiskAssignment[]>;
}
