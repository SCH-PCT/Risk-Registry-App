import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/security';
import { PermissionKind } from '@pnp/sp/security';

import { IWebPermissionsService } from '../IWebPermissionsService';

export class PnpWebPermissionsService implements IWebPermissionsService {
  private readonly _sp: SPFI;

  public constructor(sp: SPFI) {
    this._sp = sp;
  }

  public async canEditItem(listTitle: string, itemId: number): Promise<boolean> {
    try {
      const effectivePermissions = await this._sp.web.lists
        .getByTitle(listTitle)
        .items.getById(itemId)
        .getCurrentUserEffectivePermissions();

      return this._sp.web.hasPermissions(effectivePermissions, PermissionKind.EditListItems);
    } catch {
      // A failed permission check must never be treated as "permitted" —
      // the safer default is to hide the control and let a user who should
      // have access retry rather than risk showing Edit to someone who
      // should not.
      return false;
    }
  }

  public async canAddItems(listTitle: string): Promise<boolean> {
    try {
      const effectivePermissions = await this._sp.web.lists
        .getByTitle(listTitle)
        .getCurrentUserEffectivePermissions();

      return this._sp.web.hasPermissions(effectivePermissions, PermissionKind.AddListItems);
    } catch {
      return false;
    }
  }
}
