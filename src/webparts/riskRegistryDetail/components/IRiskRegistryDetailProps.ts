import { IItemIdentifierResult } from '../../../utilities/itemIdentifier';
import { RiskWorkflowStepNumber } from '../../../utilities/riskStepParam';
import { IRiskRegistryDetailRepositories } from '../../../hooks/useRiskRegistryDetail';
import { IWebPermissionsService } from '../../../data/services/IWebPermissionsService';
import { IRefreshConfiguration } from '../../../state/RefreshCoordinator';

export interface IRiskRegistryDetailProps {
  readonly identifierResult: IItemIdentifierResult;
  readonly repositories: IRiskRegistryDetailRepositories;
  readonly permissions: IWebPermissionsService;
  readonly listTitle: string;
  readonly refreshConfiguration: IRefreshConfiguration;
  readonly showLastRefreshed: boolean;
  /** Which `WorkflowStepper` tile renders in the "selected" style — see `riskStepParam.ts`. */
  readonly selectedStep: RiskWorkflowStepNumber;
  /** Whether every step renders at once (`true`) or only `selectedStep`/the active tile (`false`) — see `adminViewParam.ts`. */
  readonly isAdminView: boolean;
  /** Web-part-property-pane-configured "Go Back" destination — see `GoBackButton`. Blank/undefined falls back to browser history. */
  readonly goBackUrl?: string;
}
