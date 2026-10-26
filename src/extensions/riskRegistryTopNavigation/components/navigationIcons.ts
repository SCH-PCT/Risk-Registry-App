/**
 * Picks a Fluent UI icon name for a navigation item.
 *
 * ## Why this is a guess, and why that is acceptable here
 *
 * `appTopNavigation` is assumed to have **no icon column** (unverified — see
 * `config/listSchema.ts`). So the icon cannot be read; it can only be inferred from
 * the title a site owner typed.
 *
 * That is fine *because the glyph is decorative*. The icon renders with
 * `aria-hidden="true"` and every navigation item renders its title beside it, so a
 * wrong or missing glyph costs a little recognisability and nothing else. Nothing
 * here is ever the only thing carrying a meaning.
 *
 * Fluent UI's built-in icon font is used rather than a third-party webfont, so the
 * navigation bar has no external network dependency — unlike the reference
 * implementation this was ported from, which loaded Material Symbols from Google
 * Fonts. Adding a real `Icon` column to the list later is a change to this file's
 * front door — pass the stored value through and fall back to
 * `resolveNavigationIcon` when it is blank.
 *
 * ## Matching is on whole words
 *
 * The title is split on non-letters and compared word by word, so "Risks" matches
 * `risk` while "Briskly" does not match `risk`. A substring match would classify
 * confidently and wrongly, which is the one failure mode worth avoiding.
 */

/** The icon used when nothing matches: a generic page, which is what these items point at. */
export const DEFAULT_NAVIGATION_ICON = 'Page';

/** The icon for an item that leaves the site. */
export const EXTERNAL_NAVIGATION_ICON = 'NavigateExternalInline';

/**
 * Keyword → Fluent UI icon name, in priority order.
 *
 * Order matters: the first entry with a matching word wins, so more specific terms are
 * listed before more general ones.
 */
const ICON_KEYWORDS: ReadonlyArray<{
  readonly icon: string;
  readonly words: readonly string[];
}> = [
  { icon: 'Settings', words: ['admin', 'administration', 'settings', 'setup', 'config', 'category', 'categories'] },
  { icon: 'Warning', words: ['risk', 'risks', 'register', 'registry'] },
  { icon: 'TaskManager', words: ['action', 'actions', 'task', 'tasks'] },
  { icon: 'Timeline', words: ['activity', 'activities', 'log', 'history'] },
  { icon: 'Comment', words: ['update', 'updates', 'comment', 'comments', 'note', 'notes'] },
  { icon: 'People', words: ['assignment', 'assignments', 'assignee', 'owner', 'owners', 'team'] },
  { icon: 'OpenFile', words: ['document', 'documents', 'file', 'files', 'attachment', 'attachments'] },
  { icon: 'ReportDocument', words: ['report', 'reports', 'analytics', 'metrics', 'stats', 'dashboard', 'overview', 'home'] },
  { icon: 'Help', words: ['help', 'support', 'training', 'guide', 'faq'] }
];

/**
 * Resolves the icon for a navigation title.
 *
 * External links keep their own icon regardless of wording: that the link leaves the
 * site is more useful to signal than what it is about, and it is the one fact about
 * the item that is actually known rather than inferred.
 */
export function resolveNavigationIcon(title: string, isExternal: boolean = false): string {
  if (isExternal) {
    return EXTERNAL_NAVIGATION_ICON;
  }

  if (typeof title !== 'string') {
    return DEFAULT_NAVIGATION_ICON;
  }

  // Padded and split on non-letters so a keyword matches only as a whole word.
  const words = ` ${title.toLowerCase().replace(/[^a-z]+/g, ' ').trim()} `;

  if (words.trim().length === 0) {
    return DEFAULT_NAVIGATION_ICON;
  }

  for (const entry of ICON_KEYWORDS) {
    for (const word of entry.words) {
      if (words.indexOf(` ${word} `) !== -1) {
        return entry.icon;
      }
    }
  }

  return DEFAULT_NAVIGATION_ICON;
}
