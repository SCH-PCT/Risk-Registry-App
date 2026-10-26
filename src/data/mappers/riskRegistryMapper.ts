/**
 * Converts between `RiskRegistryData` wire shapes and the application's
 * domain model. The field catalog (`config/listSchema.ts`) drives every
 * conversion here — there is no second, hand-written list of field names to
 * drift from it.
 *
 * ## People fields
 *
 * `EvaluatorAssigned`, `AccountableExecutive` and `AssignedtoCommitteeDepartmentRep`
 * are both read AND written here. A write needs the SharePoint site user id
 * (resolved from a tenant directory pick via `IPeopleRepository.ensurePerson`
 * — see `personFieldResolution.ts` — before `buildUpdatePayload` is ever
 * called), which is why `buildUpdatePayload` below writes `${InternalName}Id`
 * rather than `${InternalName}` for a `User` field: that is what SharePoint's
 * REST API expects for a single-value Person field update, a different key
 * shape `mapFieldToDto`'s uniform "one value in, one value out" signature
 * cannot express for every other field type.
 */

import {
  getRiskRegistryDataField,
  IRiskFieldDefinition,
  RISK_REGISTRY_DATA_FIELDS,
  RiskRegistryDataFieldKey,
  SYSTEM_FIELDS
} from '../../config/listSchema';
import { IRiskRegistryItem, IRiskRegistryPerson, RiskRegistryFieldValue } from '../../models/domain/IRiskRegistryItem';
import { IPersonFieldDto, IRiskRegistryItemDtoWithEtag, RiskRegistryRawFieldValue } from '../../models/dto/IRiskRegistryItemDto';
import { RiskRegistryDraftValues } from '../../models/viewModels/IRiskRegistryEditState';
import { sanitizeNoteText } from '../../utilities/sanitizeHtml';

function isPersonValue(value: RiskRegistryFieldValue): value is IRiskRegistryPerson {
  return typeof value === 'object' && value !== null && 'displayName' in value;
}

function mapPersonFromDto(raw: RiskRegistryRawFieldValue): IRiskRegistryPerson | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const person = raw as IPersonFieldDto;
  const displayName = typeof person.Title === 'string' ? person.Title.trim() : '';

  if (!displayName) {
    return undefined;
  }

  return {
    id: typeof person.Id === 'number' ? person.Id : undefined,
    displayName,
    email: typeof person.EMail === 'string' && person.EMail.trim().length > 0 ? person.EMail : undefined
  };
}

function mapFieldFromDto(definition: IRiskFieldDefinition, raw: RiskRegistryRawFieldValue): RiskRegistryFieldValue {
  if (raw === null || raw === undefined) {
    return undefined;
  }

  switch (definition.type) {
    case 'Text':
      return typeof raw === 'string' ? raw : undefined;
    case 'Note':
      return typeof raw === 'string' ? sanitizeNoteText(raw) : undefined;
    case 'Number':
      return typeof raw === 'number' ? raw : undefined;
    case 'Boolean':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'Choice':
      return typeof raw === 'string' ? raw : undefined;
    case 'DateTime':
      return typeof raw === 'string' ? raw : undefined;
    case 'User':
      return mapPersonFromDto(raw);
    default:
      return undefined;
  }
}

/**
 * Extracts the concurrency token from a raw item response.
 *
 * Checked against the handful of property spellings different SharePoint
 * REST metadata modes use, because this solution does not control which
 * mode the tenant/endpoint is serving — see `IRiskRegistryItemDtoWithEtag`.
 */
export function extractEtag(raw: Record<string, unknown>): string | undefined {
  const candidates = ['odata.etag', '@odata.etag', '__metadata'];

  for (const key of candidates) {
    const value = raw[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (key === '__metadata' && value && typeof value === 'object') {
      const etag = (value as { etag?: unknown }).etag;
      if (typeof etag === 'string' && etag.length > 0) {
        return etag;
      }
    }
  }

  return undefined;
}

/**
 * Maps a raw item + etag into the domain model.
 *
 * Never throws on a missing or malformed field — each field maps to
 * `undefined` independently, so one bad column never takes down the whole
 * record. Missing-required-field detection is `fieldMetadata.ts`'s job at
 * validation time, not this mapper's.
 */
export function mapRiskRegistryItem(source: IRiskRegistryItemDtoWithEtag): IRiskRegistryItem {
  const { item, etag } = source;

  const fields: Partial<Record<RiskRegistryDataFieldKey, RiskRegistryFieldValue>> = {};

  for (const key of Object.keys(RISK_REGISTRY_DATA_FIELDS) as RiskRegistryDataFieldKey[]) {
    const definition = RISK_REGISTRY_DATA_FIELDS[key];
    const raw = item[definition.internalName];
    const mapped = mapFieldFromDto(definition, raw);
    if (mapped !== undefined) {
      fields[key] = mapped;
    }
  }

  const createdRaw = item[SYSTEM_FIELDS.created];
  const authorRaw = item[SYSTEM_FIELDS.createdBy];

  return {
    id: item.Id,
    etag: etag ?? '',
    modified: typeof item.Modified === 'string' ? new Date(item.Modified) : undefined,
    created: typeof createdRaw === 'string' ? new Date(createdRaw) : undefined,
    submittedBy: mapPersonFromDto(authorRaw),
    fields
  };
}

function mapFieldToDto(definition: IRiskFieldDefinition, value: RiskRegistryFieldValue): RiskRegistryRawFieldValue {
  if (value === undefined) {
    return null;
  }

  switch (definition.type) {
    case 'Text':
    case 'Choice':
      return typeof value === 'string' ? value : null;
    case 'Note':
      return typeof value === 'string' ? sanitizeNoteText(value) : null;
    case 'Number':
      return typeof value === 'number' ? value : null;
    case 'Boolean':
      return typeof value === 'boolean' ? value : null;
    case 'DateTime':
      return typeof value === 'string' ? value : null;
    default:
      return null;
  }
}

/**
 * Builds the PnPjs `.update()` payload (raw internal-name keys) for the
 * fields present in `draft`.
 *
 * A `User` field is keyed `${InternalName}Id` with a site user id (or
 * `null` to clear it) — see the file header — rather than going through
 * `mapFieldToDto` like every other field type. By the time this runs, a
 * draft's `User` values are expected to already be resolved (an `id`
 * present): `resolvePersonFieldsForSave` is responsible for that, not this
 * mapper, so a value that somehow still lacks one is cleared (`null`)
 * rather than sent malformed.
 */
export function buildUpdatePayload(draft: RiskRegistryDraftValues): Record<string, RiskRegistryRawFieldValue> {
  const payload: Record<string, RiskRegistryRawFieldValue> = {};

  for (const key of Object.keys(draft) as RiskRegistryDataFieldKey[]) {
    const definition = getRiskRegistryDataField(key);

    if (definition.type === 'User') {
      const value = draft[key];
      payload[`${definition.internalName}Id`] = isPersonValue(value) && typeof value.id === 'number' ? value.id : null;
      continue;
    }

    payload[definition.internalName] = mapFieldToDto(definition, draft[key]);
  }

  return payload;
}
