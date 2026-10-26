/**
 * Decides how many navigation items fit before the rest move into an overflow menu.
 *
 * Kept as a pure function over measured widths, separate from the component, for one
 * reason: overflow is the part of responsive navigation most likely to be subtly wrong
 * — off by one item, or dropping the active item out of sight — and none of that is
 * testable if the arithmetic only exists inside a `useLayoutEffect` that needs a real
 * layout engine to run. Here it is ordinary input and output.
 *
 * Measurement itself stays in the component, where the DOM is.
 */

/** Widths in CSS pixels, as measured from the rendered items. */
export interface IOverflowInput {
  /** Rendered width of each top-level item, in display order. */
  readonly itemWidths: readonly number[];
  /** Space available to the items, after branding and padding are subtracted. */
  readonly availableWidth: number;
  /** Width of the overflow ("…") button, which only occupies space when shown. */
  readonly overflowButtonWidth: number;
  /**
   * Index of the active item, if any.
   *
   * The active item is pulled into the visible set even when its position would put it
   * in the overflow: a navigation bar that hides the page you are on gives the user no
   * indication of where they are, which is the one thing the highlight exists to do.
   */
  readonly activeIndex?: number;
}

export interface IOverflowResult {
  /** Indices rendered inline, in display order. */
  readonly visibleIndices: readonly number[];
  /** Indices moved into the overflow menu, in display order. */
  readonly overflowIndices: readonly number[];
}

/**
 * Partitions items into visible and overflowing sets.
 *
 * Before measurements arrive — first paint, or a hidden container reporting zero width
 * — `availableWidth` is 0 and everything would collapse into the overflow menu. That
 * flash is worse than a brief horizontal overrun, so a non-positive available width is
 * treated as "not measured yet" and everything renders inline.
 */
export function computeOverflow(input: IOverflowInput): IOverflowResult {
  const { itemWidths, availableWidth, overflowButtonWidth, activeIndex } = input;
  const allIndices = itemWidths.map((_, index) => index);

  if (itemWidths.length === 0) {
    return { visibleIndices: [], overflowIndices: [] };
  }

  if (!(availableWidth > 0)) {
    return { visibleIndices: allIndices, overflowIndices: [] };
  }

  const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0);

  // Everything fits, so no overflow button is needed and none of its width is reserved.
  if (totalWidth <= availableWidth) {
    return { visibleIndices: allIndices, overflowIndices: [] };
  }

  // From here the button will be shown, so its width comes out of the budget first.
  let budget = availableWidth - overflowButtonWidth;

  // The active item is reserved before the sequential fill, so it cannot be crowded out
  // by the items that precede it.
  const hasActive =
    activeIndex !== undefined && activeIndex >= 0 && activeIndex < itemWidths.length;

  if (hasActive) {
    budget -= itemWidths[activeIndex as number];
  }

  const visible = new Set<number>(hasActive ? [activeIndex as number] : []);

  for (let index = 0; index < itemWidths.length; index++) {
    if (visible.has(index)) {
      continue; // Already reserved.
    }

    const width = itemWidths[index];

    if (width > budget) {
      // Stop at the first item that does not fit rather than skipping it to squeeze in a
      // narrower later one — reordering the navigation to fill space would leave the
      // items in an order the site owner never authored.
      break;
    }

    budget -= width;
    visible.add(index);
  }

  const visibleIndices = allIndices.filter((index) => visible.has(index));
  const overflowIndices = allIndices.filter((index) => !visible.has(index));

  // Every item overflowed and there is nothing to attach the menu to visually. Showing
  // the first item slightly over budget is better than a bar containing only "…".
  if (visibleIndices.length === 0) {
    return { visibleIndices: [0], overflowIndices: allIndices.slice(1) };
  }

  return { visibleIndices, overflowIndices };
}
