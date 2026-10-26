import * as React from 'react';
import { FocusZone, FocusZoneDirection, IContextualMenuItem, Icon, IconButton, ActionButton } from '@fluentui/react';

import * as strings from 'RiskRegistryTopNavigationApplicationCustomizerStrings';
import { INavigationItem } from '../../../models/domain/INavigationItem';
import { ITopNavigationProps } from './ITopNavigationProps';
import { resolveNavigationIcon } from './navigationIcons';
import { computeOverflow } from './navigationOverflow';
import styles from './TopNavigation.module.scss';

/**
 * The Risk Registry top navigation bar.
 *
 * Two decisions shape everything below.
 *
 * **Links are real anchors with real hrefs.** No `onClick` handler calls
 * `window.location`, and none calls a router. SharePoint's client-side navigation
 * already intercepts same-site anchor clicks and performs a soft navigation; hijacking
 * the click would replace that with a full page load while also breaking
 * middle-click, ctrl-click, "open in new tab" and "copy link address" — every
 * affordance a user expects from a link.
 *
 * **Nothing selects a SharePoint DOM element.** The component renders into the Top
 * placeholder handed to it by `PlaceholderProvider` and styles only its own markup.
 * SharePoint's internal class names are undocumented and change without notice, so a
 * selector reaching into them would fail silently on a future service update — across
 * every page in the site at once.
 */

/** Assumed width of the overflow button before it has been measured, in CSS pixels. */
const DEFAULT_OVERFLOW_BUTTON_WIDTH = 40;

interface IMeasurements {
  readonly itemWidths: readonly number[];
  readonly availableWidth: number;
  readonly overflowButtonWidth: number;
}

const EMPTY_MEASUREMENTS: IMeasurements = {
  itemWidths: [],
  availableWidth: 0,
  overflowButtonWidth: DEFAULT_OVERFLOW_BUTTON_WIDTH
};

function areMeasurementsEqual(a: IMeasurements, b: IMeasurements): boolean {
  return (
    a.availableWidth === b.availableWidth &&
    a.overflowButtonWidth === b.overflowButtonWidth &&
    a.itemWidths.length === b.itemWidths.length &&
    a.itemWidths.every((width, index) => width === b.itemWidths[index])
  );
}

/**
 * True when this item, or one of its children, is the page being viewed.
 *
 * A parent whose child is active is *related* to the current page but is not itself
 * the current page, so it gets the highlight without `aria-current`. Putting
 * `aria-current="page"` on both would tell a screen reader user there are two current
 * pages.
 */
function isAncestorOfActive(item: INavigationItem, activeItemId: number | undefined): boolean {
  return activeItemId !== undefined && item.children.some((child) => child.id === activeItemId);
}

/** Props for one rendered link. */
interface INavigationLinkProps {
  readonly item: INavigationItem;
  readonly isActive: boolean;
  readonly isAncestor: boolean;
}

const NavigationLink: React.FC<INavigationLinkProps> = ({ item, isActive, isAncestor }) => {
  const className = [styles.link, isActive || isAncestor ? styles.activeLink : '']
    .filter(Boolean)
    .join(' ');

  return (
    <a
      className={className}
      href={item.url}
      // Requirement: the active item is announced, not merely coloured. Colour alone
      // conveys nothing to a screen reader and disappears in forced-colors mode.
      aria-current={isActive ? 'page' : undefined}
      // Only set on genuinely external links. `noopener` prevents the opened page from
      // reaching back through `window.opener`.
      target={item.isExternal ? '_blank' : undefined}
      rel={item.isExternal ? 'noopener noreferrer' : undefined}
    >
      {/*
        Decorative. The title sits beside it and carries the meaning — the list has no icon
        column, so this glyph is inferred from the title and must never be load-bearing.
      */}
      <Icon iconName={resolveNavigationIcon(item.title, item.isExternal)} className={styles.linkIcon} aria-hidden="true" />
      <span className={styles.linkLabel}>{item.title}</span>
    </a>
  );
};

/**
 * Converts an item into a contextual-menu entry.
 *
 * `href` is set rather than an `onClick`, so menu entries navigate the same way inline
 * links do and keep the same browser affordances.
 */
function toMenuItem(item: INavigationItem, activeItemId: number | undefined): IContextualMenuItem {
  const isActive = item.id === activeItemId;

  return {
    key: String(item.id),
    text: item.title,
    href: item.url,
    target: item.isExternal ? '_blank' : undefined,
    iconProps: { iconName: resolveNavigationIcon(item.title, item.isExternal) },
    // Fluent's menu item has no aria-current slot, so the state is put where a screen
    // reader will still reach it. Active items are normally kept out of the overflow by
    // `computeOverflow`; this covers the case where one is not.
    ariaLabel: isActive ? `${item.title} (current page)` : undefined,
    subMenuProps:
      item.children.length > 0
        ? { items: item.children.map((child) => toMenuItem(child, activeItemId)) }
        : undefined
  };
}

export const TopNavigation: React.FC<ITopNavigationProps> = (props) => {
  const { branding, items, activeItemId, isLoading, errorMessage } = props;

  const itemsRegionRef = React.useRef<HTMLDivElement | null>(null);
  const measurementRef = React.useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = React.useRef<HTMLDivElement | null>(null);

  const [measurements, setMeasurements] = React.useState<IMeasurements>(EMPTY_MEASUREMENTS);

  /**
   * Reads widths from the hidden measurement layer.
   *
   * Items are measured from a duplicate copy rather than from the rendered ones,
   * because the rendered set changes as a result of this measurement — measuring it
   * would feed the result back into its own input and oscillate between two layouts.
   * The hidden copy always contains every item at full width, so it is a stable ruler.
   */
  const measure = React.useCallback((): void => {
    const region = itemsRegionRef.current;
    const layer = measurementRef.current;

    if (!region || !layer) {
      return;
    }

    const itemWidths: number[] = [];
    for (let i = 0; i < layer.children.length; i++) {
      itemWidths.push((layer.children[i] as HTMLElement).offsetWidth);
    }

    const next: IMeasurements = {
      itemWidths,
      availableWidth: region.clientWidth,
      overflowButtonWidth:
        overflowButtonRef.current?.offsetWidth || DEFAULT_OVERFLOW_BUTTON_WIDTH
    };

    // Only commit a genuine change. Writing identical state would re-run layout on
    // every resize frame for no reason.
    setMeasurements((previous) => (areMeasurementsEqual(previous, next) ? previous : next));
  }, []);

  // Measure after layout, before paint, so the first frame the user sees is correct
  // rather than showing every item and then visibly collapsing them into the menu.
  React.useLayoutEffect(() => {
    measure();
  }, [measure, items]);

  React.useEffect(() => {
    const region = itemsRegionRef.current;

    if (!region) {
      return undefined;
    }

    // ResizeObserver catches the cases a window resize listener misses: the SharePoint
    // canvas changing width when a panel opens, and text reflowing at a different zoom
    // level without the window changing size at all.
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(region);
      return () => observer.disconnect();
    }

    // Fallback for environments without ResizeObserver, including jsdom.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const activeIndex = React.useMemo(() => {
    if (activeItemId === undefined) {
      return undefined;
    }
    const index = items.findIndex(
      (item) => item.id === activeItemId || isAncestorOfActive(item, activeItemId)
    );
    return index >= 0 ? index : undefined;
  }, [items, activeItemId]);

  const { visibleIndices, overflowIndices } = React.useMemo(
    () =>
      computeOverflow({
        itemWidths: measurements.itemWidths,
        availableWidth: measurements.availableWidth,
        overflowButtonWidth: measurements.overflowButtonWidth,
        activeIndex
      }),
    [measurements, activeIndex]
  );

  const renderItem = (item: INavigationItem): JSX.Element => {
    const isActive = item.id === activeItemId;
    const isAncestor = isAncestorOfActive(item, activeItemId);

    if (item.children.length === 0) {
      return <NavigationLink item={item} isActive={isActive} isAncestor={isAncestor} />;
    }

    // A parent with children needs a disclosure control, and a control that both
    // navigates and opens a menu is ambiguous to operate by keyboard. The parent's own
    // page therefore appears as the first entry in its menu, so it stays reachable.
    return (
      <ActionButton
        className={[styles.link, isActive || isAncestor ? styles.activeLink : '']
          .filter(Boolean)
          .join(' ')}
        text={item.title}
        aria-current={isActive ? 'page' : undefined}
        menuProps={{
          items: [
            toMenuItem({ ...item, children: [] }, activeItemId),
            ...item.children.map((child) => toMenuItem(child, activeItemId))
          ]
        }}
      />
    );
  };

  const hasItems = items.length > 0;

  return (
    <div className={styles.topNavigation} data-automation-id="riskRegistryTopNavigation">
      {/*
        Branding links to the site home. `logoUrl` is undefined rather than empty when
        the site has no logo, so the img is not rendered at all — an empty src is what
        produces a broken-image icon, and the title alone is the correct fallback.
      */}
      <a className={styles.branding} href={branding.homeUrl}>
        {branding.logoUrl !== undefined && (
          <img
            className={styles.logo}
            src={branding.logoUrl}
            // The adjacent title already names the site, so repeating it here would
            // make a screen reader announce the name twice.
            alt=""
            aria-hidden="true"
          />
        )}
        <span className={styles.siteTitle}>{branding.title}</span>
      </a>

      {/*
        `nav` gives assistive technology a landmark to jump to. The label distinguishes
        it from SharePoint's own navigation landmarks, which remain on the page — this
        bar is added alongside the suite bar, never in place of it.
      */}
      <nav className={styles.itemsRegion} aria-label={strings.NavigationLandmarkLabel} ref={itemsRegionRef}>
        {isLoading && !hasItems && (
          <span className={styles.status} role="status">
            {strings.LoadingNavigation}
          </span>
        )}

        {!isLoading && !hasItems && errorMessage && (
          // Reported quietly and only when there is nothing to show. A failed refresh
          // must not put an error banner across the top of every page.
          <span className={styles.status} role="status">
            {errorMessage}
          </span>
        )}

        {hasItems && (
          <>
            {/*
              FocusZone turns the links into a single tab stop navigated with arrow
              keys, which is the expected keyboard model for a menu bar: Tab moves past
              the navigation, arrows move within it.
            */}
            <FocusZone direction={FocusZoneDirection.horizontal} as="ul" className={styles.itemList}>
              {visibleIndices.map((index) => (
                <li className={styles.item} key={items[index].id}>
                  {renderItem(items[index])}
                </li>
              ))}
            </FocusZone>

            {overflowIndices.length > 0 && (
              <div className={styles.overflowButton} ref={overflowButtonRef}>
                <IconButton
                  iconProps={{ iconName: 'More' }}
                  // An icon-only button carries no accessible name of its own.
                  ariaLabel={`${strings.MoreNavigationItemsLabel} (${overflowIndices.length})`}
                  title={strings.MoreNavigationItemsLabel}
                  menuProps={{
                    items: overflowIndices.map((index) => toMenuItem(items[index], activeItemId))
                  }}
                />
              </div>
            )}
          </>
        )}

        {/*
          The measurement layer: every item at full width, hidden from view, from the
          accessibility tree, and from the tab order. It exists only to be measured.
        */}
        <div className={styles.measurementLayer} aria-hidden="true" ref={measurementRef}>
          {items.map((item) => (
            <span className={styles.link} key={`measure-${item.id}`}>
              {/*
                The icon is measured too. Without it every item would measure narrower
                than it renders, and `computeOverflow` would keep more items inline than
                actually fit — the bar would then wrap or clip instead of overflowing.
              */}
              <Icon iconName={resolveNavigationIcon(item.title, item.isExternal)} className={styles.linkIcon} aria-hidden="true" />
              <span className={styles.linkLabel}>{item.title}</span>
            </span>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default TopNavigation;
