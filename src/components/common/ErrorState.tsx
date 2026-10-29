import * as React from 'react';
import { IButtonStyles, MessageBar, MessageBarType, DefaultButton, PrimaryButton } from '@fluentui/react';

import { BUTTON_CORNER_RADIUS } from '../../styles/buttonCornerRadius';
import { GoBackButton } from './GoBackButton';
import styles from './ErrorState.module.scss';

const BUTTON_STYLES: IButtonStyles = { root: { borderRadius: BUTTON_CORNER_RADIUS } };

/**
 * The handled error states a Risk Registry web part can be in.
 *
 * Kept as a closed set rather than a free-text message so that every caller
 * is forced to classify a failure before showing it — which is what keeps a
 * raw SharePoint error body from ever reaching a user. See each variant's
 * description for the generic, user-safe copy it renders.
 */
export type DetailErrorKind =
  /** The query-string item id is missing or not a valid positive integer. */
  | 'invalid-identifier'
  /** The item does not exist, or was deleted. */
  | 'not-found'
  /** The current user cannot read the item. */
  | 'access-denied'
  /** A declared column is missing/unverified against the live list — a listSchema.ts problem. */
  | 'invalid-configuration'
  /** Network failure, throttling, or a server error. Retrying may succeed. */
  | 'transient'
  /** Unclassified failure. */
  | 'unknown';

export interface IErrorStateProps {
  readonly kind: DetailErrorKind;
  readonly onRetry?: () => void;
  readonly onReload?: () => void;
  /**
   * The query-string item id that failed to resolve, interpolated into the
   * `not-found` message ("Risk ID {itemId} could not be found…"). Ignored
   * for every other `kind`.
   */
  readonly itemId?: number;
  /**
   * Shows a `GoBackButton` above the message when `true` — opt-in because
   * the List web part (which also renders `ErrorState`) has no "back"
   * destination; only the Detail web part's per-record error states do.
   */
  readonly showGoBackLink?: boolean;
  /** Forwarded to `GoBackButton` — see its own doc comment for the fallback-to-history behavior. */
  readonly goBackUrl?: string;
}

const TITLES: Readonly<Partial<Record<DetailErrorKind, string>>> = {
  'not-found': 'Risk Record Not Found'
};

const MESSAGES: Readonly<Record<DetailErrorKind, string>> = {
  'invalid-identifier': 'This link does not point at a valid risk record.',
  'not-found': 'This risk record could not be found. It may have been deleted.',
  'access-denied': 'You do not have access to this risk record.',
  'invalid-configuration': 'This risk record could not be loaded because of a site configuration problem.',
  transient: 'This risk record could not be loaded. Please try again.',
  unknown: 'Something went wrong loading this risk record.'
};

function messageFor(kind: DetailErrorKind, itemId: number | undefined): string {
  if (kind === 'not-found' && itemId !== undefined) {
    return `Risk ID ${itemId} could not be found. If you believe this record exists, clear your browser cache and try again. If the issue persists, contact the Risk Registry management team.`;
  }
  return MESSAGES[kind];
}

/**
 * One of the handled failure states for the Detail web part.
 *
 * Never renders a raw SharePoint error body or stack trace — only the fixed,
 * generic copy in {@link MESSAGES}. `onRetry` is offered only for failures a
 * retry could plausibly fix (`transient`); the others gate on something that
 * won't change by trying again a moment later.
 */
export const ErrorState: React.FC<IErrorStateProps> = ({ kind, onRetry, onReload, itemId, showGoBackLink, goBackUrl }) => {
  const canRetry = kind === 'transient' && !!onRetry;
  const title = TITLES[kind];

  return (
    <>
      {showGoBackLink && <GoBackButton goBackUrl={goBackUrl} />}
      <MessageBar messageBarType={MessageBarType.error} role="alert">
        {title && <div className={styles.title}>{title}</div>}
        <div>{messageFor(kind, itemId)}</div>
        {(canRetry || onReload) && (
          <div className={styles.actions}>
            {canRetry && <PrimaryButton text="Try again" onClick={onRetry} styles={BUTTON_STYLES} />}
            {onReload && <DefaultButton text="Reload" onClick={onReload} styles={BUTTON_STYLES} />}
          </div>
        )}
      </MessageBar>
    </>
  );
};

export default ErrorState;
