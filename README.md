# Risk Registry

SharePoint Framework solution for a Risk Registry site. **Currently implemented:
the top navigation application customizer, and the Risk Registry Detail web part.**
The List web part described in ARCHITECTURE.md is not yet built — see
IMPLEMENTATION-PLAN.md.

## What this is

An SPFx 1.23.2 application customizer that renders a top navigation bar — read from
the `appTopNavigation` list on the site where the package is installed — into the
`Top` placeholder on every page. It was built by porting the equivalent component
from a separate reference project (`CRAWhiteboard-App`), adapted as follows:

| Reference component | This component |
| --- | --- |
| Hid/showed SharePoint's own page header and command bar via undocumented DOM selectors, plus an "Edit Page" / "Site Settings" admin dropdown | **Not ported.** Out of this brief's scope, relied on unsupported DOM manipulation, and needed a Fluent v8/v9 theming bridge this project hasn't validated (see IMPLEMENTATION-PLAN.md Phase 0b, still open) |
| Icons via a ligature webfont loaded from Google Fonts at runtime | Fluent UI's built-in `Icon` component — no external network dependency |
| Hard-coded brand hex palette ("Clinical Clarity") | SharePoint's native `--theme*`/`--neutral*` CSS custom properties, with Fluent-blue fallbacks — follows the site's actual theme instead of a fixed palette |
| UI strings hard-coded in the component | Extracted to a localization resource module (`loc/en-us.js`) |

Everything else — the list read, hierarchy building (parent/child by `Title`/`Parent`
text match, since there is no lookup column), URL safety validation, active-item
matching across SharePoint's soft page navigation, the 5-minute in-memory cache with
no polling, and the overflow menu for narrow viewports — is a faithful port.

⚠️ **The `appTopNavigation` field mapping in `src/config/listSchema.ts` is an
unverified assumption**, carried over from the reference project's *different* site.
It has not been confirmed against this solution's real site. See SCHEMA-TODO.md and
the warning at the top of that file. Run `scripts/Get-RiskRegistrySchema.ps1` against
the real site before relying on this in production.

## Risk Registry Detail web part

Displays and edits a single `RiskRegistryData` item, plus its related entities,
on a modern SharePoint page.

**URL contract.** The item is identified by the page's `id` query-string parameter
(e.g. `.../SitePages/RiskDetail.aspx?id=482`) — the SharePoint system `ID`, not the
list's `RiskID` business field. Three cases:

- A value matching a strict positive-integer pattern (no leading zeros, no
  decimals, no surrounding text) loads and displays that item.
- A **missing** `id` (e.g. `.../SitePages/RiskDetail.aspx` with no query string at
  all) is treated as "create a new risk record" — see below — not an error.
- Any other value (`"007"`, `"-4"`, `"4.0"`, `"482abc"`, etc.) renders a handled
  "invalid link" state and **never calls the repository at all**.

See `src/utilities/itemIdentifier.ts`.

**Creating a new record.** With a blank `id`, the page renders a creation form
instead of the invalid-link error — the same field catalog, layout and validation
as the edit form, always in edit mode, with no related-entity sections (none can
exist yet for an item that has not been created). Creating is gated on the
current user's effective `AddListItems` permission on `RiskRegistryData`, checked
the same fail-closed way editing is. On success, the page switches straight to
the normal view/edit flow for the new item and updates the address bar to its
`id` via `history.replaceState` (not a navigation), so a later refresh reopens the
created record instead of the creation form again.

**Schema status.** `RiskRegistryData` itself is fully resolved against a verified
field dump (~79 fields, see SCHEMA-TODO.md) — every field read or written goes
through `src/config/listSchema.ts`, never a hand-typed internal name. The four
related lists (`RiskActions`, `RiskActivities`, `RiskUpdates`, `RiskAssignments`)
are schema-unresolved and render as "not configured yet" rather than guessed data.
`RiskRegistryDocuments` is partially wired up: it lists files under a folder path
assumed to be `<library root>/<RiskID>` — an assumption, not a verified fact (see
SCHEMA-TODO.md) — and treats a missing folder as "no documents," not an error.

**Editing.** Edit mode is permission-gated (hidden, not just disabled, until the
current user's effective permissions on that specific item are confirmed). Save
stays disabled until the draft is both valid (per-field rules derived from the
same field catalog: required, max length, Choice membership) and changed from the
loaded baseline. Saves use SharePoint ETags for optimistic concurrency: if the
server copy changed since the edit session started, Save surfaces a non-destructive
conflict banner (offering "Reload" or "keep editing") instead of overwriting
someone else's change. Person/User fields are read-only in both view and edit mode
— editing them via a people-picker was out of scope for this phase.

**Refresh.** Auto-refresh (default 60s, configurable 30/60/120/300/600/900s via the
property pane, or disabled) re-fetches the primary record and related sections only
— it never remounts the page, never overwrites an in-progress edit (it only checks
for a conflicting ETag while editing), and restarts its interval after a successful
save. Tab/scroll/focus state is preserved across a refresh cycle.

**Known gaps**, tracked in SCHEMA-TODO.md:
- The four related-list sections cannot show real data until their schema is
  verified against the real site.
- The documents folder-naming convention is assumed, not confirmed.

## Local development

Requirements (already verified on the machine this was built on):

- Node.js `>=22.14.0 <23.0.0` (built against 22.19.0)
- npm 10.x
- `@microsoft/generator-sharepoint@1.23.2` if you want to scaffold additional
  components with `yo @microsoft/sharepoint`

```powershell
npm install
npm run start     # heft start --clean — serves locally
```

The workbench **cannot** host this extension — it has no Top placeholder and no
`appTopNavigation` list. To debug it against a real page, edit
`config/serve.json`'s `riskRegistryTopNavigation.pageUrl` to a modern page on a site
that has the list, then:

```powershell
npm run start
```

and add `?debugManifestsFile=https://localhost:4321/temp/manifests.js` to that page's
URL (SPFx's standard local-workbench-free debugging flow for extensions).

## Build

```powershell
npx heft build --clean                      # typescript + lint + sass + webpack (debug)
npx heft test --clean --production          # production build + jest
npx heft package-solution --production      # produces sharepoint/solution/risk-registry.sppkg
```

or, equivalently, the single script:

```powershell
npm run build
```

All three succeeded on this machine on 2026-10-22: 0 TypeScript errors, ESLint
clean, production Jest run green (70/70 tests, covering the Detail web part —
invalid/missing/denied items, blank-id item creation (validation, permission
denial, successful create handing off to the normal view/edit flow), edit
validation, concurrency conflicts on both refresh and save, unsaved-changes
prompting, linked documents, sensitive-data logging controls, and Note-field
markup sanitization), `.sppkg` produced at `sharepoint/solution/risk-registry.sppkg`
containing both the navigation customizer and the Detail web part. The navigation
customizer itself still has no automated tests — see Known gaps below.

## Deployment — site collection app catalog

Per `config/package-solution.json` (`skipFeatureDeployment: false`,
`isDomainIsolated: false`, `includeClientSideAssets: true`):

1. If the target site collection does not already have an app catalog, a SharePoint
   administrator must enable one for it (Site Settings → Apps → *App Catalog*, or
   `Add-SPOSiteCollectionAppCatalog` for an admin).
2. Upload `sharepoint/solution/risk-registry.sppkg` to `<site>/AppCatalog`.
3. Trust it when prompted (it requests no API permissions — it only reads lists on
   the current site via the ambient SPFx context).
4. From **Site Contents → New → App**, add "Risk Registry" to the site. The
   application customizer activates automatically on every page in that site; there
   is no web part to place for this component.
5. Confirm the `appTopNavigation` list exists on the site with rows the current user
   can read. If it does not, the navigation bar renders a quiet status message
   instead of a broken list — see `_handleError` in
   `RiskRegistryTopNavigationApplicationCustomizer.ts`.

This deploys to **one site collection only**, by design — the same reasoning as the
reference project: the navigation reads a list specific to this site, so a tenant-wide
rollout would render an empty, erroring bar on every other site in the tenant.

### Rollback

Remove the app from the site (**Site Contents** → find "Risk Registry" → **Remove**),
then delete the package version from that site collection's app catalog if it should
no longer be installable there.

### Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Nothing renders in the Top placeholder | Page type has no Top placeholder (logged at Info level) — expected on some page types, not a bug |
| Navigation shows a quiet "could not load" status | `appTopNavigation` missing, access denied, or a declared column in `listSchema.ts` does not exist on this site's list — check browser console for a `RiskRegistryTopNavigationApplicationCustomizer` warning naming the `NavigationError` kind |
| A link is missing from the bar | Check `_logDiagnostics()`'s console warnings — a row was dropped (`missing-title`, `missing-url`, `unsafe-url`) or demoted (`ambiguous-parent`, `circular-parent`, `depth-exceeded`); the warning names the reason without echoing the row's data |
| Extension installs but never appears, even on a page with a Top placeholder | `ClientSideComponentId` mismatch between the manifest, `elements.xml`, and `ClientSideInstance.xml` — all three must share `8ed72716-81d8-4c21-b141-024414347ad5` |

## Known gaps

- **`appTopNavigation` schema unverified** (see above and SCHEMA-TODO.md).
  `RiskRegistryData` itself is now resolved; the navigation list is not.
- **No automated tests yet for the navigation customizer.** `heft test` for that
  component still runs 0 suites — the harness works, tests have not been written.
  The pure logic (`navigationOverflow.ts`, `navigationMapper.ts`,
  `urlNormalization.ts`, `navigationService.ts`) is written to be unit-testable
  without an SPFx context or real timers; writing those tests is still open. The
  Detail web part, by contrast, has 62 passing tests (see Build above).
- **Risk Registry List web part is not yet implemented**, and the four related
  lists + the documents folder convention consumed by the Detail web part remain
  schema-unresolved. See ARCHITECTURE.md and SCHEMA-TODO.md.
- **54 `npm audit` findings (21 high, 33 moderate)**, all dev-toolchain-only
  (Jest/webpack-dev-server/uuid transitive chains) — see SECURITY.md for the full
  disposition.
