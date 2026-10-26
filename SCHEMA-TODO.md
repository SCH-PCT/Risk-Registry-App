# SCHEMA-TODO

Open register of SharePoint schema facts the Risk Registry solution needs but has
not verified. Modelled on CRAWhiteboard-App's register of the same name — same
discipline: **no internal name, type, choice value, or relationship below is
guessed.** Everything is a placeholder until the discovery script runs against the
real site.

**Status as of 2026-10-22: `RiskRegistryData` is RESOLVED.** The user supplied the
full `/_api/web/lists/getbytitle('RiskRegistryData')/fields` XML dump for that list
(`RiskRegistryData_list_fields.txt`), and every field consumed by the Detail web part
was taken from that verified dump — none guessed. The other seven
lists/libraries remain unresolved; no authenticated connection to the target site has
been made from this environment for them. See the "Detail web part implementation
status" section below for exactly what that resolution does and does not unblock.

No repository, mapper, DTO or OData query may name a column that is not recorded in
`src/config/listSchema.ts`. For the four related lists and the documents library,
this is enforced at runtime, not just by review: `assertRelatedListConfigured`
(`src/data/repositories/pnp/unverifiedRelatedListError.ts`) throws a handled
`invalid-configuration` error before any OData request is built, so an unresolved
list can never be queried by a guessed column name.

---

## Why everything is unresolved

1. **The site URL.** Not supplied. It must be passed as a parameter to the discovery
   script at run time and must never be committed to source.
2. **An authenticated session.** This environment is non-interactive; PnP.PowerShell
   interactive sign-in cannot be completed here. PnP.PowerShell 3.1.0, 2.4.0 and
   1.12.0 are installed and available for a human to run the script locally.

The eight list/library *titles* below are taken directly from the requirements and
treated as given. Everything else — internal names, field types, choice values,
lookup vs. plain-column relationships, folder-naming convention — is unknown.

---

## How to resolve

```powershell
cd C:\Users\de-jzhang\Projects\Risk-Registry-App\scripts
.\Get-RiskRegistrySchema.ps1 -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" -ClientId "<app-id>"
```

Outputs `docs/schema-report.json` and `docs/schema-report.md`. Transfer verified
internal names into `src/config/listSchema.ts` (created in Phase 2) and close the
corresponding row below.

If PnP interactive login has never been registered for this tenant:

```powershell
Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP Risk Registry Schema" -Tenant <tenant>.onmicrosoft.com
```

This registration is for the **discovery script only** — a developer tool, not a
dependency of the shipped SPFx package. The solution itself uses only the current
site context and requires no app registration and no Graph permissions.

---

## Detail web part implementation status (2026-10-22)

The Risk Registry Detail web part (`src/webparts/riskRegistryDetail`) is implemented
against `RiskRegistryData` only. For the four related lists below, "unresolved
schema" is enforced as a distinct **not-configured** UI state, never a guess:

- `RiskActions`, `RiskActivities`, `RiskUpdates`, `RiskAssignments` — the repository
  stubs (`src/data/repositories/pnp/PnpRisk*Repository.ts`) call
  `assertRelatedListConfigured`, which throws before any query is built. The Detail
  page's corresponding section renders "not configured yet" rather than an error or
  empty data, and this is covered by the repository-level guard, not just the UI.
- `RiskRegistryDocuments` — partially implemented. It queries the document library
  using only **universal** SharePoint file/folder REST properties (name,
  server-relative URL) under a folder path built as `<library root>/<RiskID value>`.
  **That folder-naming convention (raw numeric `RiskID`, no padding or prefix) is an
  assumption, not a verified fact** — row 27 below is still open. If the real
  convention differs, only `PnpRiskDocumentRepository.ts`'s path-building needs to
  change; a 404 on the assumed path is already treated as "no documents" rather than
  a hard error, so a wrong guess fails safely rather than throwing.

Resolving any of rows 14–31 below unblocks replacing that list's stub with a real
implementation — the repository interface, mock, and UI section are already in
place and expect exactly the shape `getForRisk(riskSystemId): Promise<T[]>`.

## `appTopNavigation` — UNRESOLVED

Purpose: top navigation configuration for the application customizer.

Do **not** assume this matches any other project's `appTopNavigation` schema even if
the title is identical — it is a different list on a different site. Specifically
unverified:

| # | Question | Blocks |
| --- | --- | --- |
| 1 | Internal names for title/URL/parent/sort-order columns (if those concepts exist at all) | Nav rendering |
| 2 | Is the URL column a Text field (untrusted, needs protocol validation before use in `href`) or a Hyperlink field? | XSS surface |
| 3 | Is there a visibility flag, an open-in-new-tab flag, or audience targeting? | Nav feature scope |
| 4 | Is the parent-reference column a Lookup, or a Text value matched against another row's title? | Nav tree construction, uniqueness |

## `RiskRegistryData` — RESOLVED (2026-10-22)

Purpose: the risk register itself — the parent entity for every child list.

Source: full `fields` endpoint XML dump supplied by the user, transcribed verbatim
into `src/config/listSchema.ts` as `RISK_REGISTRY_DATA_FIELDS` (~79 fields, each
carrying its verified `internalName`/`displayName`/type/required/maxLength/choices).
Every field the Detail web part renders or edits is resolved through
`getRiskRegistryDataField()` — there is no hand-typed internal-name string anywhere
in the webpart/hook/mapper/repository layers.

| # | Question | Resolution |
| --- | --- | --- |
| 5 | What is the internal name of `RiskId`, and is it a custom column distinct from the system `ID`? | `RiskID` is a verified custom field (`riskId` logical key), distinct from the list-item system `ID` used for the `?id=` query-string identifier. The Detail web part's URL contract uses the system `ID` only — see `src/utilities/itemIdentifier.ts`. |
| 6 | What columns exist for risk category, likelihood, impact/severity, score, status, owner, target/review dates, description? | All present and catalogued; see `RISK_REGISTRY_DATA_FIELDS` for the full list and `src/webparts/riskRegistryDetail/components/detailSections.ts` for how they're grouped into the 7 detail sections. |
| 7 | Are likelihood/impact/status Choice fields or free text? | Verified Choice fields, with the actual choice values transcribed into the shared constants (`YES_NO_UNKNOWN`, `PENDING_REQUEST_READY`, etc.) in `listSchema.ts` — not re-derived or guessed. |
| 8 | Which columns are indexed? | Not recorded in the supplied fields dump (indexing isn't exposed by that endpoint). Still open — not a blocker for the Detail web part, which queries by system `ID` only; would matter for a future List/grid web part doing `$filter` queries. |
| 9 | Is there an owner/assignee Person field directly on this list? | Yes — several verified `User` (Person) fields exist directly on `RiskRegistryData`. **Scope decision:** these are rendered read-only in both view and edit mode in the Detail web part (see `isFieldReadOnlyForEditing` in `riskRegistryMapper.ts`) — editing a Person field via a people-picker was explicitly out of scope for this phase, not unresolved schema. |
| 10 | Item-level permissions in use? | Not knowable from the fields dump; handled defensively regardless — `PnpWebPermissionsService.canEditItem` checks the current user's effective permissions on the specific item (not just the list) and fails closed on any error. |

## `RiskRegistryDataColumns` — UNRESOLVED

Purpose stated in the brief: "Columns of risk registry." Working assumption —
**unverified** — is that this list configures which `RiskRegistryData` fields the
List web part's grid displays (name, display label, order, visibility, data type).

| # | Question | Blocks |
| --- | --- | --- |
| 11 | Confirm the assumption above. Could instead be a picklist/lookup source (e.g. valid categories) rather than grid configuration. | List web part design entirely — this gates Phase 8 |
| 12 | If it is grid configuration: what are the actual column names (e.g. `InternalName`, `DisplayName`, `ColumnType`, `SortOrder`, `IsVisible`)? | Dynamic-columns rendering |
| 13 | Does it reference `RiskRegistryData` by field internal name as a string, requiring runtime validation against the live field list before use? | Safety of dynamic rendering (must not let a misconfigured row request a nonexistent column) |

## `RiskActions` — UNRESOLVED

Purpose: actions related to risks, linked by `RiskId`.

| # | Question | Blocks |
| --- | --- | --- |
| 14 | Internal name and type of the `RiskId` link column | Join strategy |
| 15 | Action fields: description, owner, due date, status/completion — names and types | Detail web part actions tab |
| 16 | Is action status a Choice field? | StatusBadge |

## `RiskActivities` — UNRESOLVED

Purpose: activities related to risks, linked by `RiskId`.

| # | Question | Blocks |
| --- | --- | --- |
| 17 | Internal name and type of the `RiskId` link column | Join strategy |
| 18 | Activity fields: what constitutes an "activity" distinct from an "update" here — date, description, actor | Detail web part activity tab |
| 19 | Any rich-text/Note fields requiring sanitization before render? | XSS surface |

## `RiskUpdates` — UNRESOLVED

Purpose: updates related to risks, linked by `RiskId`.

| # | Question | Blocks |
| --- | --- | --- |
| 20 | Internal name and type of the `RiskId` link column | Join strategy |
| 21 | Update fields: author, date, note/body — names and types | Detail web part updates tab |
| 22 | Any rich-text/Note fields requiring sanitization before render? | XSS surface |

## `RiskAssignments` — UNRESOLVED

Purpose: risk registry assignments, linked by `RiskId`.

| # | Question | Blocks |
| --- | --- | --- |
| 23 | Internal name and type of the `RiskId` link column | Join strategy |
| 24 | Assignee field: Person field or Text? | PersonDisplay |
| 25 | Role/type of assignment (e.g. owner vs. reviewer) — Choice or free text? | Assignment display, permission-aware actions |
| 26 | Can a risk have multiple concurrent assignments, or is this 1:1? | Detail web part layout |

## `RiskRegistryDocuments` — UNRESOLVED (document library, not a list)

Purpose: documents related to risks, linked by `RiskId`, **grouped by folders with
`RiskId` as the folder name**.

| # | Question | Blocks |
| --- | --- | --- |
| 27 | Exact folder-naming convention — raw numeric `RiskId`, zero-padded, or some other formatted value? | Folder-path resolution in the repository |
| 28 | Does the document content type carry a `RiskId` (or similar) column in addition to the folder convention, enabling a `$filter`-based query instead of folder traversal? | Query efficiency — avoids an extra round trip per risk |
| 29 | Are folders created automatically (e.g. by a flow) when a risk is created, or could a risk have no folder yet? | Empty-state handling in the Detail web part's documents tab |
| 30 | Any metadata columns on documents (document type, version, confidentiality) beyond the default library fields? | Document list rendering |
| 31 | Are nested folders possible under a risk's folder, or always a flat file list? | Document browsing UX |

---

## Cross-cutting questions

| # | Question | Blocks | Status |
| --- | --- | --- | --- |
| 1 | Site URL for the target site collection | All discovery | Open — must be supplied by a human before the script can run |
| 2 | Is there a separate dev/test site for safe iteration? | Safe iteration | Open |
| 3 | Is the solution read-only, or does it also write (create/edit risks, actions, updates, assignments)? | Forms/ETag layer scope (Phase 11) | Open — the brief's "FORMS AND UPDATES" section implies write, but this should be confirmed explicitly, the way CRAWhiteboard recorded its read/write decision as a dated entry |
| 4 | Is `RiskId` consistently a Lookup column, or consistently a plain Number/Text column, across all five child lists + the document library? | Repository design (Phase 4) — a mixed answer (some Lookup, some plain) would require two join strategies | Open |
| 5 | Expected item volume per list | Whether paging/indexing are day-one concerns | Open |
| 6 | Do any of these lists carry item-level permissions? | Permission-aware actions, access-denied states | Open |
| 7 | Which columns are indexed today | Query design against the 5,000-item threshold | Open |
