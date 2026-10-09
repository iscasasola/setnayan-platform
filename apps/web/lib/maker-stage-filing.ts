/**
 * lib/maker-stage-filing.ts — 🧭 THE STAGES CANVAS'S PAGES, AND THE PAGE EVERY PART IS ON.
 *
 * Owner, 08 Oct, on the new Maker's Stages view, verbatim: *"i do not see the individual pages. i still see
 * invitation as a 1 long page that scrolls down"* — after his ruling of 2026-10-07, *"yes pages"* (*"each page is
 * just a bookmark on a single page that just jumps. this was not the plan"*). DECISION_LOG 2026-10-08 "OWNER
 * RULINGS, LATE NIGHT": *"in the Maker, each tab is its own page with only its parts"*.
 *
 * Measured on the preview before this file (375 px, Invitation and The Day): the canvas grouped its content by the
 * READER's resolved bar (`inPageTabs(bar)` — a host's canvas has no live Our Love Story while the story is unwritten,
 * and on the day no Welcome, Camera or Gallery), so a tab the Maker's own bar showed had no page and its content
 * collapsed onto a neighbour; and the canvas-only stand-ins (greeting, pass, RSVP, the day's parts) were mounted
 * outside every group, so they were drawn on EVERY tab.
 *
 * ── ONE LIST, TWO READERS ───────────────────────────────────────────────────
 * `makerStagesPages` is the stage's pages in Stages. The Maker's bar (`stage-tools.tsx`), the stage menu's page count
 * (`stage-item-menu.tsx`) and the canvas's groups (`app/[slug]/_components/site-body.tsx`) all ask it — never a
 * second list. It is the guest bar's own pages (`guestBarForStage`, the function the Maker's Page ▾ is built from),
 * on the stages whose page is tabs (`TABBED_STAGES`, the canvas's own rule); a stage the canvas draws as ONE page is
 * one page here too.
 *
 * ── ONE FILING ──────────────────────────────────────────────────────────────
 * `makerStagesPageOf` answers which page a part drawn at a canvas key is on: the page the approved prototype's
 * `TABS` puts it on (`MAKER_STAGE_PAGES`, pinned by `lib/the-stage-pages-are-the-prototypes.test.ts`). A key no part
 * of this stage names stays on the page the shipped page files it on (`anchorOfTile`, the navigator's own rule) —
 * never stranded on a page nobody can open (`hubTabFor`).
 *
 * ── …AND THE GUEST'S PAGE ASKS IT TOO ───────────────────────────────────────
 * Owner, 2026-10-08 (DECISION_LOG "EIGHT OWNER ANSWERS", answer 5), asked whether the guest's page should change to
 * match the Maker's filing — Countdown on Welcome in the Maker, on Details on a guest's phone: *"yes"*.
 * `readerPageOf` is a READER's page for a part. Both it and `makerStagesPageOf` read `prototypePageOf`, so a part
 * the prototype names can never again be on one page for the couple and on another for their guest:
 *
 *   1. the prototype's page for it (`prototypePageOf`, on the Maker's own page list) — when THIS reader's bar has
 *      that tab;
 *   2. otherwise the tab the page itself asks for (`want`, where the part stood before this ruling), on the nearest
 *      tab the reader's bar HAS: `hubTabFor` — the nearest tab at or above it in `HUB_TAB_ORDER`
 *      (live · home · details · story · gallery · me), failing that the bar's first tab.
 *
 * A reader's tabs stay the tabs of their OWN bar (`inPageTabs`): a tab with nothing behind it for that reader is
 * not drawn (no Our Love Story while the story is unwritten, no Me for a reader without a key), so step 2 is what
 * keeps a part from being dropped or stranded — it stays where that reader meets it today. A key no part of the
 * stage names (the checklist, the song request, the scan-trail switch) has no step 1: it is not moved at all.
 *
 * Pure. No React, no DOM, no I/O. ⚠ Read by the canvas (a server component), the Stages tools (lazy) and tests —
 * NEVER import it from a file on the Maker's first load (`check-maker-js-budget.mjs`).
 */
import { TABBED_STAGES, hubTabFor, inPageTabs } from '../app/[slug]/_lib/hub-tabs';
import type { WelcomePart } from './invitation-welcome';
import type { LifecyclePhase } from './invitation-widgets';
import { guestBarForStage } from './maker-guest-pages';
import { anchorOfTile } from './maker-navigator-tabs';
import { makerPartCanvasOn } from './maker-part-groups';
import { makerPartsOnPage } from './maker-parts';

export type MakerStagesPage = { key: string; label: string };

/**
 * The stage's pages in Stages, in the guest bar's order and words. `hasStory` false (a type with no two people)
 * drops Our Love Story, as the guest's bar drops it. A stage that is not tabs is its first page alone.
 */
export function makerStagesPages(stage: LifecyclePhase, hasStory = true): MakerStagesPage[] {
  const bar = guestBarForStage(stage, hasStory).map(({ key, label }) => ({ key: key as string, label }));
  return TABBED_STAGES.includes(stage) ? bar : bar.slice(0, 1);
}

/** Does the Stages canvas draw this stage as tabs, each its own page? (More than one page.) */
export function makerStageIsPaged(stage: LifecyclePhase, hasStory = true): boolean {
  return makerStagesPages(stage, hasStory).length > 1;
}

/**
 * 🎫 A KEY THE PROTOTYPE'S MAP NAMES NO PART FOR ON SOME STAGE, AND THE PAGE IT IS ON ALL THE SAME — each with the
 * shipped reason, so it is never a guess:
 *
 *   f:pass → Me. The guest's pass is the Digital ticket, and the ticket is on Me only (owner 2026-09-30, `site-body.tsx`
 *            "THE PASS IS NOT ON HOME ANY MORE — IT IS THE DIGITAL TICKET, ON ME"). The prototype lists it on The
 *            Day › Me; on the Invitation it lists none, and guests still meet theirs on Me.
 */
const STAGES_OWN_PAGE: Readonly<Record<string, string>> = { 'f:pass': 'me' };

/**
 * The page of `pages` the part drawn at canvas key `key` is on (see the docblock). `pages` are the stage's page
 * keys, in order — `makerStagesPages(stage).map((p) => p.key)`.
 */
export function makerStagesPageOf(stage: LifecyclePhase, key: string, pages: readonly string[]): string {
  /* No part names it: where the shipped page files it, on the nearest page this stage has. */
  return prototypePageOf(stage, key, pages) ?? hubTabFor(anchorOfTile(key, stage === 'event'), pages);
}

/**
 * THE PROTOTYPE'S PAGE FOR A KEY — the first page of `pages` whose parts name this canvas key (`MAKER_STAGE_PAGES`),
 * or the one page it has all the same (`STAGES_OWN_PAGE`). Null: no part of this stage names it. The ONE reading
 * both the Maker's canvas (`makerStagesPageOf`) and a reader's page (`readerPageOf`) file by.
 */
export function prototypePageOf(stage: LifecyclePhase, key: string, pages: readonly string[]): string | null {
  const claimed = pages.find((p) => makerPartsOnPage(stage, p).some((k) => makerPartCanvasOn(stage, k) === key));
  if (claimed) return claimed;
  const own = STAGES_OWN_PAGE[key];
  return own && pages.includes(own) ? own : null;
}

/**
 * 📱 A READER'S PAGE FOR A PART (owner 2026-10-08, answer 5 — see the docblock). `tabs` are the tabs of the reader's
 * own bar (`inPageTabs`), `makerPages` the Maker's page keys for this stage (`makerStagesPages`), `want` the tab the
 * page asks for when the prototype's page is not one of this reader's.
 */
export function readerPageOf(stage: LifecyclePhase, key: string, want: string, tabs: readonly string[], makerPages: readonly string[]): string {
  const page = prototypePageOf(stage, key, makerPages);
  return page !== null && tabs.includes(page) ? page : hubTabFor(want, tabs);
}

/**
 * THE PAGE A PART ASKS FOR, WHOEVER READS — the prototype's page, else the page's own ask. What a reader's bar is
 * resolved FROM (a Details or a Welcome tab is drawn only when something asks for it), so it never reads that bar.
 */
export function ownPageOf(stage: LifecyclePhase, key: string, want: string, makerPages: readonly string[]): string {
  return prototypePageOf(stage, key, makerPages) ?? want;
}

/**
 * 🗂 A READER'S SCENES, IN THREE RUNS — every scene in exactly one, the couple's order kept inside each:
 *
 *   lead   the stage's first page's own scenes (the Invitation's Welcome: Countdown · Message — prototype `TABS`),
 *          drawn up with the cover, around the greeting;
 *   here   the scenes that stay with the page's own sections (its Details; on the day, Live);
 *   away   the scenes on another tab of this reader's bar (the day's venue on Welcome).
 *
 * `on` false — a page that is one scroll, or the Maker's Stages canvas, which files by its own list — and every
 * scene is `here`, as before this ruling. `tabOf` is the reader's tab for a scene (`readerPageOf`), `ownOf` the page
 * it asks for whoever reads (`ownPageOf`); `leadTab` is null on a stage whose first page keeps no scenes of its own
 * up with the cover (The Day: the programme stays with Live's sections).
 */
export function fileScenes<T>(input: {
  scenes: readonly T[];
  on: boolean;
  leadTab: string | null;
  hereTab: string;
  tabOf: (scene: T) => string;
  ownOf: (scene: T) => string;
}): { lead: T[]; here: T[]; away: T[] } {
  const { scenes, on, leadTab, hereTab, tabOf, ownOf } = input;
  if (!on) return { lead: [], here: [...scenes], away: [] };
  const lead = leadTab === null ? [] : scenes.filter((w) => ownOf(w) === leadTab && tabOf(w) === leadTab);
  const rest = scenes.filter((w) => !lead.includes(w));
  return { lead, here: rest.filter((w) => tabOf(w) === hereTab), away: rest.filter((w) => tabOf(w) !== hereTab) };
}

/** The canvas key each Welcome part is marked with (`guest-welcome.tsx` `mark(…)`; the day's two are the section's own). */
export const WELCOME_PART_CANVAS: Readonly<Record<WelcomePart, string>> = {
  look: 'f:look',
  reminders: 'w:what_to_bring',
  march: 'f:entourage',
  venue: 'w:venue_map',
  gifts: 'f:gifts',
};

/**
 * THE TABS A PAGE IS GROUPED BY. For every reader: the tabs of THEIR bar that are pages of this one
 * (`inPageTabs` — unchanged). For the Stages canvas alone (`stagesPages` given): the Maker's page list, so every
 * tab the Maker's bar shows has a page, whether or not this reader's bar carries it.
 */
export function pageTabKeys(input: {
  tabsOn: boolean;
  bar: ReadonlyArray<{ key: string; href: string; state: 'live' | 'locked' }>;
  stagesPages: readonly string[] | null;
}): string[] {
  if (!input.tabsOn) return [];
  return input.stagesPages ? [...input.stagesPages] : inPageTabs(input.bar);
}

/** The pages no content was filed on — the canvas still draws each one a page (its stand-in). */
export function stagesPagesLeft(pages: readonly string[], filled: ReadonlySet<string>): string[] {
  return pages.filter((p) => !filled.has(p));
}

/* ── the canvas's document, as the Stages tools read it ───────────────────── */

type MarkerLike = { getAttribute(name: string): string | null; closest(sel: string): { getAttribute(name: string): string | null; hasAttribute?(name: string): boolean } | null };
type DocLike = { querySelectorAll(sel: string): ArrayLike<MarkerLike> };

/** The page each drawn section marker sits on, as the canvas filed it (`{}` on a canvas that is one page). */
export function filedOnCanvas(doc: DocLike): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of Array.from(doc.querySelectorAll('[data-maker-section]'))) {
    const key = m.getAttribute('data-maker-section');
    const tab = m.closest('[data-hub-tab]')?.getAttribute('data-hub-tab');
    if (key && tab && !(key in out)) out[key] = tab;
  }
  return out;
}

/**
 * 🎭 WHERE THE REVEAL'S STUB GOES: before the first marked part of the page it leads — on a tabbed canvas, the
 * first marker INSIDE that page's own groups, so it is drawn on that page and no other. Null: this page has no
 * marked part to stand before (the stub is not drawn; its tile still picks it).
 */
export function firstMarkerOnPage<M extends MarkerLike>(doc: { querySelectorAll(sel: string): ArrayLike<M> }, page: string | null): M | null {
  const all = Array.from(doc.querySelectorAll('[data-maker-section]'));
  const tabbed = all.some((m) => m.closest('[data-hub-tab]'));
  if (!tabbed) return all[0] ?? null;
  return all.find((m) => m.closest('[data-hub-tab]')?.getAttribute('data-hub-tab') === page) ?? null;
}
