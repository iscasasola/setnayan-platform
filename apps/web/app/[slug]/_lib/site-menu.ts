// Open-browse guest-site MENU SHELL — the tab model (council build plan §3
// row 6, "menu shell"). Pure config + a tab-builder so the SiteMenuBar client
// component and its unit test stay presentational and identity-agnostic.
//
// Five tabs, identical structure for every identity tier (§1.1): Home · Details
// · Story · Gallery · Me. "Gallery" is the owner rename (NOT "Photos", 2026-07).
//
// The middle three tabs appear ONLY when their section actually rendered on the
// page — a menu item must never anchor to nothing. This is the fix for the
// council's rejected "Program Board" dead-anchor bug (a menu with entries that
// scroll to sections not in the DOM). Home (top of page) and Me (the QR /
// account affordance) are always present.

export const SITE_MENU_ANCHORS = {
  home: 'site-home',
  details: 'site-details',
  story: 'site-story',
  gallery: 'site-gallery',
  me: 'site-me',
} as const;

export type SiteMenuTabKey = keyof typeof SITE_MENU_ANCHORS;

export type SiteMenuTab = {
  key: SiteMenuTabKey;
  /** Human label — Home · Details · Story · Gallery · Me. */
  label: string;
  /** In-page anchor href, e.g. `#site-story`. */
  anchor: string;
};

const TAB_LABELS: Record<SiteMenuTabKey, string> = {
  home: 'Home',
  details: 'Details',
  story: 'Story',
  gallery: 'Gallery', // owner-renamed — never "Photos"
  me: 'Me',
};

/** Which middle sections rendered on the page (Home + Me are always present). */
export type SiteMenuSectionsPresent = {
  details: boolean;
  story: boolean;
  gallery: boolean;
};

/**
 * Build the visible tab list. Home first, then each present middle section in
 * fixed order, then Me. A middle tab is emitted only when its section is
 * present, so the menu never advertises a dead anchor.
 */
export function siteMenuTabs(present: SiteMenuSectionsPresent): SiteMenuTab[] {
  const keys: SiteMenuTabKey[] = ['home'];
  if (present.details) keys.push('details');
  if (present.story) keys.push('story');
  if (present.gallery) keys.push('gallery');
  keys.push('me');
  return keys.map((key) => ({
    key,
    label: TAB_LABELS[key],
    anchor: `#${SITE_MENU_ANCHORS[key]}`,
  }));
}

/**
 * Is the open-browse site menu enabled? Flag-dark by default
 * (`NEXT_PUBLIC_WEBSITE_MENU_ENABLED`), but always ON for the demo/sample event
 * so the owner can walk it before any real-event flip (council PR6 + PR11).
 * Pure — takes the resolved env value + is_sample so it stays unit-testable.
 */
export function siteMenuEnabled(opts: {
  flag: string | undefined;
  isSample: boolean;
}): boolean {
  return opts.isSample || opts.flag === 'true';
}
