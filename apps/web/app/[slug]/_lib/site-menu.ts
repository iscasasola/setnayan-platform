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

/**
 * Does the browsable body actually render in this phase?
 *
 * WHY THIS EXISTS. The Details and Story anchors live inside `normalBody()` in
 * site-body.tsx, and `phasedBody` does not call it in every phase. Under open
 * browse the caller was forcing both tabs on regardless:
 *
 *     details: plan.openBrowse || plan.publicSafeWidgets.length > 0
 *     story:   plan.openBrowse || Boolean(event.love_story)
 *
 * In the `save_the_date` phase that renders two tabs whose anchors were never
 * emitted, so tapping them does nothing — breaking the rule the file states in
 * its own comment ("never anchors to a section that did not render"). It bites
 * whenever the event is more than STD_THRESHOLD_DAYS out, which is nearly every
 * newly-created wedding, and it is invisible to inspection because the only
 * open-browse event in prod sits in exactly that phase behind the full-screen
 * film.
 *
 * The phases that reach `normalBody()`, read off `phasedBody`:
 *   · 'normal'        — the else branch, always
 *   · 'editorial'     — only under open browse (the archive keeps the site
 *                       below the cover essay)
 *   · 'save_the_date' — only under open browse, SINCE THE FILM HANDOFF
 *
 * ⚠ THAT LAST LINE CHANGED UNDER THIS FUNCTION'S FEET, and it is worth the
 * paragraph. When this guard was written (#4068) the save-the-date phase
 * rendered the film INSTEAD of the body, so it correctly returned `false`
 * unconditionally. Hours later the film handoff (#4069) made the body render
 * BENEATH the film under open browse — and this guard, still saying `false`,
 * started hiding tabs whose anchors now existed. The owner caught it by opening
 * the sample wedding on his phone: a rich page with only "Home" and "Me" in the
 * bar.
 *
 * 🔑 The lesson, for whoever touches this next: a guard that is exactly right
 * can be made wrong by a change somewhere else, and nothing fails when it
 * happens — the tests kept passing because they asserted the OLD truth. This
 * predicate must mirror `phasedBody`; if you change one, change both.
 *
 * Pure so the golden suites can pin it without a render.
 */
export function browsableBodyRenders(plan: {
  body: 'normal' | 'save_the_date' | 'editorial';
  openBrowse: boolean;
}): boolean {
  // Both takeover phases follow the SAME rule, because `phasedBody` now treats
  // them the same: the cover/film keeps its takeover, and under open browse the
  // browsable site persists BELOW it.
  if (plan.body === 'save_the_date' || plan.body === 'editorial') return plan.openBrowse;
  return true;
}
