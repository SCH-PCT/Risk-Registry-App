import * as React from 'react';
import { MessageBar, MessageBarType, DefaultButton, PrimaryButton } from '@fluentui/react';

import styles from './ErrorState.module.scss';

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
}

const MESSAGES: Readonly<Record<DetailErrorKind, string>> = {
  'invalid-identifier': 'This link does not point at a valid risk record.',
  'not-found': 'This risk record could not be found. It may have been deleted.',
  'access-denied': 'You do not have access to this risk record.',
  'invalid-configuration': 'This risk record could not be loaded because of a site configuration problem.',
  transient: 'This risk record could not be loaded. Please try again.',
  unknown: 'Something went wrong loading this risk record.'
};

/**
 * One of the handled failure states for the Detail web part.
 *
 * Never renders a raw SharePoint error body or stack trace — only the fixed,
 * generic copy in {@link MESSAGES}. `onRetry` is offered only for failures a
 * retry could plausibly fix (`transient`); the others gate on something that
 * won't change by trying again a moment later.
 */
export const ErrorState: React.FC<IErrorStateProps> = ({ kind, onRetry, onReload }) => {
  const canRetry = kind === 'transient' && !!onRetry;

  return (
    <MessageBar messageBarType={MessageBarType.error} role="alert">
      <div>{MESSAGES[kind]}</div>
      {(canRetry || onReload) && (
        <div className={styles.actions}>
          {canRetry && <PrimaryButton text="Try again" onClick={onRetry} />}
          {onReload && <DefaultButton text="Reload" onClick={onReload} />}
        </div>
      )}
    </MessageBar>
  );
};

export default ErrorState;
