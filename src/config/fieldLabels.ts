/**
 * Runtime form labels for `RiskRegistryData` fields.
 *
 * Label precedence, per field:
 *  1. `Title` of the `RiskRegistryDataColumns` row whose `InternalName` matches
 *     the field's internal name.
 *  2. The live display name (`Title`) of the field on `RiskRegistryData`.
 *  3. The verified `displayName` in `RISK_REGISTRY_DATA_FIELDS` — used until
 *     labels are loaded, and whenever loading fails.
 *
 * Labels are loaded once in the Detail web part's `onInit`, before the first
 * render, so components can read them synchronously.
 */

import {
  getRiskRegistryDataField,
  IRiskFieldDefinition,
  RISK_REGISTRY_DATA_FIELDS,
  RiskRegistryDataFieldKey
} from './listSchema';

export interface IFieldLabelSourceRow {
  readonly internalName: string;
  readonly title: string;
}

export interface IFieldLabelFallback {
  readonly key: RiskRegistryDataFieldKey;
  readonly internalName: string;
  readonly label: string;
  /** Where the fallback label came from. */
  readonly source: 'RiskRegistryData display name' | 'catalog display name';
}

export interface IResolvedFieldLabels {
  readonly labels: Readonly<Partial<Record<RiskRegistryDataFieldKey, string>>>;
  /** Fields with no `RiskRegistryDataColumns` row. */
  readonly fallbacks: readonly IFieldLabelFallback[];
}

let loadedLabels: Readonly<Partial<Record<RiskRegistryDataFieldKey, string>>> = {};

function toLookup(rows: readonly IFieldLabelSourceRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const internalName = typeof row.internalName === 'string' ? row.internalName.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    // First row wins on duplicates; blank values are ignored rather than shown.
    if (internalName && title && !map.has(internalName)) {
      map.set(internalName, title);
    }
  }
  return map;
}

/** Pure resolution of every catalog field's label. Never throws. */
export function resolveFieldLabels(
  columnRows: readonly IFieldLabelSourceRow[],
  liveFields: readonly IFieldLabelSourceRow[]
): IResolvedFieldLabels {
  const configured = toLookup(columnRows);
  const live = toLookup(liveFields);
  const labels: Partial<Record<RiskRegistryDataFieldKey, string>> = {};
  const fallbacks: IFieldLabelFallback[] = [];

  for (const key of Object.keys(RISK_REGISTRY_DATA_FIELDS) as RiskRegistryDataFieldKey[]) {
    const definition = RISK_REGISTRY_DATA_FIELDS[key];
    const configuredLabel = configured.get(definition.internalName);
    if (configuredLabel) {
      labels[key] = configuredLabel;
      continue;
    }
    const liveLabel = live.get(definition.internalName);
    const label = liveLabel ?? definition.displayName;
    labels[key] = label;
    fallbacks.push({
      key,
      internalName: definition.internalName,
      label,
      source: liveLabel ? 'RiskRegistryData display name' : 'catalog display name'
    });
  }

  return { labels, fallbacks };
}

export function setRiskRegistryDataFieldLabels(labels: Readonly<Partial<Record<RiskRegistryDataFieldKey, string>>>): void {
  loadedLabels = { ...labels };
}

/** For tests only. */
export function resetRiskRegistryDataFieldLabels(): void {
  loadedLabels = {};
}

/** The label to show for a field. Falls back to the catalog display name. */
export function getRiskRegistryDataFieldLabel(key: RiskRegistryDataFieldKey): string {
  return loadedLabels[key] ?? getRiskRegistryDataField(key).displayName;
}

/** Same as {@link getRiskRegistryDataFieldLabel}, for code holding a definition rather than its key. */
export function getRiskRegistryDataFieldLabelFor(definition: IRiskFieldDefinition): string {
  for (const key of Object.keys(loadedLabels) as RiskRegistryDataFieldKey[]) {
    if (RISK_REGISTRY_DATA_FIELDS[key]?.internalName === definition.internalName) {
      return loadedLabels[key] ?? definition.displayName;
    }
  }
  return definition.displayName;
}
