# Risk Registry — Architecture

**Status as of 2026-10-22:** two of the three components below are implemented —
the **Risk Registry Top Navigation** application customizer and the **Risk Registry
Detail** web part. The **Risk Registry List** web part (grid/summary surface) is
still proposed, not yet built. This document was written before any code existed;
sections describing the List web part or any of the four related child lists
(`RiskActions`, `RiskActivities`, `RiskUpdates`, `RiskAssignments`) remain
forward-looking and are marked as such below. See
[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for phase gates and
[SCHEMA-TODO.md](SCHEMA-TODO.md) for current schema-resolution status —
`RiskRegistryData` is now RESOLVED; everything else remains unresolved.

Modelled on `CRAWhiteboard-App` (same author, same constraints: SPFx 1.23.2, Node 22,
React 17.0.1 exact, PnPjs behind repositories, no app registration, site collection
app catalog deployment). That project is the pattern reference only — **nothing in
it is read, written, or copied into this one**, and schema is re-verified from
scratch because this is a different site with different lists.

## Solution shape

One SPFx package, deployed to a **site collection app catalog**, containing one
application customizer and two web parts. All data comes from lists/libraries in the
site where the package is installed. No app registration, no Graph permissions, no
external services.

| Component | Type | Status | Reads |
| --- | --- | --- | --- |
| Risk Registry Top Navigation | Application customizer (Top placeholder) | **Implemented** | `appTopNavigation` |
| Risk Registry List | Web part | Proposed | `RiskRegistryData`, `RiskRegistryDataColumns` |
| Risk Registry Detail | Web part | **Implemented** | `RiskRegistryData` (fully, verified schema) + 4 related lists (gated as not-configured, schema unresolved) + `RiskRegistryDocuments` (partial, folder-convention assumed) |

The List web part is the proposed grid/summary surface; the Detail web part is a
single-risk view that aggregates every related list for that risk's system `ID`. As
built, the Detail web part only fully resolves `RiskRegistryData` itself — the four
related lists render a "not configured" section rather than fabricated data (see
SCHEMA-TODO.md), and `RiskRegistryDocuments` is queried using only universal
file/folder properties under an assumed, documented folder-naming convention.

## Data sources — as given, nothing assumed

| Logical list | SharePoint list/library title | Relationship |
| --- | --- | --- |
| Navigation | `appTopNavigation` | Standalone |
| Risk Registry Data | `RiskRegistryData` | Parent; carries `RiskId` |
| Risk Registry Columns | `RiskRegistryDataColumns` | Configuration for the List web part's grid, not risk data itself |
| Risk Actions | `RiskActions` | Child, linked by `RiskId` |
| Risk Activities | `RiskActivities` | Child, linked by `RiskId` |
| Risk Updates | `RiskUpdates` | Child, linked by `RiskId` |
| Risk Assignments | `RiskAssignments` | Child, linked by `RiskId` |
| Risk Registry Documents | `RiskRegistryDocuments` | Document library; folders named by `RiskId` |

Everything past "title" and "stated relationship" is unverified. In particular:

- Whether `RiskId` is a custom column (Number or Text) on each child list, or the
  parent's system `ID`, is **not known** — see SCHEMA-TODO.md. This decides whether
  joins use a plain-ID batched-hydration pattern (as CRAWhiteboard does for
  patient/staff/room references) or something else.
- `RiskRegistryDataColumns` is assumed to be metadata describing which fields of
  `RiskRegistryData` the List web part's grid should render (names, order,
  visibility, type) — a dynamic-columns pattern, not a data list in its own right.
  That assumption is unverified and gates the List web part's design.
- `RiskRegistryDocuments` is a document **library**, not a list. "Grouped by folders
  with RiskId as the name" means the repository must resolve a risk's documents by
  folder path (`<library root>/<RiskId>`), not by a lookup column. Folder-naming
  format (zero-padded? raw item ID? a custom `RiskId` field's string value?) is
  unverified.

No column internal name, choice value, or lookup relationship is fabricated anywhere
in this document or in the schema-discovery script. Placeholders are marked
`UNRESOLVED` once `src/config/listSchema.ts` exists (Phase 2).

## Layering

Dependencies point one direction only. Presentation never imports PnPjs.

```
webparts / extensions      SPFx entry points, property panes, ErrorBoundary
        ↓
hooks / state               loading, refresh, selection, form state
        ↓
data/services                IRiskRegistryDataService — business operations across repositories
        ↓
data/repositories             I*Repository — the only place OData/folder queries are composed
        ↓
data/queries + mappers       query builders; DTO → domain conversion
        ↓
models/dto → models/domain   raw list/folder shapes → application types
```

- **DTOs** mirror raw SharePoint responses (list items and, for the document library,
  folder/file listings), including SharePoint's naming.
- **Mappers** are pure functions, unit-tested first — they are where a wrong internal
  name shows up.
- **Repositories** are interfaces. PnPjs implementations for production, mock
  implementations for tests and local development.
- **Presentation components** receive typed props and make no SharePoint calls.

Every column name will resolve through `src/config/listSchema.ts` via `requireField`
/ `optionalField` (Phase 2 onward). No column string literals anywhere else in
`src/data`.

## Folder structure (as built)

```
src/
  extensions/
    riskRegistryTopNavigation/   components/   loc/
  webparts/
    riskRegistryDetail/          components/   loc/
    (riskRegistryList/ — proposed, not yet built)
  components/
    common/    ErrorBoundary, LoadingState, ErrorState, ConfirmDialog,
               PermissionAwareAction, FormFieldErrorSummary, StatusBadge,
               PersonDisplay, ...
    feedback/  RefreshStatus, RefreshNowButton
  data/
    repositories/
      IRiskRegistryRepository, IRiskActionRepository, IRiskActivityRepository,
      IRiskUpdateRepository, IRiskAssignmentRepository, IRiskDocumentRepository
      pnp/    mock/     (strictly separate files per interface — see note below)
    services/
      IWebPermissionsService
      pnp/    mock/
    mappers/   riskRegistryMapper.ts (DTO → domain, ETag extraction, sanitization)
  models/
    domain/    dto/    viewModels/  (IRiskRegistryEditState, draft/error types)
  hooks/       useRiskRegistryDetail, useAutoRefresh, useUnsavedChangesWarning
  state/       RefreshCoordinator, IRefreshConfiguration/IRefreshState
  config/      listSchema.ts — the single field-name/type/choice catalog
  utilities/   itemIdentifier.ts, sanitizeHtml.ts, refreshInterval.ts
```

**Hard rule enforced across every repository/service added so far:** a `pnp/`
implementation and its `mock/` counterpart live in separate files, never behind a
runtime `if (isTest)` branch in one file. This was discovered empirically, not
designed up front — PnPjs (`@pnp/sp`) is ESM-only, and Jest fails to parse *any*
test-imported module whose dependency chain includes a `@pnp/sp/*` side-effect
import, even if that import is never reached at runtime. Keeping `pnp/` and `mock/`
in separate files is what keeps Jest able to import the mock without ever touching
the PnPjs import graph.

## Service composition

PnPjs is initialised **once** from SPFx context in `data/services/serviceFactory.ts`
and injected via a small typed React context — no DI framework. Each web part
resolves its services in `onInit` and passes them down. Each web part must work
standalone; the Detail web part does not require the List web part to be on the page,
and vice versa.

## Refresh framework

One shared implementation (`hooks/useAutoRefresh` + `state/RefreshCoordinator`), used
by both business web parts, per the shared-refresh-architecture requirements in the
brief: recursive `setTimeout` scheduled only after completion, jitter, visibility/
online-aware pausing, stale-response guards via a request sequence number, bounded
backoff with jitter for transient failures only, interval as a validated dropdown
(30/60/120/300/600/900s, default 60), migrating old property-bag instances at read
time rather than requiring republish.

The navigation customizer is exempt: no polling, short in-memory cache, refresh on
SharePoint page navigation only. Whether `appTopNavigation` carries any
visibility/audience columns here is unverified (do not assume it matches
CRAWhiteboard's four-column shape — that is a different list on a different site).

## Cross-list joins — pending the RiskId question

CRAWhiteboard's joins use plain `Number` ID columns with no `$expand`, resolved via
batched hydration (collect distinct IDs, chunked `Id eq A or Id eq B …` fetch per
related list, parallel across lists, join in the mapper). That pattern is the leading
candidate here **if** `RiskId` turns out to be a plain column (Number or Text) on each
child list rather than a SharePoint Lookup column.

Two things must be confirmed before Phase 4 can be implemented, not guessed:

1. Is `RiskId` a Lookup field (then `$expand`/`$select` on the lookup is available) or
   a plain Number/Text column (then batched hydration as above is required)?
2. For `RiskRegistryDocuments`, is the per-risk document set reachable as a single
   `$filter` against the library's items (e.g. by a `RiskId` column on the document
   content type) in addition to the folder convention, or is folder traversal the
   only route? This affects whether documents can be fetched in one call or require a
   folder-resolution round trip per risk.

Both are schema-discovery questions, not design choices — see SCHEMA-TODO.md.

## Read and write

**Confirmed and implemented** for the Detail web part, against `RiskRegistryData`
only: an explicit Edit mode with per-field validation driven by the
`IRiskFieldDefinition` catalog, a Save disabled until the draft is both valid and
changed, and ETag-based optimistic concurrency (`item.update(payload, etag)`,
handling SharePoint's 412 response by re-fetching the current server item and
surfacing a non-destructive conflict banner rather than overwriting). People/User
fields are deliberately scoped out of editing (read-only in both modes) — see
SCHEMA-TODO.md's `RiskRegistryData` section, question 9. Writing to any of the four
related lists or the documents library is out of scope — their schema is
unresolved, so nothing is written to them.

**Create is also implemented**, reached when the page's `id` query-string
parameter is missing entirely (as opposed to present-but-invalid, which still
renders the handled error state): `items.add(payload)`, re-read afterward through
the same `getById` path `update()` uses so the result carries a full field set and
a current ETag. Gated on a list-level `AddListItems` effective-permission check
(`IWebPermissionsService.canAddItems`), fail-closed like the existing
`canEditItem` check. On success the page switches to the normal view/edit flow for
the newly created item, updating the address bar via `history.replaceState`.

## Privacy and security boundary

Risk register content is business-confidential (risk descriptions, mitigation
actions, assignees, internal documents) even though it is not patient health
information. The same discipline applies regardless of data category. **As
implemented in the Detail web part:**

- In memory only. No `localStorage`, `sessionStorage`, `IndexedDB`, service workers.
- The URL contract carries only the SharePoint system `ID` (`?id=482`), validated
  by a strict positive-integer pattern (`utilities/itemIdentifier.ts`) before any
  query is built; an invalid value never reaches a repository call, and
  `describeItemIdentifierError` never echoes the raw query-string value back into
  a user-facing message.
- List data is never passed to `console.*`; this is enforced by a dedicated test
  (`RiskRegistryDetail.test.tsx`, "sensitive-data logging controls") that spies on
  `console.log`/`info`/`debug` across a full load → edit → save cycle.
- Effective permissions are checked per item, not per list, via
  `PnpWebPermissionsService.canEditItem` (`getCurrentUserEffectivePermissions()` on
  the specific item), and fail closed — any error while checking permissions is
  treated as "cannot edit," never as "assume allowed." `PermissionAwareAction`
  hides the Edit/Save controls while the check is pending or denied, so a denied
  user never sees an enabled-then-rejected button.
- Note-type fields are sanitized (`sanitizeNoteText`) before render even though the
  verified schema shows `RichText=FALSE` (plain text) for every Note field on
  `RiskRegistryData` today — defense against a future schema change or a stray
  `dangerouslySetInnerHTML`, which is not used anywhere in this web part.

## Cross-web-part coordination

A page-scoped `RefreshCoordinator` deduplicates in-flight requests for the same
list/filter/cycle and carries a manual page-level refresh signal via SPFx Dynamic
Data. Concretely: if the List and Detail web parts are on the same page, selecting a
row in List can notify Detail to load that `RiskId` via Dynamic Data rather than a
global variable or page reload; a successful save in Detail notifies List to refresh
just the affected row. Each web part remains fully functional alone.

## Open architectural questions (updated 2026-10-22)

| # | Question | Affects | Status |
| --- | --- | --- | --- |
| 1 | Is the related-list link column (`RiskID`-equivalent) a Lookup, plain Number, or plain Text, consistently across the four related lists? | Repository design for `RiskActions`/`RiskActivities`/`RiskUpdates`/`RiskAssignments` | Still open — those four repositories remain `invalid-configuration` stubs gated by `assertRelatedListConfigured` |
| 2 | Does the document library content type carry a `RiskID` column, or is folder path the only association? | `PnpRiskDocumentRepository` | Still open — current implementation assumes raw-numeric-folder convention; documented as an assumption, not fact, in SCHEMA-TODO.md |
| 3 | What does `RiskRegistryDataColumns` actually describe? | List web part design (not yet started) | Still open — irrelevant to the Detail web part as built |
| 4 | Read-only or read/write? | Detail web part scope | **Resolved for `RiskRegistryData`:** read/write, with ETag concurrency. Still read-only (not-configured) for the four related lists. |
| 5 | Expected item volume per list, and which columns are indexed today | Query design against the 5,000-item threshold | Still open — not a blocker; the Detail web part fetches exactly one `RiskRegistryData` item by system `ID`, never a filtered collection of them |
| 6 | Item-level permissions on `RiskRegistryData` or any child list? | Permission-aware actions | Handled defensively regardless of the answer — see "Privacy and security boundary" above |

These will be answered by the same mechanism as before: running the discovery
script against the real site, not by inference from naming conventions.
