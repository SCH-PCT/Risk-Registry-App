import * as React from 'react';
import { MessageBar, MessageBarType, PrimaryButton, DefaultButton } from '@fluentui/react';

import { PRIMARY_BUTTON_STYLES, SECONDARY_BUTTON_STYLES } from './buttonStyles';
import styles from './ConflictBanner.module.scss';

export interface IConflictBannerProps {
  readonly onReload: () => void;
  readonly onKeepEditing: () => void;
}

/**
 * Shown when the server copy of the record changed while the user had
 * unsaved edits open. Never overwrites the form automatically — the two
 * explicit choices are "Reload" (discards local edits, loads the current
 * server copy) and "Keep editing" (dismisses this banner; the user's draft
 * is untouched, though a subsequent Save may conflict again until reloaded).
 */
export const ConflictBanner: React.FC<IConflictBannerProps> = ({ onReload, onKeepEditing }) => (
  <MessageBar messageBarType={MessageBarType.warning} role="alert" className={styles.banner}>
    <div>
      This risk record was changed by someone else while you were editing. Your unsaved changes have not been lost,
      but saving now could overwrite their update.
    </div>
    <div className={styles.actions}>
      <PrimaryButton text="Reload" onClick={onReload} styles={PRIMARY_BUTTON_STYLES} />
      <DefaultButton text="Keep editing" onClick={onKeepEditing} styles={SECONDARY_BUTTON_STYLES} />
    </div>
  </MessageBar>
);

export default ConflictBanner;
