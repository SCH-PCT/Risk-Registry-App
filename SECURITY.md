# SECURITY

Scope of this document: the **Risk Registry Top Navigation application customizer**
and the **Risk Registry Detail web part** — the two components implemented so far.
It will be extended again when the List web part is built.

## Dependency vulnerability disposition (updated 2026-10-22)

`npm audit` after `npm install`: **54 findings — 33 moderate, 21 high, 0 critical.**
(Totals shift slightly release to release as the test-tooling dependency tree
changes — e.g. `@testing-library/*` added for the Detail web part's test suite —
without changing the disposition below.)

```
npm audit --omit=dev   →  0 vulnerabilities
```

**Disposition: accepted, dev-only, not shipped.** Every high-severity finding is in
the SPFx 1.23.2 build toolchain (`@rushstack/heft` and its plugins, pinned via the
`overrides` field in `package.json`, exactly as `@microsoft/spfx-web-build-rig@1.23.2`
requires) or that toolchain's own transitive dependencies (`webpack-dev-server`,
`http-proxy-middleware`, `chokidar`, `braces`, `micromatch`, `fast-glob`,
`node-forge`, `@rushstack/debug-certificate-manager`). All of these run only during
`heft build` / `heft start` on a developer's machine; `npm audit --omit=dev` confirms
**zero** vulnerabilities reach the production dependency tree that ships inside the
`.sppkg`.

These versions are not independently upgradable without breaking the pinned SPFx
1.23.2 build chain. Re-check this disposition whenever `@microsoft/spfx-web-build-rig`
or `@rushstack/heft` is bumped, or on a periodic security review — a toolchain CVE can
still matter if a developer's machine or CI runner is itself a target, even though it
never reaches an end user.

## Navigation-specific security notes

- **`appTopNavigation.URL` is treated as untrusted input**, not because it is verified
  to be a plain Text column on this site (it is not — see SCHEMA-TODO.md), but
  *regardless* of what discovery eventually confirms. Every value is scheme-checked
  (`http:`/`https:`/site-relative only) by `utilities/urlNormalization.ts` before it
  can reach an `href`. A `javascript:` or `data:` row is dropped with a diagnostic,
  never rendered. See `MockNavigationRepository`'s deliberately hostile fixture row,
  which exercises this path on every local run.
- **No patient/business-record data flows through this component.** The navigation
  list is assumed to carry only link configuration (title, URL, parent, sort order) —
  no PHI, no risk content. It is the one list in the eventual solution eligible for
  any in-memory caching, per ARCHITECTURE.md.
- **Diagnostics never echo the offending value.** A dropped row's log entry names the
  item ID and the *reason* (e.g. `unsafe-url`), never the URL text itself — so a
  hostile row cannot smuggle a payload into a log via its own rejection message.
- **Render errors are never logged or sent anywhere except the local browser console**
  (`components/common/ErrorBoundary.tsx`), consistent with the broader solution's rule
  against telemetry that could carry record values.
- **No permission-gated actions exist in this component.** The navigation renders the
  same set of links to every user; SharePoint's list-level read permission on
  `appTopNavigation` is the only access boundary, and a user without read access to
  that list sees a quiet "navigation unavailable" status rather than an error page.

## Detail web part security notes

- **The `id` query-string parameter is strictly validated before any network call.**
  `utilities/itemIdentifier.ts` accepts only a positive integer with no leading
  zeros, no decimals, no surrounding characters (`482` valid; `"007"`, `"-4"`,
  `"4.0"`, `"482abc"`, `"482; DROP TABLE"`, `"<script>"` all rejected). A rejected
  value renders a handled "invalid link" state and **the repository is never
  constructed or called** — this is asserted directly in
  `RiskRegistryDetail.test.tsx` ("invalid identifier" describe block). The
  user-facing error message (`describeItemIdentifierError`) never echoes the raw
  query-string value back, so a crafted value cannot be reflected into the page via
  its own error text.
- **Sensitive record data is never logged.** No `console.log`/`info`/`debug` call
  anywhere in the Detail web part's load, edit, save, or refresh paths. Enforced by
  a dedicated test that spies on all three console methods across a full
  load → edit → save cycle and asserts zero calls.
- **Permission checks happen before, not instead of, UI gating.**
  `PnpWebPermissionsService.canEditItem` checks the current user's *effective
  permissions on the specific item* (not just list-level access), and fails closed —
  any error while checking is treated as "cannot edit." `PermissionAwareAction`
  keeps Edit/Save hidden while the check is in flight or has failed, so there is no
  window where a denied or not-yet-confirmed user sees an actionable control.
- **ETag concurrency prevents silent overwrites, by design, in both directions.**
  Mid-edit, a background refresh that detects a changed server ETag only raises a
  conflict banner — it never touches the in-progress draft. At save time, a stale
  ETag causes the server's 412 to be converted into a handled conflict (offering
  "Reload" or "keep editing"), never an automatic merge or force-overwrite. Both
  paths are covered by tests in the "concurrency conflict" describe block.
- **Note-field content is sanitized before render even though the verified schema
  shows plain text.** `sanitizeNoteText` strips tag-like substrings and
  `javascript:`/`data:`/`vbscript:` scheme prefixes defensively; `dangerouslySetInnerHTML`
  is not used anywhere in this component. Covered by the "Note field containing
  markup" test, which asserts no live `<img>` or `[onerror]` element reaches the DOM.
- **People/User fields are read-only**, in both view and edit mode, closing off the
  people-picker as an unreviewed input surface for this phase.
- **Creating a new record (blank `id`) is gated the same fail-closed way editing
  is**, on the current user's effective `AddListItems` permission on
  `RiskRegistryData` (`PnpWebPermissionsService.canAddItems`) — any error while
  checking is treated as "cannot create," and the Create control never renders
  actionable while the check is in flight. As with editing, this is a UI
  convenience, not the access-control boundary: SharePoint enforces the real
  list-level write permission on the `items.add()` request regardless.
- **Related-list and document data a user cannot reconstruct themselves is never
  fabricated.** The four related lists whose schema is unresolved render a
  "not configured" status, never guessed field names or empty-but-silent data; the
  guard (`assertRelatedListConfigured`) throws before any OData request naming an
  unverified column could be built.

## Known gaps, tracked

- `config/listSchema.ts`'s `appTopNavigation` field mapping is an **unverified
  assumption** carried over from a different project's site, not a result of
  running `scripts/Get-RiskRegistrySchema.ps1` against this solution's actual site.
  See the warning at the top of that file and SCHEMA-TODO.md items #1–4. This must
  be confirmed before production deployment. Because every column reference
  resolves through `requireField`/`optionalField`, a wrong assumption fails as a
  handled `invalid-configuration` state in the navigation bar rather than exposing
  a raw SharePoint error or rendering silently wrong data — but it is not yet a
  verified fact.
- The Detail web part's `RiskRegistryDocuments` folder-naming convention
  (`<library root>/<RiskID>`) is an **assumption**, not a verified fact — see
  SCHEMA-TODO.md. A wrong assumption fails safely (treated as "no documents," not
  an error, not a crash), but should be confirmed before production use.
- The four related lists (`RiskActions`, `RiskActivities`, `RiskUpdates`,
  `RiskAssignments`) have no verified schema at all yet, so there is nothing
  security-relevant to say about their fields beyond: nothing is queried from them
  until that changes.
