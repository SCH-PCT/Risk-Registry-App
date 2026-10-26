import { IButtonStyles } from '@fluentui/react';

/**
 * Teal pill-button styling matching the design, for this web part's
 * `PrimaryButton`/`DefaultButton` instances.
 *
 * Passed via Fluent's `styles` prop rather than a CSS module `className`:
 * Fluent computes its own hover/pressed/disabled styles at a specificity
 * page CSS cannot reliably beat, so `styles` is the supported override point
 * rather than fighting the cascade.
 */
export const PRIMARY_BUTTON_STYLES: IButtonStyles = {
  root: {
    backgroundColor: '#00586f',
    borderColor: '#00586f',
    borderRadius: 4,
    padding: '0 1.25rem',
    height: '2.25rem'
  },
  rootHovered: { backgroundColor: '#004759', borderColor: '#004759' },
  rootPressed: { backgroundColor: '#00586f', borderColor: '#00586f' },
  rootDisabled: { backgroundColor: '#dee3ea', borderColor: '#dee3ea', color: '#8a9794' },
  label: { fontWeight: 600 }
};

export const SECONDARY_BUTTON_STYLES: IButtonStyles = {
  root: {
    borderRadius: 4,
    borderColor: '#dee3ea',
    color: '#171c21',
    padding: '0 1.25rem',
    height: '2.25rem'
  },
  rootHovered: { borderColor: '#007897', color: '#00586f', backgroundColor: '#f0f4fb' },
  label: { fontWeight: 600 }
};
