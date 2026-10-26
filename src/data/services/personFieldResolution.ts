/**
 * Resolves Person-field picks to real SharePoint site users before a draft
 * is validated/saved.
 *
 * A value just picked from `IPeopleRepository.searchPeople` carries a
 * directory `loginName` but no SharePoint site user id — the list item
 * update payload needs that id (`EnsureUser` also adds the person to the
 * site's User Information List on first use, which a brand-new directory
 * result has not gone through yet). A value already read from the server,
 * or picked earlier in the same edit session, already has an `id` and is
 * left untouched.
 */

import { getRiskRegistryDataField, RISK_REGISTRY_DATA_FIELDS, RiskRegistryDataFieldKey } from '../../config/listSchema';
import { IRiskRegistryPerson, RiskRegistryFieldValue } from '../../models/domain/IRiskRegistryItem';
import { RiskRegistryDraftValues } from '../../models/viewModels/IRiskRegistryEditState';
import { IPeopleRepository } from '../repositories/IPeopleRepository';

const USER_FIELD_KEYS: readonly RiskRegistryDataFieldKey[] = (
  Object.keys(RISK_REGISTRY_DATA_FIELDS) as RiskRegistryDataFieldKey[]
).filter((key) => getRiskRegistryDataField(key).type === 'User');

function isUnresolvedPick(value: RiskRegistryFieldValue): value is IRiskRegistryPerson & { loginName: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'displayName' in value &&
    typeof (value as IRiskRegistryPerson).loginName === 'string' &&
    (value as IRiskRegistryPerson).id === undefined
  );
}

/** Returns `draft` with every unresolved Person-field pick replaced by its resolved SharePoint user. Fields already resolved, empty, or with no conditional pick are returned unchanged. */
export async function resolvePersonFieldsForSave(
  draft: RiskRegistryDraftValues,
  people: IPeopleRepository
): Promise<RiskRegistryDraftValues> {
  const resolved: RiskRegistryDraftValues = { ...draft };

  for (const key of USER_FIELD_KEYS) {
    const value = draft[key];
    if (isUnresolvedPick(value)) {
      resolved[key] = await people.ensurePerson(value.loginName);
    }
  }

  return resolved;
}
