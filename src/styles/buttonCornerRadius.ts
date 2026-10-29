/**
 * Fluent `IButtonStyles` `root.borderRadius`, in pixels — matches
 * `_theme.scss`'s `$rr-radius` (0.5rem at the default 16px root font size),
 * the Step card's own corner radius. Every Fluent `PrimaryButton`/
 * `DefaultButton` in the solution is styled via this one constant so their
 * corners stay consistent with each other and with every plain HTML
 * `<button>` (styled directly with `$rr-radius` in each component's own
 * `.module.scss`).
 */
export const BUTTON_CORNER_RADIUS = 8;
