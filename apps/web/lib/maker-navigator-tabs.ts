/**
 * THE NAVIGATOR'S TABS ARE THE STAGE'S EVENT BAR (owner 2026-09-26, on the
 * navigator's "Main" button, verbatim: *"this depends on what menu they are
 * looking at."*).
 *
 * The navigator opened with one generic "Main" tile. A guest on the day meets
 * **Now · Camera · Join**; on the Invitation **Home · Details · Story · Camera ·
 * Join** — each stage has its own menu. The navigator's tabs are now that menu:
 * the SAME bar the canvas drew for this stage (handed over by the canvas as
 * `data-maker-bar`, from the one value the guest tab bar is drawn from — see
 * `app/[slug]/_lib/stage-bar.ts`), so the two cannot disagree.
 *
 * Choosing a tab lists the scenes that tab lands on, in the order the page
 * renders them. The page is one scroll with in-page anchors, top first:
 *
 *     home → details → story → gallery → me
 *
 * and each scene belongs to the anchor it sits under: the opening sections
 * (film, names, the story after the day, a Post Event scene) and the
 * Invitation's Welcome page (the guest's look, Reminders, E-Gifts) under Home
 * — the tab guests read as "Welcome" on the Invitation; the
 * page's sections and the entourage under Details; the love story under Story.
 * When a stage's bar has no tab for that anchor (On the Day has no Details),
 * the scene belongs to the nearest tab ABOVE it on the page — which is exactly
 * where a guest who tapped that tab would be scrolling past it.
 *
 * A tab that LEAVES the page (Camera, Join, Watch) lists no scenes: it opens a
 * page of its own, and the navigator says so instead of pretending.
 *
 * Pure: no DOM, no React.
 */

import { HUB_TAB_ORDER, isHubTabHref } from '../app/[slug]/_lib/hub-tabs';

export type NavigatorBarItem = { key: string; label: string; href: string; state: 'live' | 'locked' };

export type NavigatorTab = NavigatorBarItem & {
  /** The tab opens a page of its own (Camera, Join, Watch) — no scenes here. */
  leaves: boolean;
  /** Navigator tile keys this tab lands on, in page order. */
  tiles: string[];
};

/**
 * The page's tabs, top of the page first — the SAME order the guest page files
 * its content by (`app/[slug]/_lib/hub-tabs.ts` `HUB_TAB_ORDER`, 📱 each tab its
 * own page), so a scene sits under the same tab here as on a guest's phone.
 * `live` is The Day's first tab; the Invitation has none and starts at `home`.
 */
export const PAGE_ANCHOR_ORDER = HUB_TAB_ORDER;

/**
 * 📱 ON THE DAY (owner 2026-09-30, "THE DAY'S MENU HAS FIVE: LIVE · WELCOME ·
 * CAMERA · GALLERY · ME"): the page opens on Live — the masthead, the day's
 * sections (the programme first), the entourage, the stream and the wall — and
 * the guest's own Welcome holds their table; their photos are the Gallery's.
 * The same filing `site-body.tsx` gives each part (`hubTabFor`), so the Maker's
 * Page ▾ and the guest's bar agree about where every scene is.
 */
function dayAnchorOfTile(tileKey: string): (typeof PAGE_ANCHOR_ORDER)[number] {
  if (tileKey === 'f:story' || tileKey === 'w:our_love_story') return 'story';
  if (tileKey === 'f:find_your_seat' || tileKey === 'f:look' || tileKey === 'f:gifts' || tileKey === 'w:what_to_bring') return 'home';
  if (tileKey === 'f:photos_of_you') return 'gallery';
  return 'live';
}

/** Which anchor a navigator tile sits under on the page. `day` → The Day's tabs. */
export function anchorOfTile(tileKey: string, day = false): (typeof PAGE_ANCHOR_ORDER)[number] {
  if (day) return dayAnchorOfTile(tileKey);
  if (tileKey === 'f:story' || tileKey === 'w:our_love_story') return 'story';
  // 🏠 The Invitation's Welcome page (owner 2026-09-30, `lib/invitation-welcome.ts`):
  // the guest's look and E-Gifts sit under Welcome — the page's first tab, anchor
  // `home`. 🎒 What to bring is Details' since 2026-10-06 (after the Entourage since
  // 2026-10-07, `splitAroundEntourage`) — the `w:` rule below files it there.
  if (tileKey === 'f:look' || tileKey === 'f:gifts') return 'home';
  if (tileKey === 'f:entourage' || tileKey.startsWith('w:')) return 'details';
  // 🎨 The Invitation's announcement stands after the entourage (`MAKER_DAY_PARTS`).
  if (['f:announcements', 'f:find_your_seat', 'f:live_hub', 'f:photos_of_you'].includes(tileKey)) return 'details';
  // f:film · f:hero · f:editorial · p:<post event scene>
  return 'home';
}

/** Validates what the canvas posted; anything malformed is dropped, never guessed. */
export function parseNavigatorBar(raw: unknown): NavigatorBarItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: NavigatorBarItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const { key, label, href, state } = it as Record<string, unknown>;
    if (typeof key !== 'string' || typeof label !== 'string' || typeof href !== 'string') continue;
    out.push({ key, label, href, state: state === 'locked' ? 'locked' : 'live' });
  }
  return out.length > 0 ? out : null;
}

/**
 * The page anchor a tab lands on. On the day the "Schedule" tab lands on the
 * day's details, whose first scene is the schedule (`STAGE_SCENES.event`), so
 * it owns the details group.
 */
export function tabAnchor(key: string): string {
  return key === 'schedule' ? 'details' : key;
}

export function navigatorTabs(bar: readonly NavigatorBarItem[], tileKeysInPageOrder: readonly string[]): NavigatorTab[] {
  // In-page: a `#mark` on a page that is one scroll, or a tab's own address
  // (`?tab=`) on a page whose tabs are pages. Anything else leaves.
  const tabs: NavigatorTab[] = bar.map((b) => ({ ...b, leaves: !b.href.startsWith('#') && !isHubTabHref(b.href), tiles: [] }));
  const day = bar.some((b) => b.key === 'live');
  const inPage = tabs.filter((t) => !t.leaves && (PAGE_ANCHOR_ORDER as readonly string[]).includes(tabAnchor(t.key)));
  if (inPage.length === 0) return tabs;
  const rank = (k: string) => (PAGE_ANCHOR_ORDER as readonly string[]).indexOf(tabAnchor(k));
  for (const key of tileKeysInPageOrder) {
    const want = rank(anchorOfTile(key, day));
    // the nearest in-page tab at or above the scene's own anchor; else the first one
    let home: NavigatorTab | undefined;
    for (const t of inPage) if (rank(t.key) <= want && (!home || rank(t.key) > rank(home.key))) home = t;
    (home ?? inPage[0]!).tiles.push(key);
  }
  return tabs;
}

/** The tab a tile lives under, or null. */
export function tabOfTile(tabs: readonly NavigatorTab[], tileKey: string): NavigatorTab | null {
  return tabs.find((t) => t.tiles.includes(tileKey)) ?? null;
}

/**
 * ONE SCROLLING LIST, THE TABS AS HEADERS (owner 2026-09-27, measured on his
 * own page: *"navigation still does not show the scenes and allow the scenes
 * to be edited"* — the Invitation's Home tab listed ONE scene and hid the
 * others behind Details · Story).
 *
 * 🔴 A TAB USED TO BE A FILTER. Choosing "Home" drew only Home's tiles, so the
 * navigator showed "Names & date" and nothing else while the canvas beside it
 * drew ten sections. The tabs are now small HEADERS between the groups of one
 * list: every scene of the stage is always listed, in canvas order, and a tab
 * only jumps to its group.
 *
 * Returns EVERY tile key, in order, each with the header to draw before it
 * (the first tile of each run of one tab) — the caller maps over this, so it
 * cannot drop a tile.
 */
export type NavigatorRow = { key: string; header: { key: string; label: string } | null };

export function navigatorRows(
  tabs: readonly NavigatorTab[] | null,
  tileKeysInPageOrder: readonly string[],
): NavigatorRow[] {
  /* 📑 A header wherever the tab CHANGES, not only the first time a tab
     appears. The Day's approved order (owner 2026-10-05) runs Live → Welcome
     (find your seat) → Live (schedule · venue · camera) → Gallery (photos of
     you) → Live (entourage): headed once, the schedule was listed under
     "Welcome" and the entourage under "Gallery". A returning tab is headed
     again, so every scene sits under the tab a guest meets it on. */
  let previous: string | null = null;
  return tileKeysInPageOrder.map((key) => {
    const tab = tabs ? tabOfTile(tabs, key) : null;
    if (!tab || tab.key === previous) return { key, header: null };
    previous = tab.key;
    return { key, header: { key: tab.key, label: tab.label } };
  });
}
