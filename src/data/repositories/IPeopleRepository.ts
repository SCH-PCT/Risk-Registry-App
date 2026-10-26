import { IRiskRegistryPerson } from '../../models/domain/IRiskRegistryItem';

/** One directory search match, before it has been resolved to a SharePoint site user. */
export interface IPersonSearchResult {
  /** Claims-encoded directory login (e.g. `i:0#.f|membership|user@tenant.onmicrosoft.com`) — the input `ensurePerson` resolves. */
  readonly loginName: string;
  readonly displayName: string;
  readonly email?: string;
}

/**
 * Tenant people search and resolution for Person fields, backed by
 * SharePoint's own people-picker service — which, on SharePoint Online,
 * resolves against the tenant's Azure Entra ID (Azure AD) directory, not a
 * list local to this site. Split from its `pnp`/`mock` implementations into
 * their own files, the same convention every repository interface in this
 * solution follows.
 */
export interface IPeopleRepository {
  /**
   * Searches the tenant directory for people matching `query`. Returns an
   * empty list for a too-short query or a failed search — a slow/unavailable
   * directory degrades to "no matches" rather than an error interrupting the
   * edit form.
   */
  searchPeople(query: string): Promise<IPersonSearchResult[]>;

  /**
   * Resolves a directory pick (`loginName`) to this site's SharePoint user —
   * adding them to the site's User Information List on first use if they are
   * not in it yet. Required before a Person field can be saved: the list
   * item update payload needs a site user id, which a fresh directory search
   * result does not carry.
   */
  ensurePerson(loginName: string): Promise<IRiskRegistryPerson>;
}
