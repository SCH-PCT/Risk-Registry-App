import * as React from 'react';

export interface IPermissionAwareActionProps {
  /** Effective permission check result. `undefined` while permissions are still loading. */
  readonly isPermitted: boolean | undefined;
  readonly children: React.ReactNode;
  /** Optional content shown while `isPermitted` is `undefined`. Defaults to rendering nothing. */
  readonly loadingFallback?: React.ReactNode;
}

/**
 * Renders `children` only once the effective-permissions check has resolved
 * `true`. This is a UI convenience, not the access-control boundary —
 * SharePoint enforces the underlying read/write permission on every request
 * regardless of what this component decides to render, per the solution-wide
 * rule that hiding a control is never the only control (see SECURITY.md).
 */
export const PermissionAwareAction: React.FC<IPermissionAwareActionProps> = ({
  isPermitted,
  children,
  loadingFallback = null
}) => {
  if (isPermitted === undefined) {
    return <>{loadingFallback}</>;
  }

  if (!isPermitted) {
    return null;
  }

  return <>{children}</>;
};

export default PermissionAwareAction;
