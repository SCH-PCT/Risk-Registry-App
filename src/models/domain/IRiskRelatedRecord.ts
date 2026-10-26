/**
 * Placeholder shapes for the four related entities whose schema is not yet
 * verified (`RiskActions`, `RiskActivities`, `RiskUpdates`, `RiskAssignments`
 * — see SCHEMA-TODO.md). Each is its own named type, not a shared generic,
 * so that verifying one list's schema later is a change to one interface
 * and its repository, not a ripple through the others.
 *
 * None of these is ever constructed from real data today — every repository
 * for these four entities resolves to a `not-configured` section state
 * before a row shaped like this could exist. They exist now so the related
 * section components, hooks and tests have a concrete type to compile
 * against, and so adding real fields later is additive.
 */

export interface IRiskAction {
  readonly id: number;
  readonly title: string;
}

export interface IRiskActivity {
  readonly id: number;
  readonly title: string;
}

export interface IRiskUpdateRecord {
  readonly id: number;
  readonly title: string;
}

export interface IRiskAssignment {
  readonly id: number;
  readonly title: string;
}
