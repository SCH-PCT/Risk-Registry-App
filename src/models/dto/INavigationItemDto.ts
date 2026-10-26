/* eslint-disable @rushstack/no-new-null --
 * `null` is correct here and `undefined` is not. The SharePoint REST API returns JSON
 * `null` for an empty column, and this file's whole purpose is to describe that payload
 * as it actually arrives. Declaring `undefined` instead would misrepresent the wire
 * format and let a `=== undefined` check silently miss every empty cell. This is the
 * "describing a legacy API" exemption the rule allows for.
 */

/**
 * Raw shape of an `appTopNavigation` list row, exactly as SharePoint is expected to
 * return it.
 *
 * ⚠️ UNVERIFIED against this solution's own site — see the warning at the top of
 * `config/listSchema.ts` and SCHEMA-TODO.md. This shape is carried over from a
 * different project's verified `appTopNavigation` list and must be reconfirmed by
 * running `scripts/Get-RiskRegistrySchema.ps1`.
 *
 * SharePoint's own naming is preserved deliberately — this type is the boundary where
 * a wrong internal name becomes visible. Renaming anything here to read better would
 * hide the mismatch it exists to expose. Conversion to application vocabulary happens
 * once, in `navigationMapper`.
 *
 * Every field except `Id` is optional, on the assumption that the list requires none
 * of them. A row with nothing but an ID is treated as a legal row, and the mapper has
 * to survive it.
 */
export interface INavigationItemDto {
  /** List item ID. The only value SharePoint guarantees. */
  readonly Id: number;

  /** Display text. Assumed Text, not required — may be absent, empty or whitespace. */
  readonly Title?: string | null;

  /**
   * Link target. **Assumed Text, not a Hyperlink field** — treated as untrusted input
   * and must pass `isSafeNavigationUrl` before reaching an `href`.
   */
  readonly URL?: string | null;

  /**
   * Parent link's `Title`. Assumed Text, not a lookup and not an ID.
   *
   * `Title` is assumed not unique on this list, so this value can match several rows
   * or none.
   */
  readonly Parent?: string | null;

  /** Display order. Assumed Number, may be null on any row. */
  readonly SortOrder?: number | null;
}

/**
 * A visibility column the navigation does not assume exists.
 *
 * This type exists so that the optional handling in the repository and mapper is
 * typed rather than stringly-guessed, and so that adding such a column later is a
 * schema change plus a query change, not a redesign. Until schema discovery finds
 * one, nothing populates it.
 */
export interface INavigationItemVisibilityDto {
  /**
   * Truthy when the item should render. Present only if a verified visibility column
   * has been added to the list and declared in `listSchema.ts`.
   */
  readonly [visibilityFieldName: string]: boolean | string | number | null | undefined;
}
