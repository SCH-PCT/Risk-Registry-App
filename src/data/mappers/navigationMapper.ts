/**
 * Converts `appTopNavigation` rows into the validated navigation model.
 *
 * This is a pure function over data the site owner can edit freely, so it is written to
 * survive every shape the list permits rather than the shapes it usually holds. A
 * navigation list is rendered in the top placeholder on *every page in the site*: a
 * mapper that throws takes the whole site's chrome down, and a mapper that trusts its
 * input puts an attacker-controlled `href` on every page. Neither is acceptable, so bad
 * rows are dropped with a diagnostic and the rest still render.
 *
 * Four rules follow from the (unverified — see `config/listSchema.ts`) assumed schema:
 *
 *  1. `URL` is assumed Text, not a Hyperlink field — scheme-check every value.
 *  2. `Title` is assumed not required — a row without one is unusable and is dropped.
 *  3. `Title` is assumed not unique and `Parent` matches on it — parents can be ambiguous.
 *  4. `Parent` is assumed free text — self-references and cycles are expressible.
 */

import {
  INavigationConfiguration,
  INavigationDiagnostic,
  INavigationItem,
  MAX_NAVIGATION_DEPTH,
  NavigationDiagnosticReason
} from '../../models/domain/INavigationItem';
import { INavigationItemDto } from '../../models/dto/INavigationItemDto';
import { normalizeUrl, resolveNavigationUrl } from '../../utilities/urlNormalization';

/**
 * Sort position given to a row whose `SortOrder` is null, absent or not a number.
 *
 * Such rows sort after every explicitly ordered row rather than before them: a blank
 * cell reads as "no opinion", and jumping an unordered row to the front of the
 * navigation is the more surprising of the two behaviours.
 */
const UNORDERED_SORT_POSITION = Number.MAX_SAFE_INTEGER;

/** A row that passed field-level validation, before hierarchy is resolved. */
interface IValidatedRow {
  readonly id: number;
  readonly title: string;
  readonly url: string;
  readonly sortOrder: number;
  readonly isExternal: boolean;
  /** Lowercased, trimmed `Parent`, or undefined when the row is top level. */
  readonly parentKey?: string;
  /** Lowercased, trimmed `Title` — the value other rows' `Parent` matches on. */
  readonly titleKey: string;
}

/**
 * Trims a nullable SharePoint text value to `undefined` when it carries no content.
 *
 * Accepts `null` because that is what SharePoint sends for an empty column. Narrowing
 * the parameter to `undefined` would make this function unable to receive the DTO
 * values it exists to clean.
 */
// eslint-disable-next-line @rushstack/no-new-null -- see above; matches the REST payload
function cleanText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Coerces `SortOrder` to a usable number.
 *
 * SharePoint returns a Number column as a JSON number, but the column is optional and
 * a REST response can carry `null`. `NaN` and `Infinity` are treated as unordered
 * because they would otherwise poison the comparator and produce an arbitrary order.
 */
// eslint-disable-next-line @rushstack/no-new-null -- null is what SharePoint sends for an empty Number column
function cleanSortOrder(value: number | null | undefined): number {
  return typeof value === 'number' && isFinite(value) ? value : UNORDERED_SORT_POSITION;
}

/**
 * Reads the optional visibility flag.
 *
 * No such column is assumed on the list, so `visibilityFieldName` is normally
 * undefined and every row is visible. The parameter exists so that adding the column
 * later — should discovery find one — is a schema declaration rather than a change to
 * this logic.
 *
 * SharePoint Yes/No columns come back as booleans, but a text or number column pressed
 * into the same role would not, so the common falsy spellings are handled.
 */
function isRowVisible(
  row: Record<string, unknown>,
  visibilityFieldName: string | undefined
): boolean {
  if (!visibilityFieldName) {
    return true;
  }

  const raw = row[visibilityFieldName];

  if (raw === undefined || raw === null) {
    // An empty cell on a column that exists is treated as visible, so that adding the
    // column to a populated list does not blank the navigation before anyone fills it in.
    return true;
  }

  if (typeof raw === 'boolean') {
    return raw;
  }

  if (typeof raw === 'number') {
    return raw !== 0;
  }

  const text = String(raw).trim().toLowerCase();
  return text !== 'false' && text !== 'no' && text !== '0' && text !== '';
}

/** Options controlling how rows are interpreted. */
export interface INavigationMapperOptions {
  /**
   * Site absolute URL from `pageContext.web.absoluteUrl`. Relative `URL` values are
   * resolved against it, and it decides which links count as external.
   */
  readonly siteAbsoluteUrl: string;

  /**
   * Internal name of a verified visibility column, if the site has one.
   *
   * Supplied by the repository from `optionalField`. Undefined unless discovery finds
   * one.
   */
  readonly visibilityFieldName?: string;
}

/**
 * Validates one row's own fields, independent of hierarchy.
 *
 * Returns the validated row, or the reason it cannot be used.
 */
function validateRow(
  dto: INavigationItemDto,
  options: INavigationMapperOptions
): IValidatedRow | { readonly reason: NavigationDiagnosticReason; readonly detail: string } {
  const title = cleanText(dto.Title);

  if (!title) {
    // Without a title the row can neither be labelled nor be matched as a parent.
    return {
      reason: 'missing-title',
      detail: 'Row has no Title. It cannot be labelled or referenced as a parent.'
    };
  }

  const url = cleanText(dto.URL);

  if (!url) {
    return { reason: 'missing-url', detail: `"${title}" has no URL.` };
  }

  // Resolving and scheme-checking are one step: the value that survives is the exact
  // string that will be rendered, so there is no gap between what was approved and what
  // the browser follows. A relative value is pinned to the site here rather than left for
  // the browser to resolve against whatever page happens to be showing the navigation.
  const resolvedUrl = resolveNavigationUrl(url, options.siteAbsoluteUrl);

  if (!resolvedUrl) {
    // The scheme check is the security boundary. The offending value is not echoed
    // into the diagnostic, so a hostile row cannot smuggle a payload into a log.
    return {
      reason: 'unsafe-url',
      detail:
        `"${title}" has a URL that is not http, https or a site-relative path. ` +
        'It was dropped rather than rendered as a link.'
    };
  }

  const parentTitle = cleanText(dto.Parent);

  return {
    id: dto.Id,
    title,
    url: resolvedUrl,
    sortOrder: cleanSortOrder(dto.SortOrder),
    isExternal: normalizeUrl(resolvedUrl, options.siteAbsoluteUrl)?.isExternal === true,
    parentKey: parentTitle?.toLowerCase(),
    titleKey: title.toLowerCase()
  };
}

/**
 * Orders rows by `SortOrder`, then by `Id`.
 *
 * The `Id` tiebreak is what makes the result deterministic: `SortOrder` is neither
 * required nor assumed unique, so duplicate and blank values are ordinary. Without it,
 * two rows sharing an order would render in whatever sequence SharePoint happened to
 * return, and the navigation would reorder itself between page loads.
 */
function byOrderThenId(a: IValidatedRow, b: IValidatedRow): number {
  return a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id;
}

/**
 * Builds the parent lookup, recording which titles are ambiguous.
 *
 * `Title` is assumed not unique, so two links may share a display name and a `Parent`
 * value can therefore match several rows. Choosing one silently would attach children
 * to an arbitrary parent that changes with list order, so ambiguous titles are recorded
 * and their would-be children are promoted to top level instead.
 */
function indexByTitle(rows: readonly IValidatedRow[]): {
  readonly byTitle: ReadonlyMap<string, IValidatedRow>;
  readonly ambiguousTitles: ReadonlySet<string>;
} {
  const byTitle = new Map<string, IValidatedRow>();
  const ambiguousTitles = new Set<string>();

  for (const row of rows) {
    if (byTitle.has(row.titleKey)) {
      ambiguousTitles.add(row.titleKey);
    } else {
      byTitle.set(row.titleKey, row);
    }
  }

  return { byTitle, ambiguousTitles };
}

/**
 * Walks a row's ancestry to find its depth, refusing to loop forever.
 *
 * `Parent` is assumed free text, so `A → B → A` and `A → A` are both expressible and
 * neither is prevented by SharePoint. The visited set makes the walk terminate on any
 * cycle; the row is then treated as top level, which keeps every link reachable
 * instead of hiding a whole branch behind a data-entry mistake.
 */
function resolveDepth(
  row: IValidatedRow,
  byTitle: ReadonlyMap<string, IValidatedRow>
): { readonly depth: number; readonly isCircular: boolean } {
  const visited = new Set<number>([row.id]);
  let depth = 1;
  let current = row;

  while (current.parentKey) {
    const parent = byTitle.get(current.parentKey);

    if (!parent) {
      break; // Parent names a row that does not exist: treat as top level.
    }

    if (visited.has(parent.id)) {
      return { depth, isCircular: true };
    }

    visited.add(parent.id);
    current = parent;
    depth += 1;

    // A list with thousands of rows chained into a line would otherwise walk them all
    // on every row. Depth beyond the render limit changes nothing, so stop early.
    if (depth > MAX_NAVIGATION_DEPTH) {
      break;
    }
  }

  return { depth, isCircular: false };
}

/**
 * Maps raw list rows to the navigation configuration.
 *
 * Never throws on data. Every rejection becomes a diagnostic so that a site owner can
 * see why a link is missing, while every other user keeps a working navigation bar.
 */
export function mapNavigationItems(
  dtos: readonly INavigationItemDto[],
  options: INavigationMapperOptions
): INavigationConfiguration {
  const diagnostics: INavigationDiagnostic[] = [];
  const validated: IValidatedRow[] = [];

  for (const dto of dtos ?? []) {
    if (!dto || typeof dto.Id !== 'number') {
      continue; // Not a list item. Nothing useful can be said about it.
    }

    if (!isRowVisible(dto as unknown as Record<string, unknown>, options.visibilityFieldName)) {
      continue; // Explicitly hidden by a verified column. Not a fault, so not a diagnostic.
    }

    const result = validateRow(dto, options);

    if ('reason' in result) {
      diagnostics.push({ itemId: dto.Id, reason: result.reason, detail: result.detail });
    } else {
      validated.push(result);
    }
  }

  validated.sort(byOrderThenId);

  const { byTitle, ambiguousTitles } = indexByTitle(validated);

  // Bucket rows by parent before building nodes, so children keep the sorted order
  // established above rather than being re-sorted per parent.
  const topLevel: IValidatedRow[] = [];
  const childrenByParentId = new Map<number, IValidatedRow[]>();

  for (const row of validated) {
    if (!row.parentKey) {
      topLevel.push(row);
      continue;
    }

    if (ambiguousTitles.has(row.parentKey)) {
      diagnostics.push({
        itemId: row.id,
        reason: 'ambiguous-parent',
        detail:
          `"${row.title}" names a parent that matches more than one row, because Title ` +
          'is not unique on this list. It is shown as a top-level item.'
      });
      topLevel.push(row);
      continue;
    }

    const parent = byTitle.get(row.parentKey);

    if (!parent || parent.id === row.id) {
      if (parent && parent.id === row.id) {
        diagnostics.push({
          itemId: row.id,
          reason: 'circular-parent',
          detail: `"${row.title}" is its own parent. It is shown as a top-level item.`
        });
      }
      // A parent that matches nothing is the documented "treat as top level" case and
      // is a normal way to author a flat navigation, so it produces no diagnostic.
      topLevel.push(row);
      continue;
    }

    const { depth, isCircular } = resolveDepth(row, byTitle);

    if (isCircular) {
      diagnostics.push({
        itemId: row.id,
        reason: 'circular-parent',
        detail: `"${row.title}" is part of a parent cycle. It is shown as a top-level item.`
      });
      topLevel.push(row);
      continue;
    }

    if (depth > MAX_NAVIGATION_DEPTH) {
      diagnostics.push({
        itemId: row.id,
        reason: 'depth-exceeded',
        detail:
          `"${row.title}" sits more than ${MAX_NAVIGATION_DEPTH} levels deep. ` +
          'The top navigation renders two levels; it was not shown.'
      });
      continue;
    }

    const siblings = childrenByParentId.get(parent.id);
    if (siblings) {
      siblings.push(row);
    } else {
      childrenByParentId.set(parent.id, [row]);
    }
  }

  const toItem = (row: IValidatedRow): INavigationItem => ({
    id: row.id,
    title: row.title,
    url: row.url,
    sortOrder: row.sortOrder,
    isExternal: row.isExternal,
    children: (childrenByParentId.get(row.id) ?? []).map(
      (child): INavigationItem => ({
        id: child.id,
        title: child.title,
        url: child.url,
        sortOrder: child.sortOrder,
        isExternal: child.isExternal,
        children: [] // Depth is capped; a second-level item never has children.
      })
    )
  });

  return {
    items: topLevel.map(toItem),
    diagnostics
  };
}
