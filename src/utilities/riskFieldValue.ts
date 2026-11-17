/**
 * `RiskRegistryFieldValue` is one union covering every field's possible wire
 * shape (Text/Note, Number, Boolean, Choice, People all collapse into the
 * same type). These narrow a specific field's value to the shape that
 * field's declared schema type actually produces — the same `typeof`
 * pattern `FieldRenderer.tsx` uses, pulled out here so both a hook and a
 * component can share it without the hook layer reaching into a web part's
 * component folder.
 */

import { IRiskRegistryPerson, RiskRegistryFieldValue } from '../models/domain/IRiskRegistryItem';

export function asText(value: RiskRegistryFieldValue): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asNumber(value: RiskRegistryFieldValue): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function isPersonValue(value: RiskRegistryFieldValue): value is IRiskRegistryPerson {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'displayName' in value;
}

export function asPerson(value: RiskRegistryFieldValue): IRiskRegistryPerson | undefined {
  return isPersonValue(value) ? value : undefined;
}

export function asStringArray(value: RiskRegistryFieldValue): readonly string[] | undefined {
  return Array.isArray(value) ? value : undefined;
}
