/**
 * 📜 THE INVITATION AND SAVE THE DATE ARE ONE PAGE · THE DAY KEEPS ITS TABS (owner 2026-10-15, DECISION_LOG
 * "THE INVITATION AND SAVE THE DATE BECOME ONE PAGE — THE BOTTOM BAR JUMPS TO SECTIONS · ME STAYS ITS OWN PAGE ·
 * THE DAY KEEPS ITS TABS", verbatim: *"can we return the idea of a unipage and the bottom nav will jump to
 * different parts of the page?"* → *"Yes. Invitation and Save the Date become one page with the bottom bar jumping
 * to sections. Me stays its own page, and The Day keeps its tabs."*; approved on
 * `prototypes/event_hub_one_page_and_desktop_2026-10-15_fable.html` the same day).
 *
 *   The Invitation   · ONE scroll: Home · Details · Story are jump marks (`#site-home` …), lit by scroll-spy;
 *                      Me is its own page (`?tab=me`).
 *   Save the Date    · the same: Home · Story (when the story is on the page) · Me.
 *   The Day          · Live · Home · Camera · Gallery · Me — each tab its own full page, as ruled 2026-09-30
 *                      ("EACH MENU TAB IS ITS OWN FULL PAGE — NOT ONE LONG SCROLL WITH JUMP MARKS" stays in force
 *                      for The Day only).
 *
 * 🔑 THE KEYS DO NOT CHANGE: `home/details/story/me` (and `?tab=details` from an old shared link still lands — on
 * the one page, scrolled to Details).
 *
 * ♻ ONE MECHANISM. Every group of the page is still drawn once, marked with the TAB it is filed on
 * (`data-hub-tab`, the Maker's filing — `lib/maker-stage-filing.ts`) AND the PAGE that tab is on
 * (`data-hub-page`). On The Day a tab is its own page; on the one-page stages every jump-mark tab is on ONE page
 * (`SCROLL_PAGE`) and only Me (`OWN_PAGE_TABS`) is a page of its own. The shell (`hub/hub-shell.tsx`) shows one
 * PAGE at a time. These are the rules, pure, executed by `each-tab-is-its-own-page.test.ts` (The Day) and
 * `the-invitation-is-one-page.test.ts` (the two one-page stages).
 *
 * Pure: no React, no DOM, no database.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { SITE_MENU_ANCHORS, type SiteMenuTabKey } from './site-menu';

/** The query parameter that names the tab — the tab's own address. */
export const HUB_TAB_PARAM = 'tab';

/** The attribute every tab's content carries — the tab it is FILED on (the Maker reads it: `filedOnCanvas`). */
export const HUB_TAB_ATTR = 'data-hub-tab';

/** The attribute every group carries — the PAGE its tab is on. The shell shows the page that matches. */
export const HUB_PAGE_ATTR = 'data-hub-page';

/**
 * The tabs' order on the page, top first — the order a tab's content falls back
 * through when the bar does not carry the tab it asked for (see `hubTabFor`).
 * The Maker's navigator groups its scenes by the SAME order
 * (`lib/maker-navigator-tabs.ts` `PAGE_ANCHOR_ORDER`), so a scene sits under the
 * same tab in the Maker as on the guest's phone.
 */
export const HUB_TAB_ORDER = ['live', 'home', 'details', 'story', 'gallery', 'me'] as const;
export type HubTabKey = (typeof HUB_TAB_ORDER)[number];

/** The stages whose menu is tabs, each its own page: The Day only (owner 2026-10-15). */
export const TABBED_STAGES: readonly LifecyclePhase[] = ['event'];

/** 📜 The stages that are ONE page whose bar jumps to sections: the Invitation and Save the Date (owner 2026-10-15). */
export const ONE_PAGE_STAGES: readonly LifecyclePhase[] = ['rsvp', 'save_the_date'];

/** On a one-page stage, the tabs that are still a page of their own — Me (the guest's pass · reply · seat). */
export const OWN_PAGE_TABS: readonly string[] = ['me'];

/** On a one-page stage, the page every jump mark is on — keyed by the page's first tab, so `?tab=home` still lands. */
export const SCROLL_PAGE = 'home';

/** How a stage's menu works: each tab its own page, one page of jump marks, or neither (one scroll, no tabs). */
export type HubPageMode = 'tabs' | 'one-page' | null;

export function hubPageModeOf(stage: LifecyclePhase): HubPageMode {
  if (TABBED_STAGES.includes(stage)) return 'tabs';
  if (ONE_PAGE_STAGES.includes(stage)) return 'one-page';
  return null;
}

/** Does this tab jump within the one page (rather than open a page of its own)? */
export function isJumpMarkTab(key: string, onePage: boolean): boolean {
  return onePage && !OWN_PAGE_TABS.includes(key);
}

/**
 * A tab's address. A page of its own: `?tab=<key>` — relative on purpose, it stays on this event. On a one-page
 * stage a jump-mark tab is its section's anchor instead (`#site-details`) — `SITE_MENU_ANCHORS`, the one list.
 */
export function hubTabHref(key: string, onePage = false): string {
  if (isJumpMarkTab(key, onePage) && key in SITE_MENU_ANCHORS) return `#${SITE_MENU_ANCHORS[key as SiteMenuTabKey]}`;
  return `?${HUB_TAB_PARAM}=${encodeURIComponent(key)}`;
}

/** Is this href one of the page's section anchors (`#site-home` · `#site-details` · …)? */
export function isJumpMarkHref(href: string | null | undefined): boolean {
  return typeof href === 'string' && (Object.values(SITE_MENU_ANCHORS) as string[]).some((a) => href === `#${a}`);
}

/** The page a tab is on: on a one-page stage every jump mark is on `SCROLL_PAGE`; otherwise the tab is its page. */
export function hubPageOf(tab: string, onePage: boolean): string {
  return isJumpMarkTab(tab, onePage) ? SCROLL_PAGE : tab;
}

/**
 * THE TABS A BAR FILES CONTENT ON — the Maker's filing reads these, so a part stands on the same tab on The Day's
 * pages and on the one page alike. The Day: its `?tab=` pages. A one-page stage: its jump marks AND its pages, in
 * bar order (`home · details · story · me`).
 */
export function filingTabs(slots: ReadonlyArray<{ key: string; href: string; state: 'live' | 'locked' }>, onePage: boolean): string[] {
  if (!onePage) return inPageTabs(slots);
  return slots.filter((s) => s.state === 'live' && (isHubTabHref(s.href) || isJumpMarkHref(s.href))).map((s) => s.key);
}

/** THE PAGES A BAR SWITCHES BETWEEN — what the shell shows one at a time. The one page first, then Me. */
export function hubPagesOf(tabs: readonly string[], onePage: boolean): string[] {
  const out: string[] = [];
  for (const t of tabs) {
    const p = hubPageOf(t, onePage);
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/** Is this group shown, for the page the address asked for? A jump-mark tab is on the page whenever Me is not. */
export function hubGroupShown(tab: string, activePage: string, onePage: boolean): boolean {
  return hubPageOf(tab, onePage) === activePage;
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
 *   · only The Day (each tab its own page) and the two one-page stages, the
 *     Invitation and Save the Date (one scroll of jump marks + Me its own page,
 *     owner 2026-10-15) — the story after the day is one page and is not part
 *     of either ruling;
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
  /** 🎞 Save the Date's film body — the film over the stage's OWN ordinary body (`phasedBody` draws that body under
   *  the film for every event since 2026-08-05), so the one page and its Me are there all the same. */
  bodyFilm?: boolean;
}): boolean {
  const mode = hubPageModeOf(input.stage);
  if (mode === null || !input.barDrawn) return false;
  const body = input.bodyNormal || (input.stage === 'save_the_date' && input.bodyFilm === true);
  return body && (!input.makerCanvas || input.stagesCanvas === true);
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
