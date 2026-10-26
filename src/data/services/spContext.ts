/**
 * Single point of PnPjs construction for the whole solution.
 *
 * RULE: nothing outside this file may call `spfi()`. Components, hooks and
 * repositories receive an `SPFI` rather than building one, so a page hosting several
 * Risk Registry components creates one instance rather than one per component.
 *
 * The site is always taken from the SPFx context's `pageContext.web.absoluteUrl`.
 * No tenant URL, site URL or list GUID is ever written down here.
 */

import { SPFI, spfi, SPFx, ISPFXContext } from '@pnp/sp';

// Selective imports. PnPjs v4 attaches functionality by import side effect, so the
// bundle only carries the pieces the solution actually uses. Add narrowly here —
// importing '@pnp/sp/presets/all' would pull in the entire library.
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';

/**
 * Cache keyed by web absolute URL rather than by context object.
 *
 * Each web part/extension gets its own context instance, so keying by context would
 * still produce one SPFI per component. Every Risk Registry component on a page
 * targets the same web, so the URL is the correct key for sharing.
 */
const instances = new Map<string, SPFI>();

/**
 * Returns the shared `SPFI` for the site in the supplied SPFx context, creating it
 * on first use.
 *
 * Accepts `ISPFXContext` rather than `WebPartContext` so extensions and web parts
 * share one factory, and so tests can supply a minimal stub without constructing an
 * SPFx context.
 */
export function getSp(context: ISPFXContext): SPFI {
  const webUrl = context?.pageContext?.web?.absoluteUrl;

  if (!webUrl) {
    // A configuration failure, not a data failure: surface it as such rather than
    // letting a later request fail with an opaque network error.
    throw new Error(
      'SPFx context is missing pageContext.web.absoluteUrl; cannot initialise SharePoint access.'
    );
  }

  let instance = instances.get(webUrl);

  if (!instance) {
    instance = spfi().using(SPFx(context));
    instances.set(webUrl, instance);
  }

  return instance;
}

/**
 * Clears the cache. For tests only — production code has no reason to discard a
 * live instance, and doing so mid-page would silently double request volume.
 */
export function resetSpContextCache(): void {
  instances.clear();
}
