import { IRiskRegistryListRepository } from '../../../data/repositories/IRiskRegistryListRepository';
import { IRefreshConfiguration } from '../../../state/RefreshCoordinator';

export interface IRiskRegistryListProps {
  readonly repository: IRiskRegistryListRepository;
  readonly refreshConfiguration: IRefreshConfiguration;
  readonly showLastRefreshed: boolean;
  /**
   * Absolute URL of the page hosting the Risk Registry Detail web part, or
   * `undefined` when not configured. When set, cards link to
   * `{detailPageUrl}?id={item id}` and "New Risk Intake" links to
   * `{detailPageUrl}` (blank `id` — the Detail web part's existing
   * "create new" state). When `undefined`, cards and the New Risk Intake
   * button render without a link rather than guessing a destination.
   */
  readonly detailPageUrl: string | undefined;
  /** Absolute URL of the host web — used to build each card's Accountable Executive photo via `userphoto.aspx`. */
  readonly webAbsoluteUrl: string;
}
