/**
 * 📱 EACH MENU TAB IS ITS OWN FULL PAGE (owner 2026-09-30, verbatim: *"so this is
 * not a 1 page scroll jumping to different marks. this is each menu gets their
 * own full page scroll"*). DECISION_LOG "EACH MENU TAB IS ITS OWN FULL PAGE —
 * NOT ONE LONG SCROLL WITH JUMP MARKS", "THE GUEST MENUS, NAMED", "THE DAY'S
 * MENU HAS FIVE: LIVE · WELCOME · CAMERA · GALLERY · ME".
 *
 *   The Invitation · Welcome · Details · Our Love Story · Me
 *   The Day        · Live · Welcome · Camera · Gallery · Me
 *
 * Tapping a tab shows THAT tab's page, from its top; the other tabs are not on
 * it. Each tab has its own address — `?tab=<key>` — so a shared or bookmarked
 * link lands on the right page, and Back walks the tabs a guest opened.
 *
 * 🔑 THE KEYS DO NOT CHANGE, ONLY THE WORDS DID ("labels only: the page keys
 * stay home/details/story/me so links keep working"). `home` is the guest's own
 * page — "Welcome" — on both stages; the day's first tab is the new `live`.
 *
 * ♻ ONE SHELL. The mechanism is the day-of hub's (`_components/hub/hub-shell.tsx`
 * — one route, a bottom menu that toggles full-screen panels, the server renders
 * every panel): the page renders every tab's content once, each group marked
 * `data-hub-tab`, and the shell shows one. This module is its rules, pure, so
 * each is executed by `each-tab-is-its-own-page.test.ts` rather than trusted.
 *
 * Pure: no React, no DOM, no database.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';

/** The query parameter that names the tab — the tab's own address. */
export const HUB_TAB_PARAM = 'tab';

/** The attribute every tab's content carries. The shell shows the one that matches. */
export const HUB_TAB_ATTR = 'data-hub-tab';

/**
 * The tabs' order on the page, top first — the order a tab's content falls back
 * through when the bar does not carry the tab it asked for (see `hubTabFor`).
 * The Maker's navigator groups its scenes by the SAME order
 * (`lib/maker-navigator-tabs.ts` `PAGE_ANCHOR_ORDER`), so a scene sits under the
 * same tab in the Maker as on the guest's phone.
 */
export const HUB_TAB_ORDER = ['live', 'home', 'details', 'story', 'gallery', 'me'] as const;
export type HubTabKey = (typeof HUB_TAB_ORDER)[number];

/** The stages whose menu is tabs, each its own page: the Invitation and The Day. */
export const TABBED_STAGES: readonly LifecyclePhase[] = ['rsvp', 'event'];

/** A tab's address: `?tab=<key>`. Relative on purpose — it stays on this page. */
export function hubTabHref(key: string): string {
  return `?${HUB_TAB_PARAM}=${encodeURIComponent(key)}`;
}

/** Is this href a tab of this page (rather than a page of its own, like the Camera)? */
export function isHubTabHref(href: string | null | undefined): boolean {
  return typeof href === 'string' && href.startsWith(`?${HUB_TAB_PARAM}=`);
}

/** The tab an href names, or null. */
export function hubTabOfHref(href: string | null | undefined): string | null {
  if (!isHubTabHref(href)) return null;
  const v = decodeURIComponent(String(href).slice(HUB_TAB_PARAM.length + 2)).trim();
  return v === '' ? null : v;
}

/**
 * Is this page shown as tabs, each its own page?
 *
 *   · only the Invitation and The Day (the Save the Date film and the story
 *     after the day are one page each, and are not part of this ruling);
 *   · only the page's ordinary body (`plan.body === 'normal'`);
 *   · only where the guest's bar is drawn — a bar is how a tab is reached, so a
 *     page without one (the menu switched off, the Maker's canvas with its
 *     "Guest bars" off) must keep every section on it;
 *   · never in the Maker's editing canvas. The canvas is "the scenes, one after
 *     another, to edit" (owner 2026-09-26): its navigator lists every scene it
 *     DREW (`drawnMakerOrder` measures each one's height) and pictures each tile
 *     from the drawn scene, so a scene on a hidden tab would drop out of the
 *     navigator — the one thing `every-scene-is-in-the-navigator.test.ts`
 *     forbids. The Maker's "Preview the whole stage" IS tabbed: it is the
 *     guest's experience.
 */
export function hubTabsOn(input: {
  stage: LifecyclePhase;
  bodyNormal: boolean;
  barDrawn: boolean;
  makerCanvas: boolean;
  /** 🧭 The ONE canvas exception: the new Maker's Stages canvas (`?tabs=1`, host-only) is the guest's own tabbed
   *  page, each tab its own page (owner 2026-10-07, verbatim: *"yes pages"* — "each page is just a bookmark on a
   *  single page that just jumps. this was not the plan"). Its navigator still lists every scene, under its tab
   *  (`drawnMakerOrder` measures every tab's groups). */
  stagesCanvas?: boolean;
}): boolean {
  return TABBED_STAGES.includes(input.stage) && input.bodyNormal && input.barDrawn && (!input.makerCanvas || input.stagesCanvas === true);
}

/** The bar's tabs that are pages of this one (live, and addressed `?tab=`), in bar order. */
export function inPageTabs(slots: ReadonlyArray<{ key: string; href: string; state: 'live' | 'locked' }>): string[] {
  return slots.filter((s) => s.state === 'live' && isHubTabHref(s.href)).map((s) => s.key);
}

/** The tab to show: the address's, when this bar has it; otherwise the first tab. */
export function activeHubTab(param: unknown, inPage: readonly string[]): string {
  const want = typeof param === 'string' ? param.trim() : Array.isArray(param) ? String(param[0] ?? '').trim() : '';
  if (want && inPage.includes(want)) return want;
  return inPage[0] ?? 'home';
}

const rank = (k: string) => (HUB_TAB_ORDER as readonly string[]).indexOf(k);

/**
 * WHICH TAB A PIECE OF THE PAGE LIVES ON.
 *
 * Content asks for the tab it belongs to (`want`). When this reader's bar has
 * that tab, that is the answer. When it does not — a stranger has no Me, a
 * guest on the day has no Details, a wedding with no love story has no Our Love
 * Story — the piece goes to the nearest tab ABOVE it in `HUB_TAB_ORDER` that the
 * bar does have, and failing that to the first tab. 🔑 NOTHING IS EVER STRANDED
 * on a tab nobody can open: a section the old long page showed is still shown,
 * on the page a reader would have been scrolling when they passed it.
 *
 * 📱 WHICH TAB IT ASKS FOR IS THE MAKER'S FILING (owner 2026-10-08, DECISION_LOG
 * "EIGHT OWNER ANSWERS", answer 5 — the guest's pages follow the Maker's:
 * *"yes"*). A part the approved prototype names asks for the prototype's page
 * first (`readerPageOf`, `lib/maker-stage-filing.ts` — the function the Maker's
 * canvas files by); this rule is what answers when that reader's bar has no
 * such tab, with the tab the part stood on before the ruling as `want`. So the
 * whole order a part falls through is: the prototype's page · the tab it asked
 * for before · the nearest tab above that in `HUB_TAB_ORDER` · the first tab.
 */
export function hubTabFor(want: string, inPage: readonly string[]): string {
  if (inPage.includes(want)) return want;
  const w = rank(want);
  let best: string | null = null;
  for (const k of inPage) {
    const r = rank(k);
    if (r >= 0 && w >= 0 && r <= w && (best === null || r > rank(best))) best = k;
  }
  return best ?? inPage[0] ?? want;
}

/**
 * THE DAY'S LIVE TAB LEADS WITH DIRECTIONS UNTIL THE DAY BEGINS (DECISION_LOG
 * "THE DAY'S MENU HAS FIVE": *"Live: what's on now + up next … before it
 * starts, Directions on top"*).
 *
 * "Before it starts" is the programme's first block. 🕐 A schedule time is the
 * venue's own wall-clock parked in UTC (see `lib/schedule.ts` `venueNowMs`), so
 * it is compared against `venueNowMs` — the same clock the programme's own
 * "happening now" uses — never against `Date.now()`, which would be eight hours
 * off in Manila. No programme → no moment to wait for → Directions stay on top.
 */
export function directionsLead(input: { firstStartAt: string | null | undefined; venueNowMs: number }): boolean {
  const start = input.firstStartAt ? Date.parse(input.firstStartAt) : Number.NaN;
  if (!Number.isFinite(start)) return true;
  return input.venueNowMs < start;
}

/**
 * 📸 THE CAMERA COMES BACK TO WHERE THE GUEST WAS (owner 2026-10-01, DECISION_LOG
 * "THE EVENT HUB IS FULL SCREEN WITH ONE EXIT…" + the P9 addendum: *"Camera exit
 * → the page they came from (Live only when opened directly), with a 'N photos
 * added · See them' note"*).
 *
 * The bar's Camera carries the tab it was tapped on (`back`); the session
 * bridge passes it to the camera untouched; the camera's × returns to it with
 * the count of shots that landed (`added`), and the Event Hub says so once.
 * Every value is re-checked here — `back` against the tab keys, `added` as a
 * small whole number — so neither can become a path or a lie bigger than a
 * phone could take in one sitting.
 */
export const CAMERA_BACK_PARAM = 'back';
export const CAMERA_ADDED_PARAM = 'added';

/** The camera link, told which tab it was opened from. Unchanged when there is no tab or no event to return to. */
export function cameraHrefWithBack(href: string, tab: string | null): string {
  if (!tab || isHubTabHref(href) || !/[?&]from=/.test(href)) return href;
  return `${href}&${CAMERA_BACK_PARAM}=${encodeURIComponent(tab)}`;
}

/** A `back` value we will put in an address: one of the tab keys, or null. */
export function cameraBackTab(raw: unknown): HubTabKey | null {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return (HUB_TAB_ORDER as readonly string[]).includes(v) ? (v as HubTabKey) : null;
}

/** The count of shots that landed, as the hub will print it — a whole number 1…999, or null. */
export function addedShots(raw: unknown): number | null {
  const v = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? '') : '';
  if (!/^\d{1,3}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 ? n : null;
}

/**
 * Where the camera's × goes: the tab it was opened from — Live when it was
 * opened directly (a QR, a link) — on the event's own page, carrying the count.
 * `slug` must already be a checked slug (the camera page validates it).
 */
export function cameraExitHref(slug: string, back: unknown, added: number, tab?: HubTabKey): string {
  const to = tab ?? cameraBackTab(back) ?? 'live';
  const n = added >= 1 ? `&${CAMERA_ADDED_PARAM}=${Math.min(999, Math.floor(added))}` : '';
  return `/${slug}?${HUB_TAB_PARAM}=${to}${n}`;
}
