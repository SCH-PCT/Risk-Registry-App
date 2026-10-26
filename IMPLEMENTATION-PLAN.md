# Risk Registry — Implementation Plan

Small, independently testable phases, each with an explicit exit gate. Work does not
advance past a failing gate. Modelled on CRAWhiteboard-App's plan structure.

**Phase 0 and Phase 1 are blockers.** Nothing below Phase 1 may start until the
schema is verified against the real site.

---

## Phase 0 — Toolchain (validated 2026-10-21, this machine)

This machine already has a working SPFx 1.23.2 toolchain, proven by the
CRAWhiteboard-App build. Re-verified for this project:

| Check | Result |
| --- | --- |
| Node on PATH | **v22.19.0** — within SPFx 1.23.2's `>=22.14.0 <23.0.0` range |
| npm | **10.9.3** |
| yo | **7.0.1** |
| `@microsoft/generator-sharepoint` | **1.23.2** (global) |
| gulp-cli | **3.1.0** (present; not used by the SPFx 1.23.2 build — see note below) |
| PnP.PowerShell | **3.1.0, 2.4.0, 1.12.0** all available |
| git | **2.51.0** |
| Repo state | `Risk-Registry-App` folder exists, empty, not yet a git repo, not yet scaffolded |

**Note carried forward from CRAWhiteboard-App:** SPFx 1.23.2 scaffolds on **Heft**,
not gulp — there is no `gulpfile.js`. The brief's `gulp bundle --ship` /
`gulp package-solution --ship` gates translate to:

| Brief | SPFx 1.23.2 |
| --- | --- |
| `gulp serve` | `npm run start` (`heft start --clean`) |
| `gulp bundle --ship` | `npx heft bundle --production` |
| `gulp package-solution --ship` | `npx heft package-solution --production` |
| both, plus tests | `npm run build` |

**Gate: PASSED.** Toolchain confirmed compatible. Scaffolding itself (Phase 0a) is
implementation, not this step — not run yet.

### Phase 0a — Scaffold (not yet run)

`yo @microsoft/sharepoint` (generator 1.23.2), React pinned to exactly `17.0.1`,
strict TypeScript, ESLint, Jest + React Testing Library. Use a path with no spaces
(CRAWhiteboard-App hit a toolchain bug with a space in the generated folder name).

**Gate:** `npm install` exits 0 with 0 critical/high vulnerabilities (or each
disposed in SECURITY.md). `npm run build` exits 0 on the generator's untouched
placeholder web part.

### Phase 0b — Fluent UI v9 bundling spike (not yet run)

Same open question as CRAWhiteboard-App: v9 is CSS-in-JS (Griffel) with its own
theme system, unrelated to SPFx's `IReadonlyTheme`. Needs: a real v9 import in a
bundled component (not just installed), a verified SPFx-theme → v9-theme bridge for
light/dark/high-contrast, and a bundle-size measurement with two web parts
(List + Detail) on one page sharing or duplicating `FluentProvider`.

**Gate:** measured before/after bundle size and a written go/no-go on v9 vs. v8,
recorded before any shared component is written. No spike code ships.

## Phase 1 — Verify the schema

Run `scripts/Get-RiskRegistrySchema.ps1` against the real site. Populate
`src/config/listSchema.ts` from the report. Close every row in SCHEMA-TODO.md that
discovery can answer — in particular the `RiskId` link-column question (Lookup vs.
plain column) and the `RiskRegistryDataColumns` structure, both of which gate Phase 8.

**Gate:** SCHEMA-TODO.md's eight list sections are all marked RESOLVED.
`unresolvedLists()` returns `[]`. Write DATA-MODEL.md from the verified report.

## Phase 2 — Models and mappers

DTOs, domain models, and pure DTO→domain mappers for all eight sources (seven lists
+ the document library). No SharePoint calls yet.

**Gate:** Mapper unit tests pass against mock data containing no real business data.
Missing/null/malformed fields covered, including a dangling `RiskId` reference
resolving to an explicit "unknown" domain value rather than throwing.

## Phase 3 — Query builders and OData safety

Typed `$select`/`$filter`/`$orderby`/`$top` builders reading column names only via
`requireField`. OData value escaping. Paging helper. A folder-path builder for the
document library (`RiskRegistryDocuments/<RiskId>`), guarded against path-injection
from an untrusted `RiskId`-shaped value.

**Gate:** Query-builder and escaping tests pass, including quote-injection and
folder-path-injection cases.

## Phase 4 — Repositories and service factory

`INavigationRepository`, `IRiskRegistryRepository`, `IRiskRegistryColumnsRepository`,
`IRiskActionRepository`, `IRiskActivityRepository`, `IRiskUpdateRepository`,
`IRiskDocumentRepository`, `IRiskAssignmentRepository` — interfaces, PnPjs
implementations, mock implementations, single PnPjs instance from SPFx context.
Typed error taxonomy: missing list, missing field, access denied, throttled,
network. Runtime list-GUID resolution from titles.

Join strategy depends on Phase 1's answer: either lookup-based `$expand`, or
CRAWhiteboard-style batched hydration (distinct-ID collection, chunked `Id eq …`
filters, parallel fetch across lists, join by ID in the mapper). `IRiskDocumentRepository`
resolves a risk's documents by folder path and/or a `RiskId` column per Phase 1's
finding on that list specifically.

**Gate:** Repository tests pass against mocks. No hard-coded URLs or GUIDs (verified
by grep). A multi-risk fetch issues a bounded number of requests independent of row
count (no N+1) across all five child collections. A risk with no document folder yet
resolves to an empty state, not an error.

## Phase 5 — Refresh framework

`IRefreshConfiguration`, `IRefreshState`, `RefreshCoordinator`, `useAutoRefresh`,
`RefreshStatus`, `RefreshNowButton`, interval validation, visibility/network utility.
Shared by both business web parts; the navigation customizer is exempt.

**Gate:** Full refresh test list passes under fake timers — defaults, allowed
values, invalid fallback, disabled refresh, coalescing, no-overlap, timer cleanup,
rerender without duplicate timers, hidden/visible, offline/online, backoff,
throttling, retry reset, stale-response protection.

## Phase 6 — Common components

Shared component set (LoadingState, ErrorState, EmptyState, StatusBadge,
PersonDisplay, SearchBoxWithDebounce, FilterBar, ConfirmDialog, PageHeader, Card,
ActionButtonGroup, ResponsiveDataRegion, LastUpdatedIndicator,
PermissionAwareAction, FormFieldErrorSummary), localization resources, theming
tokens, SCSS modules only where Fluent UI tokens don't reach.

**Gate:** Render tests pass. Accessibility checks clean. All strings resolve from
localization. Light, dark and high-contrast verified.

## Phase 7 — Navigation extension

Top navigation application customizer. Short-lived cache, refresh on page
navigation, no polling, `aria-current="page"` on the active link.

**Gate:** Active-link matching tests pass. Keyboard navigation and screen-reader
labelling verified. Confirmed to issue no business-data requests.

## Phase 8 — Risk Registry List web part

The harder of the two business web parts despite being "first," because it must
render dynamically from `RiskRegistryDataColumns` rather than a fixed column set —
pending confirmation of what that list actually configures (SCHEMA-TODO #11–13). A
misconfigured row (naming a field that doesn't exist on `RiskRegistryData`) must
degrade to a handled configuration-error state for that column, not a broken page.
Full property pane, ErrorBoundary, and all handled states (loading, empty,
access-denied, configuration-error, general error).

**Gate:** Search, filter, sort, selection, focus and scroll survive a background
refresh. Failure retains previous data. Dynamic-column rendering is covered by tests
including a deliberately misconfigured column row.

## Phase 9 — Risk Registry Detail web part

Single-risk view: core fields from `RiskRegistryData`, plus tabs/sections for
`RiskActions`, `RiskActivities`, `RiskUpdates`, `RiskAssignments` and
`RiskRegistryDocuments`. Detail routing by numeric `RiskId` from a URL query
parameter. Five related collections load in parallel (`Promise.all`); the view
commits only once all required collections for that risk have succeeded, per a
single coherent refresh cycle and a single displayed timestamp.

**Gate:** Tests pass per related-collection section; each section's own
empty/loading/error state is independently correct (a failure in `RiskActions`
must not blank `RiskUpdates`, if partial-data display is the chosen policy —
decide and document this explicitly for this web part, not left implicit). No
sensitive values in URLs beyond the numeric `RiskId`.

## Phase 10 — Cross-web-part coordination

Page-scoped coordinator wiring: selecting a row in List notifies Detail (via SPFx
Dynamic Data) to load that risk, if both are on the same page. A successful save in
Detail notifies List to refresh the affected row.

**Gate:** Deduplication and cross-web-part notification tests pass. Each web part
still works correctly as the only Risk Registry web part on a page.

## Phase 11 — Forms and concurrency

Gated on confirming read/write scope (SCHEMA-TODO cross-cutting #3). If confirmed in
scope: controlled inputs, validation, update DTOs, ETag concurrency, conflict
notification, unsaved-change guards, item-level refresh after save, reset of the
next scheduled poll after a successful save.

**Gate:** Conflict-handling and unsaved-form-preservation tests pass. Automatic
refresh provably cannot overwrite an active edit.

## Phase 12 — Hardening and documentation

Permission-aware actions with documented per-operation permissions, production log
strip, dependency audit, accessibility pass, responsive/Teams verification.

**Gate:** ESLint clean, no TypeScript errors, no production console logging, no
unresolved critical/high vulnerabilities. README, ARCHITECTURE, DATA-MODEL,
SECURITY, ACCESSIBILITY, TESTING, DEPLOYMENT, CHANGELOG complete.

## Phase 13 — Package and deploy

**Gate:** `npm run build` succeeds in production mode (`heft test --clean
--production && heft package-solution --production`), producing a `.sppkg`. Site
collection app catalog deployment, rollback and troubleshooting steps written and
followed on a dev/test site — not the production site — first.

---

## Decisions still to be made explicitly (not inferred)

| Question | Must be decided before |
| --- | --- |
| Read-only vs. read/write | Phase 11 scoping |
| `RiskId` join mechanism (Lookup vs. plain column vs. mixed) | Phase 4 |
| `RiskRegistryDataColumns` actual purpose | Phase 8 |
| Partial-data display policy for the Detail web part (show what loaded vs. all-or-nothing) | Phase 9 |
| Dev/test site availability for safe iteration | Phase 1 onward |
