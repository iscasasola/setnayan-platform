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
  /* The prototype's page for it: the first page whose parts name this canvas key. */
  const claimed = pages.find((p) => makerPartsOnPage(stage, p).some((k) => makerPartCanvasOn(stage, k) === key));
  if (claimed) return claimed;
  const own = STAGES_OWN_PAGE[key];
  if (own && pages.includes(own)) return own;
  /* No part names it: where the shipped page files it, on the nearest page this stage has. */
  return hubTabFor(anchorOfTile(key, stage === 'event'), pages);
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
