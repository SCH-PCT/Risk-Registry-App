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

export function asPerson(value: RiskRegistryFieldValue): IRiskRegistryPerson | undefined {
  return value && typeof value === 'object' ? value : undefined;
}
