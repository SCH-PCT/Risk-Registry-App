import { RiskRegistryDataFieldKey } from '../../../config/listSchema';

/**
 * The DOM id a field's input/value element uses. Shared by `FieldRenderer`
 * (which sets it) and `FormFieldErrorSummary`'s `onFocusField` callback
 * (which uses it to move keyboard focus to an invalid field) so the two
 * never drift apart.
 */
export function fieldDomId(fieldKey: RiskRegistryDataFieldKey): string {
  return `risk-registry-field-${fieldKey}`;
}

export function focusField(fieldKey: RiskRegistryDataFieldKey): void {
  const element = document.getElementById(fieldDomId(fieldKey));
  if (element instanceof HTMLElement) {
    element.focus();
  }
}
