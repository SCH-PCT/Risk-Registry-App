# CHANGELOG

Not following a strict SemVer release cadence yet — this project has not shipped a
versioned release. Entries are dated by the work session that produced them.

## 2026-10-22 — Blank-id item creation on the Detail web part

Added support for creating a new `RiskRegistryData` item when the Detail web
part's `id` query-string parameter is **missing** (not merely invalid):

- `src/utilities/itemIdentifier.ts` already distinguished a missing `id`
  (`reason: 'missing'`) from a present-but-malformed one; `RiskRegistryDetail.tsx`
  now branches on that distinction instead of treating both as the same
  `invalid-identifier` error. A present but malformed `id` still renders the
  unchanged "This link does not point at a valid risk record." error.
- New `IRiskRegistryRepository.create()` (Pnp + mock), reusing
  `buildUpdatePayload` for the write payload and the same
  verify-then-re-read-via-`getById` pattern `update()` already uses, so the
  created item comes back with a full field set and a current ETag.
- New `IWebPermissionsService.canAddItems()` (Pnp + mock) — a list-level
  `AddListItems` effective-permission check, fail-closed like `canEditItem`.
- New `useRiskRegistryCreate` hook and `RiskRegistryDetailNew` component: the
  same field catalog, section layout, generic field renderer and validation as
  the existing-item edit form, always in edit mode, with no related-entity
  sections (none can exist yet for an item that has not been created).
- On a successful create, the page hands off to the normal view/edit flow for
  the new item and updates the address bar to its `id` via
  `history.replaceState` — not a navigation — so a later refresh reopens the
  created record rather than the creation form again.
- 8 new Jest/RTL tests (blank-id form rendering, malformed-id error unchanged,
  required-field validation, permission denial, successful create-and-switch)
  plus 3 new repository-level tests for `MockRiskRegistryRepository.create`.
  Full suite now 70/70; full build/test/package gate re-verified green.

## 2026-10-22 — Risk Registry Detail web part

Added the `riskRegistryDetail` web part: displays and edits a single
`RiskRegistryData` item plus its related entities, identified by the `id`
query-string parameter on the page.

- `src/config/listSchema.ts`: added the full verified `RiskRegistryData` field
  catalog (~79 fields, from the user-supplied `fields` endpoint XML dump) and
  unresolved stub definitions for the four related lists and the documents
  library.
- New layered implementation: DTO → mapper → domain model → repository
  (pnp + mock per interface) → `useRiskRegistryDetail` hook → presentation
  components, all column names resolved through the schema catalog.
- Generic field-renderer/validation architecture driven by `IRiskFieldDefinition`
  instead of hand-written per-field blocks.
- ETag-based optimistic concurrency: conflicting server changes surface a
  non-destructive banner (reload or keep editing), both on background refresh and
  on save; never an automatic overwrite.
- Shared auto-refresh framework (`useAutoRefresh` + `RefreshCoordinator`) reused
  from the common architecture — 60s default, configurable via the property pane,
  pauses on hidden tab/offline, never clobbers an in-progress edit.
- Permission-aware Edit/Save controls, checked per item and failing closed.
- Defensive sanitization of Note-type fields before render, independent of the
  verified `RichText=FALSE` schema.
- Four related-list sections (`RiskActions`, `RiskActivities`, `RiskUpdates`,
  `RiskAssignments`) render a "not configured" status rather than guessed data,
  since their schema remains unverified — enforced at the repository layer via
  `assertRelatedListConfigured`, not just in the UI.
- `RiskRegistryDocuments` partially implemented against universal SharePoint
  file/folder properties, under an assumed (documented, unverified) folder-naming
  convention.
- 62 Jest/RTL tests covering invalid identifiers, missing items, access denial,
  edit validation, concurrency conflicts (both refresh- and save-time), unsaved
  changes, linked documents, and sensitive-data logging controls.
- Full build/test/package gate verified: `heft build --clean`,
  `heft test --clean --production` (62/62), `heft package-solution --production`
  producing `risk-registry.sppkg` with both the navigation customizer and the new
  Detail web part.

**Known gaps carried forward:** the four related lists' schema, and the documents
folder-naming convention, remain unresolved/assumed — see SCHEMA-TODO.md.

## 2026-10-21 — Risk Registry Top Navigation application customizer

Added the `riskRegistryTopNavigation` application customizer, ported from the
`CRAWhiteboard-App` reference project's equivalent component and adapted for this
solution:

- Dropped the reference's page-chrome-hiding/admin-menu feature (unsupported DOM
  manipulation, out of scope).
- Replaced the reference's Google Fonts icon-font dependency with Fluent UI's
  built-in `Icon` component (no external network dependency).
- Replaced the reference's hard-coded brand palette with SharePoint theme CSS
  variables, so the bar follows the site's actual theme.
- Added localization (`loc/en-us.js`), which the reference project lacked.
- Scaffolded the `Risk-Registry-App` SPFx project from scratch (the reference
  project was read-only and never modified).
- Verified via `npm install`, `heft build`, `heft test --production`,
  `heft package-solution --production`.

**Known gap carried forward:** `appTopNavigation`'s field mapping was an
unverified assumption at this point — resolved for `RiskRegistryData` in the next
entry above, but `appTopNavigation` itself remains unverified.

## 2026-10-21 — Architecture and planning

Initial repository inspection, SPFx/Node environment validation, proposed
architecture and folder structure, schema-discovery PowerShell script, and the
phased implementation plan. No source code written at this stage — see
ARCHITECTURE.md, IMPLEMENTATION-PLAN.md, and SCHEMA-TODO.md.
