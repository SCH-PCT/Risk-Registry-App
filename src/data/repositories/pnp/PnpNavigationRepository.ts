/**
 * PnPjs implementation of {@link INavigationRepository}.
 *
 * The only place in the navigation feature where OData is composed. Every column name
 * comes from `listSchema.ts` via `requireField`/`optionalField`, so an unverified column
 * fails at build or as a handled configuration error rather than as an opaque
 * SharePoint 400 in front of a user.
 */

import { SPFI } from '@pnp/sp';
import { ISPFXContext } from '@pnp/sp';

import { APP_TOP_NAVIGATION, SYSTEM_FIELDS, optionalField, requireField } from '../../../config/listSchema';
import { INavigationConfiguration } from '../../../models/domain/INavigationItem';
import { INavigationItemDto } from '../../../models/dto/INavigationItemDto';
import { mapNavigationItems } from '../../mappers/navigationMapper';
import { getSp } from '../../services/spContext';
import { INavigationRepository, NavigationError } from '../INavigationRepository';

/**
 * Upper bound on rows fetched.
 *
 * A top navigation with more than this is a configuration mistake, not a use case. The
 * cap also keeps a single runaway list from stalling the top placeholder on every page
 * in the site.
 */
const MAX_NAVIGATION_ROWS = 200;

/** Duck-typed check for a PnPjs `HttpRequestError`. */
function getHttpStatus(error: unknown): number | undefined {
  const candidate = error as { isHttpRequestError?: boolean; status?: number } | undefined;
  return candidate?.isHttpRequestError === true ? candidate.status : undefined;
}

/**
 * Classifies a thrown value so callers can distinguish a misconfigured site from a
 * network blip.
 *
 * A missing list and a denied list both surface as 404/403 from SharePoint, and they
 * need different messages: one is "create the list", the other is "grant read access".
 */
function toNavigationError(error: unknown, listTitle: string): NavigationError {
  if (error instanceof NavigationError) {
    return error;
  }

  const status = getHttpStatus(error);

  if (status === 404) {
    return new NavigationError(
      'list-not-found',
      `The list '${listTitle}' does not exist on this site. ` +
        'Verify the title in listSchema.ts matches the live site, or run ' +
        'scripts/Get-RiskRegistrySchema.ps1 to confirm. See SCHEMA-TODO.md.'
    );
  }

  if (status === 401 || status === 403) {
    return new NavigationError(
      'access-denied',
      `The current user cannot read the list '${listTitle}'.`
    );
  }

  // Everything else — 5xx, 429, offline, DNS — may succeed on a later attempt.
  return new NavigationError(
    'transient',
    `Could not read navigation from '${listTitle}'.` + (status ? ` HTTP ${status}.` : '')
  );
}

/** Reads `appTopNavigation` through PnPjs. */
export class PnpNavigationRepository implements INavigationRepository {
  private readonly _sp: SPFI;
  private readonly _siteAbsoluteUrl: string;

  /**
   * @param context - SPFx context. Typed as `ISPFXContext` so the extension context and
   *   web part contexts share one factory, and so `getSp` keeps a single PnPjs instance
   *   per web rather than one per component.
   */
  public constructor(context: ISPFXContext) {
    this._sp = getSp(context);
    this._siteAbsoluteUrl = context.pageContext.web.absoluteUrl;
  }

  public async getNavigation(): Promise<INavigationConfiguration> {
    const listTitle = APP_TOP_NAVIGATION.title;

    // Resolved before the query so that an undeclared or unverified column throws a
    // configuration error naming the column, not a 400 naming nothing.
    let selectFields: string[];
    let orderByField: string;
    let visibilityFieldName: string | undefined;

    try {
      orderByField = requireField(APP_TOP_NAVIGATION, 'sortOrder');
      visibilityFieldName = optionalField(APP_TOP_NAVIGATION, 'isVisible');

      selectFields = [
        SYSTEM_FIELDS.id,
        requireField(APP_TOP_NAVIGATION, 'linkTitle'),
        requireField(APP_TOP_NAVIGATION, 'linkUrl'),
        requireField(APP_TOP_NAVIGATION, 'parentTitle'),
        orderByField
      ];

      if (visibilityFieldName) {
        selectFields.push(visibilityFieldName);
      }
    } catch (error) {
      throw new NavigationError(
        'invalid-configuration',
        error instanceof Error ? error.message : String(error)
      );
    }

    let rows: INavigationItemDto[];

    try {
      rows = await this._sp.web.lists
        .getByTitle(listTitle)
        .items.select(...selectFields)
        // Server-side ordering on the verified numeric column. The mapper sorts again
        // with an Id tiebreak, because SortOrder is neither required nor unique and
        // SharePoint's order for equal keys is not guaranteed stable.
        .orderBy(orderByField, true)
        .top(MAX_NAVIGATION_ROWS)();
    } catch (error) {
      throw toNavigationError(error, listTitle);
    }

    return mapNavigationItems(rows, {
      siteAbsoluteUrl: this._siteAbsoluteUrl,
      visibilityFieldName
    });
  }
}
