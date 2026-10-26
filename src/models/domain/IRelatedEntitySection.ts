/**
 * State for one related-entity section (Actions, Activities, Updates,
 * Assignments, Documents) on the Detail web part.
 *
 * `not-configured` is a first-class, expected state here — not an error —
 * for `RiskActions`, `RiskActivities`, `RiskUpdates` and `RiskAssignments`,
 * whose schema and relationship to `RiskRegistryData` have not been verified
 * (see SCHEMA-TODO.md). A section in that state renders a clear "pending
 * schema discovery" message rather than a fabricated column name or a
 * generic error, so the distinction between "nothing here yet" and "this is
 * broken" and "this hasn't been wired up" stays visible to whoever is
 * looking at the page.
 */
export type RelatedEntitySectionStatus = 'not-configured' | 'loading' | 'loaded' | 'error' | 'access-denied';

export interface IRelatedEntitySectionState<T> {
  readonly status: RelatedEntitySectionStatus;
  readonly items: readonly T[];
  /** Set only when `status === 'error'`. Generic, user-safe — never a raw SharePoint response. */
  readonly errorMessage?: string;
}

export function notConfiguredSection<T>(): IRelatedEntitySectionState<T> {
  return { status: 'not-configured', items: [] };
}

export function loadingSection<T>(): IRelatedEntitySectionState<T> {
  return { status: 'loading', items: [] };
}

export function loadedSection<T>(items: readonly T[]): IRelatedEntitySectionState<T> {
  return { status: 'loaded', items };
}

export function errorSection<T>(errorMessage: string): IRelatedEntitySectionState<T> {
  return { status: 'error', items: [], errorMessage };
}

export function accessDeniedSection<T>(): IRelatedEntitySectionState<T> {
  return { status: 'access-denied', items: [] };
}
