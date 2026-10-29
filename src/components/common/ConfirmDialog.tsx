import * as React from 'react';
import { Dialog, DialogType, DialogFooter, PrimaryButton, DefaultButton, IButtonStyles } from '@fluentui/react';

import { BUTTON_CORNER_RADIUS } from '../../styles/buttonCornerRadius';
import styles from './ConfirmDialog.module.scss';

export interface IConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmButtonText?: string;
  readonly cancelButtonText?: string;
  /** Styles the confirm button as destructive (e.g. discard unsaved changes). */
  readonly isDestructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /**
   * Renders an optional third button between Confirm and Cancel, for a
   * choice with three distinct outcomes rather than two — e.g. "Save" /
   * "Discard" / "Cancel" when navigating away from an unsaved edit. Omit
   * both this and `onSecondaryAction` for the normal two-button dialog.
   */
  readonly secondaryButtonText?: string;
  readonly onSecondaryAction?: () => void;
  /** Styles the secondary button as destructive (e.g. "Discard"), independent of `isDestructive` on the confirm button. */
  readonly isSecondaryDestructive?: boolean;
}

/*
 * Hex values below mirror `src/styles/_theme.scss`'s "Clinical Clarity"
 * palette, duplicated the same way `buttonStyles.ts` already does for its
 * own Fluent `PrimaryButton`/`DefaultButton` instances — Fluent's `styles`
 * prop takes real style objects, not SCSS class names, so a plain
 * `className` can't reach a button's internal root/hovered/pressed slots.
 * `TEAL_900`/`TEAL_700` read the host site's theme the same way `_theme.scss`
 * does, with the literal hex only as the no-theme fallback.
 */
const INK = '#171c21';
const INK_SECONDARY = '#40484c';
const TEAL_900 = 'var(--themePrimary, #00586f)';
const TEAL_700 = 'var(--themeDarkAlt, #004759)';
// The site's secondary color, per explicit design feedback — the destructive
// confirm button's fill, not an actual "danger" red.
const THEME_SECONDARY = 'var(--themeSecondary, #EC7625)';
const CRITICAL = '#be123c';
const CRITICAL_HOVER = '#9f1239';
const CRITICAL_BORDER = '#fda4af';
const CRITICAL_BG = '#fff1f2';
const BORDER = '#dee3ea';
const SURFACE_CONTAINER_LOW = '#f0f4fb';

function confirmButtonStyles(isDestructive: boolean | undefined): IButtonStyles {
  return isDestructive
    ? {
        root: {
          backgroundColor: THEME_SECONDARY,
          borderColor: THEME_SECONDARY,
          borderRadius: BUTTON_CORNER_RADIUS,
          height: '2.5rem',
          padding: '0 2rem'
        },
        rootHovered: { backgroundColor: THEME_SECONDARY, borderColor: THEME_SECONDARY },
        rootPressed: { backgroundColor: THEME_SECONDARY, borderColor: THEME_SECONDARY },
        label: { fontWeight: 600 }
      }
    : {
        root: {
          backgroundColor: TEAL_900,
          borderColor: TEAL_900,
          borderRadius: BUTTON_CORNER_RADIUS,
          height: '2.5rem',
          padding: '0 2rem'
        },
        rootHovered: { backgroundColor: TEAL_700, borderColor: TEAL_700 },
        rootPressed: { backgroundColor: TEAL_900, borderColor: TEAL_900 },
        label: { fontWeight: 600 }
      };
}

function secondaryButtonStyles(isDestructive: boolean | undefined): IButtonStyles {
  return isDestructive
    ? {
        root: {
          borderRadius: BUTTON_CORNER_RADIUS,
          height: '2.5rem',
          padding: '0 2rem',
          borderColor: CRITICAL_BORDER,
          color: CRITICAL
        },
        rootHovered: { backgroundColor: CRITICAL_BG, borderColor: CRITICAL, color: CRITICAL_HOVER },
        label: { fontWeight: 600 }
      }
    : {
        root: { borderRadius: BUTTON_CORNER_RADIUS, height: '2.5rem', padding: '0 2rem', borderColor: BORDER, color: INK },
        rootHovered: { borderColor: TEAL_900, color: TEAL_900, backgroundColor: SURFACE_CONTAINER_LOW },
        label: { fontWeight: 600 }
      };
}

// Bordered, per explicit request — distinct from a borderless "quiet" button
// so "Stay on This Step" reads as a real, equally-weighted third choice
// rather than a dismissal link.
const CANCEL_BUTTON_STYLES: IButtonStyles = {
  root: { borderRadius: BUTTON_CORNER_RADIUS, height: '2.5rem', padding: '0 2rem', borderColor: BORDER, color: INK_SECONDARY },
  rootHovered: { backgroundColor: SURFACE_CONTAINER_LOW, borderColor: BORDER, color: INK },
  label: { fontWeight: 600 }
};

/**
 * Shared confirmation dialog for destructive or status-changing actions —
 * Fluent's default `Dialog` chrome, with themed Confirm/Secondary/Cancel
 * buttons matching the rest of the Detail web part's "Clinical Clarity"
 * palette. Sized wide enough (`ConfirmDialog.module.scss`) for the
 * three-button case to stay on one row on desktop; below 480px the
 * buttons stack full-width, one per row, instead of shrinking to fit.
 */
export const ConfirmDialog: React.FC<IConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  isDestructive,
  onConfirm,
  onCancel,
  secondaryButtonText,
  onSecondaryAction,
  isSecondaryDestructive
}) => {
  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onCancel}
      dialogContentProps={{
        type: DialogType.normal,
        title,
        subText: message
      }}
      modalProps={{ isBlocking: true, containerClassName: styles.container }}
    >
      <DialogFooter className={styles.footer}>
        <PrimaryButton
          text={confirmButtonText}
          onClick={onConfirm}
          styles={confirmButtonStyles(isDestructive)}
          className={styles.footerButton}
        />
        {secondaryButtonText && onSecondaryAction && (
          <DefaultButton
            text={secondaryButtonText}
            onClick={onSecondaryAction}
            styles={secondaryButtonStyles(isSecondaryDestructive)}
            className={styles.footerButton}
          />
        )}
        <DefaultButton
          text={cancelButtonText}
          onClick={onCancel}
          styles={CANCEL_BUTTON_STYLES}
          className={styles.footerButton}
        />
      </DialogFooter>
    </Dialog>
  );
};

export default ConfirmDialog;
