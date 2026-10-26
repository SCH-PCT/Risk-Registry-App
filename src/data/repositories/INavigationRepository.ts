/**
 * Read access to the navigation configuration list.
 *
 * An interface rather than a class so the application customizer can be exercised
 * against a mock without an SPFx context, and so the PnPjs dependency stops at the
 * implementation. Nothing above this layer knows OData exists.
 */

import { INavigationConfiguration } from '../../models/domain/INavigationItem';

/**
 * How a navigation read failed. The customizer renders differently for each: a
 * configuration fault is the site owner's problem and worth surfacing, while a
 * transient one should leave whatever is on screen alone.
 */
export type NavigationErrorKind =
  /** The configured list does not exist on this site. */
  | 'list-not-found'
  /** The list exists but the current user cannot read it. */
  | 'access-denied'
  /** A declared column is missing or unverified — a `listSchema.ts` problem. */
  | 'invalid-configuration'
  /** Network failure, throttling, or a server error. Retrying may succeed. */
  | 'transient';

/**
 * A navigation read failure carrying enough context to decide what to render.
 *
 * Deliberately not a plain `Error`: the distinction between "this site is misconfigured"
 * and "the network blipped" drives both retry behaviour and what the user sees, and
 * recovering that from a message string is guesswork.
 */
export class NavigationError extends Error {
  public readonly kind: NavigationErrorKind;
  /** True when a later attempt could reasonably succeed. */
  public readonly isRetryable: boolean;

  public constructor(kind: NavigationErrorKind, message: string) {
    super(message);
    this.name = 'NavigationError';
    this.kind = kind;
    this.isRetryable = kind === 'transient';

    // Required for `instanceof` to work when the class is compiled down to ES5, which
    // the SPFx build does. Without it every NavigationError reads as a plain Error.
    Object.setPrototypeOf(this, NavigationError.prototype);
  }
}

/** Reads and validates navigation configuration for the current site. */
export interface INavigationRepository {
  /**
   * Fetches the navigation configuration.
   *
   * Rejects with a {@link NavigationError} for every failure mode. Malformed *rows* are
   * not failures — they are dropped and reported through
   * `INavigationConfiguration.diagnostics`, so one bad row never costs the whole bar.
   */
  getNavigation(): Promise<INavigationConfiguration>;
}
