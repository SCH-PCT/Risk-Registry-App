/**
 * PnPjs implementation of {@link IRiskRegistryListRepository}.
 *
 * Selects a deliberately narrow column subset — only what the List web
 * part's cards and KPI tiles render — rather than the Detail web part's full
 * ~70-column catalog. Every internal name still resolves through
 * `requireField`, so an unverified column fails as a handled
 * `invalid-configuration` error rather than a raw 400.
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
import { mapRiskRegistryItem } from '../../mappers/riskRegistryMapper';
import { IRiskRegistryItemDto } from '../../../models/dto/IRiskRegistryItemDto';
import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';
import { getSp } from '../../services/spContext';
import { IRiskRegistryListRepository } from '../IRiskRegistryListRepository';
import { RiskRegistryError } from '../IRiskRegistryRepository';

/**
 * The only `RiskRegistryData` fields the List web part's cards/KPIs read.
 * Keep in sync with what `RiskRegistryList.tsx` actually renders — adding a
 * card field means adding its key here, not widening to the full catalog.
 */
const LIST_FIELD_KEYS: readonly RiskRegistryDataFieldKey[] = [
  'title',
  'riskId',
  'riskStatus',
  'riskPriorityRating',
  'hasHarmToPatientVisitorWorkforce',
  'anticipatedResourceForCorrection',
  'microSystem',
  'mesoSystem',
  'assignedToDepartment',
  'accountableExecutive'
];

/** Upper bound on how many items one refresh cycle fetches. See the interface doc for the reasoning. */
const MAX_ITEMS = 2000;

function getHttpStatus(error: unknown): number | undefined {
  const candidate = error as { isHttpRequestError?: boolean; status?: number } | undefined;
  return candidate?.isHttpRequestError === true ? candidate.status : undefined;
}

function toRiskRegistryError(error: unknown): RiskRegistryError {
  if (error instanceof RiskRegistryError) {
    return error;
  }

  const status = getHttpStatus(error);

  if (status === 401 || status === 403) {
    return new RiskRegistryError('access-denied', 'The current user cannot access the risk registry.');
  }

  if (status === 400) {
    return new RiskRegistryError(
      'invalid-configuration',
      'The risk registry could not be read because of a site configuration problem.'
    );
  }

  return new RiskRegistryError('transient', 'The risk registry could not be reached.');
}

function buildSelectAndExpand(): { readonly select: string[]; readonly expand: string[] } {
  const select: string[] = [SYSTEM_FIELDS.id, SYSTEM_FIELDS.modified, SYSTEM_FIELDS.created];
  const expand: string[] = [];

  const authorInternalName = SYSTEM_FIELDS.createdBy;
  select.push(`${authorInternalName}/Id`, `${authorInternalName}/Title`, `${authorInternalName}/EMail`);
  expand.push(authorInternalName);

  for (const key of LIST_FIELD_KEYS) {
    const internalName = requireField(RISK_REGISTRY_DATA, key);

    if (RISK_REGISTRY_DATA_FIELDS[key].type === 'User') {
      select.push(`${internalName}/Id`, `${internalName}/Title`, `${internalName}/EMail`);
      expand.push(internalName);
    } else {
      select.push(internalName);
    }
  }

  return { select, expand };
}

export class PnpRiskRegistryListRepository implements IRiskRegistryListRepository {
  private readonly _sp: SPFI;

  public constructor(context: ISPFXContext) {
    this._sp = getSp(context);
  }

  public async getAll(): Promise<IRiskRegistryItem[]> {
    const { select, expand } = buildSelectAndExpand();
    const listTitle = RISK_REGISTRY_DATA.title;

    let raw: Record<string, unknown>[];

    try {
      raw = (await this._sp.web.lists
        .getByTitle(listTitle)
        .items.select(...select)
        .expand(...expand)
        .orderBy(SYSTEM_FIELDS.id, false)
        .top(MAX_ITEMS)()) as unknown as Record<string, unknown>[];
    } catch (error) {
      throw toRiskRegistryError(error);
    }

    // No etag: the List web part only ever reads these items for display —
    // nothing here calls `IRiskRegistryRepository.update`, so there is no
    // concurrency token to carry. `mapRiskRegistryItem` treats a missing
    // etag as `''`.
    return raw.map((item) => mapRiskRegistryItem({ item: item as unknown as IRiskRegistryItemDto, etag: undefined }));
  }
}
