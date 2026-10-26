import * as React from 'react';

/**
 * Warns before the browser navigates away or closes the tab while there are
 * unsaved edits. No business-data payload is ever involved — this only
 * attaches/detaches a `beforeunload` listener based on `isActive`.
 */
export function useUnsavedChangesWarning(isActive: boolean): void {
  React.useEffect(() => {
    if (!isActive || typeof window === 'undefined') {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      // Required by spec for the browser to show its own confirmation
      // prompt; the message text itself is ignored by every modern browser.
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isActive]);
}
