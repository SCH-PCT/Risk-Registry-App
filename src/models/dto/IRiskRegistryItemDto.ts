/* eslint-disable @rushstack/no-new-null --
 * `null` is correct here: it is what SharePoint returns in JSON for an empty
 * column, and this file describes that wire format rather than inventing a
 * cleaner one. See `navigationMapper`'s DTO for the same convention.
 */

/** Raw shape of a People-field value, as SharePoint returns it when expanded. */
export interface IPersonFieldDto {
  readonly Id?: number;
  /** Display name, when the field is expanded with `Title`. */
  readonly Title?: string | null;
  readonly EMail?: string | null;
}

export type RiskRegistryRawFieldValue = string | number | boolean | IPersonFieldDto | null | undefined;

/**
 * Raw shape of a `RiskRegistryData` list row, exactly as SharePoint returns it.
 *
 * An index signature is used instead of ~80 named properties (one per
 * verified field in `config/listSchema.ts`) deliberately: every field access
 * in this solution goes through the field catalog by logical name, which
 * resolves to the verified internal name and is itself typed
 * (`RiskFieldType`). A second, parallel hand-maintained list of ~80 named
 * properties here would only be a second place for a typo to hide, with no
 * additional safety — the catalog is the one source of truth for which
 * columns exist and what they mean.
 *
 * `Id` is pulled out explicitly because it is guaranteed by SharePoint on
 * every list and is never resolved through the field catalog (see
 * `SYSTEM_FIELDS` in `listSchema.ts`).
 */
export interface IRiskRegistryItemDto {
  readonly Id: number;
  readonly Modified?: string | null;
  readonly [internalFieldName: string]: RiskRegistryRawFieldValue;
}

/**
 * An item row paired with its concurrency token.
 *
 * SharePoint list items carry their ETag as an `odata.etag`-shaped property
 * on the JSON payload itself (a SharePoint REST quirk — list items expose it
 * in the body, not only in a response header, regardless of metadata mode).
 * The repository reads defensively from the handful of property spellings
 * different metadata modes use, rather than betting on exactly one.
 */
export interface IRiskRegistryItemDtoWithEtag {
  readonly item: IRiskRegistryItemDto;
  /** `undefined` only if every known etag property spelling was absent — treated as a configuration problem, not silently ignored. */
  readonly etag: string | undefined;
}
