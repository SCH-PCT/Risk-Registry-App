import { IButtonStyles } from '@fluentui/react';

import { BUTTON_CORNER_RADIUS } from '../../../styles/buttonCornerRadius';

/**
 * Teal pill-button styling matching the design, for this web part's
 * `PrimaryButton`/`DefaultButton` instances.
 *
 * Passed via Fluent's `styles` prop rather than a CSS module `className`:
 * Fluent computes its own hover/pressed/disabled styles at a specificity
 * page CSS cannot reliably beat, so `styles` is the supported override point
 * rather than fighting the cascade.
 */
// `var(--themePrimary, ...)` etc. mirror `src/styles/_theme.scss`'s
// `$rr-teal-*` tokens — Fluent's `styles` prop takes real style objects, not
// SCSS class names, so these can't just `@import` the shared palette file;
// the CSS custom property still resolves to the host site's actual theme
// color at runtime, with the literal hex only as the no-theme fallback.
const THEME_PRIMARY = 'var(--themePrimary, #00586f)';
const THEME_PRIMARY_HOVER = 'var(--themeDarkAlt, #004759)';
const THEME_ACCENT = 'var(--themeSecondary, #007897)';

export const PRIMARY_BUTTON_STYLES: IButtonStyles = {
  root: {
    backgroundColor: THEME_PRIMARY,
    borderColor: THEME_PRIMARY,
    borderRadius: BUTTON_CORNER_RADIUS,
    padding: '0 1.25rem',
    height: '2.25rem'
  },
  rootHovered: { backgroundColor: THEME_PRIMARY_HOVER, borderColor: THEME_PRIMARY_HOVER },
  rootPressed: { backgroundColor: THEME_PRIMARY, borderColor: THEME_PRIMARY },
  rootDisabled: { backgroundColor: '#dee3ea', borderColor: '#dee3ea', color: '#8a9794' },
  label: { fontWeight: 600 }
};

export const SECONDARY_BUTTON_STYLES: IButtonStyles = {
  root: {
    borderRadius: BUTTON_CORNER_RADIUS,
    borderColor: '#dee3ea',
    color: '#171c21',
    padding: '0 1.25rem',
    height: '2.25rem'
  },
  rootHovered: { borderColor: THEME_ACCENT, color: THEME_PRIMARY, backgroundColor: '#f0f4fb' },
  label: { fontWeight: 600 }
};
