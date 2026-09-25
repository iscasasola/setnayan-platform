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
 * (film, names, the story after the day, a Post Event scene) under Home; the
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

export type NavigatorBarItem = { key: string; label: string; href: string; state: 'live' | 'locked' };

export type NavigatorTab = NavigatorBarItem & {
  /** The tab opens a page of its own (Camera, Join, Watch) — no scenes here. */
  leaves: boolean;
  /** Navigator tile keys this tab lands on, in page order. */
  tiles: string[];
};

/** The page's in-page anchors, top of the page first. */
export const PAGE_ANCHOR_ORDER = ['home', 'details', 'story', 'gallery', 'me'] as const;

/** Which anchor a navigator tile sits under on the page. */
export function anchorOfTile(tileKey: string): (typeof PAGE_ANCHOR_ORDER)[number] {
  if (tileKey === 'f:story' || tileKey === 'w:our_love_story') return 'story';
  if (tileKey === 'f:entourage' || tileKey.startsWith('w:')) return 'details';
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

export function navigatorTabs(bar: readonly NavigatorBarItem[], tileKeysInPageOrder: readonly string[]): NavigatorTab[] {
  const tabs: NavigatorTab[] = bar.map((b) => ({ ...b, leaves: !b.href.startsWith('#'), tiles: [] }));
  const inPage = tabs.filter((t) => !t.leaves && (PAGE_ANCHOR_ORDER as readonly string[]).includes(t.key));
  if (inPage.length === 0) return tabs;
  const rank = (k: string) => (PAGE_ANCHOR_ORDER as readonly string[]).indexOf(k);
  for (const key of tileKeysInPageOrder) {
    const want = rank(anchorOfTile(key));
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
