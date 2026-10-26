/**
 * Read access to the `RiskRegistryData` list as a whole, for the Risk
 * Registry List web part's card grid.
 *
 * Deliberately a single `getAll()` rather than a paged/filtered query
 * surface: the list web part fetches a bounded set of items once per refresh
 * cycle (see `PnpRiskRegistryListRepository.MAX_ITEMS`) and derives its KPI
 * counts, search/status filtering and pagination entirely client-side from
 * that one snapshot — the same "fetch once, derive the rest in memory"
 * shape `useRiskRegistryDetail`'s related sections already use. A tenant's
 * open/active risk register is not expected to run into the thousands, so
 * this trades a small amount of over-fetching for a much simpler, fully
 * client-side filter/paginate implementation with no server-side CAML
 * query to keep in sync with the UI's filter controls.
 */

import { IRiskRegistryItem } from '../../models/domain/IRiskRegistryItem';

export interface IRiskRegistryListRepository {
  /**
   * Fetches every `RiskRegistryData` item (up to the repository's cap),
   * newest first. Each item's `fields` carries only the subset this web
   * part's cards render — see the PnP implementation's `$select` — not the
   * full ~70-column catalog the Detail web part reads.
   *
   * Rejects with `RiskRegistryError` (see `IRiskRegistryRepository.ts`) for every failure mode.
   */
  getAll(): Promise<IRiskRegistryItem[]>;
}
