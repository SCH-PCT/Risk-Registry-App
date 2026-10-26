/**
 * Effective-permissions check for the Detail web part's Edit/Save controls.
 *
 * This is a UI convenience that decides what to render — it is **not** the
 * access-control boundary. SharePoint enforces the real read/write
 * permission on every request regardless of what this returns; hiding a
 * control here is never the only control, per the solution-wide security
 * rule (see SECURITY.md). Failing the check (e.g. the permissions call
 * itself errors) resolves to "not permitted" — fail closed, not open.
 *
 * Split from its `pnp`/`mock` implementations into their own files (the same
 * convention every repository interface in this solution follows) so that
 * importing the mock for a test never pulls in PnPjs's ESM-only build — see
 * `pnp/PnpWebPermissionsService.ts` for why that matters.
 */
export interface IWebPermissionsService {
  /** True when the current user can edit the given `RiskRegistryData` item. */
  canEditItem(listTitle: string, itemId: number): Promise<boolean>;

  /** True when the current user can add a new item to the given list (no item exists yet to check). */
  canAddItems(listTitle: string): Promise<boolean>;
}
