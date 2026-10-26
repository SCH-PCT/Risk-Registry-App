/**
 * PnPjs implementation of {@link IPeopleRepository}.
 *
 * Both operations call SharePoint's own people-picker web service
 * (`SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface`, wrapped by
 * PnPjs as `sp.profiles.clientPeoplePickerSearchUser`/`sp.web.ensureUser`) —
 * on SharePoint Online this always resolves against the tenant's Azure
 * Entra ID directory, never a local list, so no separate Graph wiring is
 * needed to search "our tenant" specifically.
 */

import { SPFI, ISPFXContext } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/site-users/web';
import '@pnp/sp/profiles';
import { PrincipalType, PrincipalSource } from '@pnp/sp/types';

import { IRiskRegistryPerson } from '../../../models/domain/IRiskRegistryItem';
import { getSp } from '../../services/spContext';
import { IPeopleRepository, IPersonSearchResult } from '../IPeopleRepository';

/** Below this length the picker shows too many irrelevant matches to be useful, and a single character is expensive to search on. */
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 10;

export class PnpPeopleRepository implements IPeopleRepository {
  private readonly _sp: SPFI;

  public constructor(context: ISPFXContext) {
    this._sp = getSp(context);
  }

  public async searchPeople(query: string): Promise<IPersonSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return [];
    }

    try {
      const entities = await this._sp.profiles.clientPeoplePickerSearchUser({
        QueryString: trimmed,
        MaximumEntitySuggestions: MAX_SUGGESTIONS,
        PrincipalType: PrincipalType.User,
        PrincipalSource: PrincipalSource.All,
        AllowEmailAddresses: true
      });

      // `DisplayText` is the user's full name. `EntityData.Title`, despite its
      // name, is the directory job-title field (e.g. "Software Engineer"),
      // not a display-name fallback — using it here would show the job title
      // as the picker's main line instead of the person's name.
      return entities.map((entity) => ({
        loginName: entity.Key,
        displayName: entity.DisplayText,
        email: entity.EntityData?.Email || undefined
      }));
    } catch {
      return [];
    }
  }

  public async ensurePerson(loginName: string): Promise<IRiskRegistryPerson> {
    const user = await this._sp.web.ensureUser(loginName);
    return {
      id: user.Id,
      displayName: user.Title,
      email: user.Email || undefined
    };
  }
}
