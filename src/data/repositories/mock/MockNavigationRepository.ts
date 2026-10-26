/**
 * In-memory {@link INavigationRepository} for tests and `heft start` without a site.
 *
 * Returns rows through the real mapper rather than hand-built domain objects, so a
 * change to validation shows up here too and the mock cannot drift into describing
 * behaviour the production path does not have.
 */

import { INavigationConfiguration } from '../../../models/domain/INavigationItem';
import { INavigationItemDto } from '../../../models/dto/INavigationItemDto';
import { mapNavigationItems } from '../../mappers/navigationMapper';
import { INavigationRepository, NavigationError } from '../INavigationRepository';

/** Sample rows covering the shapes a real list produces, including a hostile one. */
export const SAMPLE_NAVIGATION_ROWS: readonly INavigationItemDto[] = [
  { Id: 1, Title: 'Risk Register', URL: 'SitePages/RiskRegister.aspx', Parent: null, SortOrder: 10 },
  { Id: 2, Title: 'Actions', URL: 'SitePages/Actions.aspx', Parent: null, SortOrder: 20 },
  { Id: 3, Title: 'Reports', URL: 'SitePages/Reports.aspx', Parent: null, SortOrder: 30 },
  { Id: 4, Title: 'Settings', URL: 'SitePages/Settings.aspx', Parent: null, SortOrder: 40 },
  { Id: 5, Title: 'Risk categories', URL: 'SitePages/RiskCategories.aspx', Parent: 'Settings', SortOrder: 50 },
  // Present on purpose: keeping a hostile value in the default development data means
  // the scheme check is exercised every time anyone runs the solution locally, not only
  // when a test happens to be run. It must never render as a link.
  // eslint-disable-next-line no-script-url -- deliberate hostile fixture; see above
  { Id: 6, Title: 'Injected', URL: 'javascript:alert(1)', Parent: null, SortOrder: 60 }
];

export interface IMockNavigationRepositoryOptions {
  readonly rows?: readonly INavigationItemDto[];
  readonly siteAbsoluteUrl?: string;
  /** Rejects with this instead of returning, for exercising error states. */
  readonly failWith?: NavigationError;
  /** Artificial latency, for observing the loading state. */
  readonly delayMs?: number;
}

export class MockNavigationRepository implements INavigationRepository {
  private readonly _options: IMockNavigationRepositoryOptions;

  /** Number of reads served. Lets a test assert that the cache prevented a refetch. */
  public callCount: number = 0;

  public constructor(options: IMockNavigationRepositoryOptions = {}) {
    this._options = options;
  }

  public async getNavigation(): Promise<INavigationConfiguration> {
    this.callCount += 1;

    if (this._options.delayMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, this._options.delayMs));
    }

    if (this._options.failWith) {
      throw this._options.failWith;
    }

    return mapNavigationItems(this._options.rows ?? SAMPLE_NAVIGATION_ROWS, {
      siteAbsoluteUrl: this._options.siteAbsoluteUrl ?? 'https://contoso.sharepoint.com/sites/RiskRegistry'
    });
  }
}
