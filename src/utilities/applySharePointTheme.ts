import { IReadonlyTheme } from '@microsoft/sp-component-base';

/**
 * Mirrors the resolved SharePoint theme onto `:root` as the CSS custom
 * properties this solution's stylesheets read (`--themePrimary` etc., see
 * `styles/_theme.scss`).
 *
 * SharePoint is documented as publishing these itself, but that publication
 * is not guaranteed on every page or site type — confirmed on a real site
 * where the page never set them, leaving every consuming style on its
 * hardcoded fallback color instead of the site's actual theme. Resolving the
 * theme explicitly via SPFx's own `ThemeProvider` service (see each web
 * part's `onInit`) and setting the properties here ourselves removes that
 * dependency on the host page.
 */
export function applySharePointTheme(theme: IReadonlyTheme | undefined): void {
  const palette = theme?.palette;
  if (!palette) {
    return;
  }

  const root = document.documentElement.style;
  const set = (name: string, value: string | undefined): void => {
    if (value) {
      root.setProperty(name, value);
    }
  };
  set('--themePrimary', palette.themePrimary);
  set('--themeDarkAlt', palette.themeDarkAlt);
  set('--themeSecondary', palette.themeSecondary);
  set('--themeLighter', palette.themeLighter);
  set('--neutralSecondary', palette.neutralSecondary);
}
