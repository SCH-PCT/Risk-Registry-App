/**
 * PnPjs implementation of {@link IRiskRegistryRepository}.
 *
 * Every column name comes from `RISK_REGISTRY_DATA_FIELDS` via `requireField`
 * — see `config/listSchema.ts`. Unlike the navigation list, every field here
 * is verified, so `requireField` succeeds for all of them today; it still
 * guards future additions to the catalog from shipping unverified.
 */

import { SPFI } from '@pnp/sp';
import { ISPFXContext } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';

import {
  RISK_REGISTRY_DATA,
  RISK_REGISTRY_DATA_FIELDS,
  RiskRegistryDataFieldKey,
  SYSTEM_FIELDS,
  requireField
} from '../../../config/listSchema';
import { extractEtag, mapRiskRegistryItem } from '../../mappers/riskRegistryMapper';
import { IRiskRegistryItemDto, RiskRegistryRawFieldValue } from '../../../models/dto/IRiskRegistryItemDto';
import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';
import { getSp } from '../../services/spContext';
import { IRiskRegistryRepository, RiskRegistryError, RiskRegistrySaveConflictError } from '../IRiskRegistryRepository';

/** Internal names of the three People fields, which need `$expand`. */
const PERSON_FIELD_KEYS: readonly RiskRegistryDataFieldKey[] = (
  Object.keys(RISK_REGISTRY_DATA_FIELDS) as RiskRegistryDataFieldKey[]
).filter((key) => RISK_REGISTRY_DATA_FIELDS[key].type === 'User');

function getHttpStatus(error: unknown): number | undefined {
  const candidate = error as { isHttpRequestError?: boolean; status?: number } | undefined;
  return candidate?.isHttpRequestError === true ? candidate.status : undefined;
}

function toRiskRegistryError(error: unknown): RiskRegistryError {
  if (error instanceof RiskRegistryError) {
    return error;
  }

  const status = getHttpStatus(error);

  if (status === 404) {
    return new RiskRegistryError('not-found', 'The risk record was not found.');
  }

  if (status === 401 || status === 403) {
    return new RiskRegistryError('access-denied', 'The current user cannot access this risk record.');
  }

  if (status === 400) {
    return new RiskRegistryError(
      'invalid-configuration',
      'The risk record could not be read because of a site configuration problem.'
    );
  }

  return new RiskRegistryError('transient', 'The risk record could not be reached.');
}

function buildSelectAndExpand(): { readonly select: string[]; readonly expand: string[] } {
  const select: string[] = [SYSTEM_FIELDS.id, SYSTEM_FIELDS.modified];
  const expand: string[] = [];

  for (const key of Object.keys(RISK_REGISTRY_DATA_FIELDS) as RiskRegistryDataFieldKey[]) {
    const internalName = requireField(RISK_REGISTRY_DATA, key);

    if (PERSON_FIELD_KEYS.indexOf(key) !== -1) {
      select.push(`${internalName}/Id`, `${internalName}/Title`, `${internalName}/EMail`);
      expand.push(internalName);
    } else {
      select.push(internalName);
    }
  }

  return { select, expand };
}

export class PnpRiskRegistryRepository implements IRiskRegistryRepository {
  private readonly _sp: SPFI;

  public constructor(context: ISPFXContext) {
    this._sp = getSp(context);
  }

  public async getById(itemId: number): Promise<IRiskRegistryItem> {
    const { select, expand } = buildSelectAndExpand();
    const listTitle = RISK_REGISTRY_DATA.title;

    let raw: Record<string, unknown>;

    try {
      raw = (await this._sp.web.lists
        .getByTitle(listTitle)
        .items.getById(itemId)
        .select(...select)
        .expand(...expand)()) as unknown as Record<string, unknown>;
    } catch (error) {
      throw toRiskRegistryError(error);
    }

    const etag = extractEtag(raw);
    if (!etag) {
      throw new RiskRegistryError(
        'invalid-configuration',
        'The risk record was read, but no concurrency token (ETag) was returned.'
      );
    }

    return mapRiskRegistryItem({ item: raw as unknown as IRiskRegistryItemDto, etag });
  }

  public async update(
    itemId: number,
    etag: string,
    payload: Readonly<Record<string, RiskRegistryRawFieldValue>>
  ): Promise<IRiskRegistryItem> {
    const listTitle = RISK_REGISTRY_DATA.title;

    try {
      await this._sp.web.lists.getByTitle(listTitle).items.getById(itemId).update(payload, etag);
    } catch (error) {
      const status = getHttpStatus(error);

      if (status === 412) {
        // ETag mismatch: read the current server copy so the caller can show
        // what changed, rather than overwriting it.
        const serverItem = await this.getById(itemId);
        throw new RiskRegistrySaveConflictError(serverItem);
      }

      throw toRiskRegistryError(error);
    }

    // A successful write triggers an item-level refresh, not a redundant
    // full-dataset reload — this re-read is that refresh, and its new ETag
    // is what the edit form re-bases its concurrency check on.
    return this.getById(itemId);
  }

  public async create(payload: Readonly<Record<string, RiskRegistryRawFieldValue>>): Promise<IRiskRegistryItem> {
    const listTitle = RISK_REGISTRY_DATA.title;

    let raw: Record<string, unknown>;

    try {
      raw = (await this._sp.web.lists.getByTitle(listTitle).items.add(payload)) as unknown as Record<string, unknown>;
    } catch (error) {
      throw toRiskRegistryError(error);
    }

    const newItemId = raw.Id;
    if (typeof newItemId !== 'number') {
      throw new RiskRegistryError(
        'invalid-configuration',
        'The risk record was created, but no item id was returned.'
      );
    }

    // Re-read through the same path `getById` uses rather than mapping the
    // `add()` response directly — `add()` does not `$expand` the Person
    // fields the way `getById`'s select/expand does, so a direct map would
    // silently drop them from the item this returns.
    return this.getById(newItemId);
  }
}
