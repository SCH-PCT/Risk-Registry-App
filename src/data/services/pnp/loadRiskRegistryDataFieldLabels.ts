/**
 * Loads `RiskRegistryData` form labels from `RiskRegistryDataColumns` (and the
 * live field display names as fallback) into the label registry in
 * `config/fieldLabels.ts`.
 *
 * Fails soft: a failure on either request is logged and the affected source is
 * treated as empty, so the form still renders with the next label in the
 * precedence chain. Fields that fell back are reported with `console.warn`.
 */

import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/fields';

import { RISK_REGISTRY_DATA, RISK_REGISTRY_DATA_COLUMNS, requireField } from '../../../config/listSchema';
import {
  IFieldLabelSourceRow,
  IResolvedFieldLabels,
  resolveFieldLabels,
  setRiskRegistryDataFieldLabels
} from '../../../config/fieldLabels';

/** Well above any realistic number of label rows; keeps the read to one request. */
const MAX_LABEL_ROWS = 5000;

async function readColumnRows(sp: SPFI): Promise<IFieldLabelSourceRow[]> {
  const titleField = requireField(RISK_REGISTRY_DATA_COLUMNS, 'label');
  const internalNameField = requireField(RISK_REGISTRY_DATA_COLUMNS, 'fieldInternalName');
  const rows: Record<string, unknown>[] = await sp.web.lists
    .getByTitle(RISK_REGISTRY_DATA_COLUMNS.title)
    .items.select(titleField, internalNameField)
    .top(MAX_LABEL_ROWS)();
  return rows.map((row) => ({
    internalName: String(row[internalNameField] ?? ''),
    title: String(row[titleField] ?? '')
  }));
}

async function readLiveFields(sp: SPFI): Promise<IFieldLabelSourceRow[]> {
  const fields: { InternalName?: string; Title?: string }[] = await sp.web.lists
    .getByTitle(RISK_REGISTRY_DATA.title)
    .fields.select('InternalName', 'Title')();
  return fields.map((field) => ({ internalName: field.InternalName ?? '', title: field.Title ?? '' }));
}

async function safely(label: string, read: () => Promise<IFieldLabelSourceRow[]>): Promise<IFieldLabelSourceRow[]> {
  try {
    return await read();
  } catch (error) {
    console.warn(`[Risk Registry] Could not read ${label}; field labels will fall back.`, error);
    return [];
  }
}

export async function loadRiskRegistryDataFieldLabels(sp: SPFI): Promise<IResolvedFieldLabels> {
  const [columnRows, liveFields] = await Promise.all([
    safely(`'${RISK_REGISTRY_DATA_COLUMNS.title}'`, () => readColumnRows(sp)),
    safely(`'${RISK_REGISTRY_DATA.title}' field display names`, () => readLiveFields(sp))
  ]);

  const resolved = resolveFieldLabels(columnRows, liveFields);
  setRiskRegistryDataFieldLabels(resolved.labels);

  if (resolved.fallbacks.length > 0) {
    console.warn(
      `[Risk Registry] ${resolved.fallbacks.length} field(s) have no label in '${RISK_REGISTRY_DATA_COLUMNS.title}' ` +
        `and use their '${RISK_REGISTRY_DATA.title}' display name instead:`,
      resolved.fallbacks.map((f) => `${f.internalName} → "${f.label}" (${f.source})`)
    );
  }

  return resolved;
}
