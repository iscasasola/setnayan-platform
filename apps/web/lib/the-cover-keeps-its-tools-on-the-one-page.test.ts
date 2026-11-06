/**
 * the-cover-keeps-its-tools-on-the-one-page.test.ts — 📜 ON A ONE-PAGE STAGE THE TOOLBAR READS THE PAGE ON SCREEN,
 * NOT THE TAB ITS BAR NAMES — so no part's approved Edit or Style is empty because of where the page is scrolled.
 *
 * 🔴 Owner, 2026-10-20, live (phone, Invitation, bar on "Details", Cover Scene picked): Style empty — *"cannot see
 * the reveal"* — and Edit only "Tap a name to edit that word." with no lines; then *"after pressing around, i see it
 * now. but there is a bug where it does not show properly."* The Invitation and Save the Date are ONE page (owner
 * 2026-10-15; `hub-tabs.ts` `hubPageModeOf`), and the bar's tab follows the scroll. The toolbar read the cover's
 * lines and whether the Cover Scene leads (its Opening — DECISION_LOG 2026-10-16 "THE COVER SCENE'S OWN EDIT · STYLE
 * (OPENING) · ANIMATE", 2026-10-17 "EACH STAGE'S COVER SCENE › STYLE IS ITS SWITCH") off the TAB's list — "Details"
 * lists neither — so both bodies were empty until a scroll moved the bar back to Home. A tap on a cover word there
 * also named the Cover Scene instead of the word.
 *
 * Properties:
 *   1. On every one-page stage, every tab sharing the one page sees the SAME parts — all of every such tab's.
 *   2. From every one of those tabs the Cover Scene leads (its Style = the Opening) and has its lines (its Edit).
 *   3. From every one of those tabs a tap on each part's own spot names THAT part (Names, Date, Place, Logo, the
 *      Countdown, the Message …) — never its neighbour, never nothing.
 *   4. A stage of tabbed pages (The Day) and the RSVP stage's screens are unchanged: each tab its own list.
 *   5. Wiring: the toolbar reads the cover through these rules, and a tap that names no part lets the work area's
 *      body go ONLY while nothing is picked — a pick made meanwhile keeps its body (never stale, never empty).
 *
 * Sabotage (seen red, see the PR): `makerPartsOnShownPage` returns the tab's own list · the cover lines read
 * `makerPartsOnPage` again · the no-part close forgets the `pickedRef` check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MAKER_COVER_SCENE,
  MAKER_PARTS,
  MAKER_STAGE_PAGES,
  makerCoverLeads,
  makerCoverLineParts,
  makerPartOfTap,
  makerPartsOnPage,
  makerPartsOnShownPage,
  type MakerPartKey,
  type MakerStageKey,
} from './maker-parts';
import { RSVP_STAGE_KEY } from './rsvp-stage-shared';
import { ONE_PAGE_STAGES, hubPageOf } from '@/app/[slug]/_lib/hub-tabs';

const tabsOf = (stage: MakerStageKey) => Object.keys(MAKER_STAGE_PAGES[stage] ?? {});
/** The tabs that share the one page (every jump mark), on a one-page stage. */
const sharedTabs = (stage: MakerStageKey) => tabsOf(stage).filter((t) => hubPageOf(t, true) === hubPageOf('home', true));

test('(1) every tab of the one page sees the same parts — all of them', () => {
  assert.ok(ONE_PAGE_STAGES.length >= 2, 'the Invitation and Save the Date are one-page stages');
  for (const stage of ONE_PAGE_STAGES as readonly MakerStageKey[]) {
    const tabs = sharedTabs(stage);
    assert.ok(tabs.length >= 2, `${stage}: one page holds several tabs (${tabs.join(',')})`);
    const all = new Set(tabs.flatMap((t) => makerPartsOnPage(stage, t)));
    for (const tab of tabs) {
      const seen = makerPartsOnShownPage(stage, tab);
      const missing = [...all].filter((k) => !seen.includes(k));
      assert.deepEqual(missing, [], `${stage} › ${tab}: the page on screen lacks ${missing.join(', ')}`);
      assert.deepEqual([...seen], [...makerPartsOnShownPage(stage, tabs[0])], `${stage} › ${tab}: another order than ${tabs[0]}`);
    }
  }
});

test('(2) from every tab of the one page the Cover Scene leads and has its lines', () => {
  for (const stage of ONE_PAGE_STAGES as readonly MakerStageKey[]) {
    if (!sharedTabs(stage).some((t) => makerPartsOnPage(stage, t).includes(MAKER_COVER_SCENE))) continue;
    const lines = makerCoverLineParts(stage, 'home');
    assert.ok(lines.length >= 3, `${stage}: the cover has its lines (${lines.join(',')})`);
    for (const tab of sharedTabs(stage)) {
      assert.equal(makerCoverLeads(stage, tab), true, `${stage} › ${tab}: Cover Scene › Style (the Opening) is gone`);
      assert.deepEqual(makerCoverLineParts(stage, tab), lines, `${stage} › ${tab}: Cover Scene › Edit lost its lines`);
    }
  }
  /* Me is its own page: no cover there, as drawn. */
  assert.equal(makerCoverLeads('rsvp', 'me'), false);
});

test('(3) from every tab of the one page a tap on a part names THAT part', () => {
  let checked = 0;
  for (const stage of ONE_PAGE_STAGES as readonly MakerStageKey[]) {
    const tabs = sharedTabs(stage);
    const parts = makerPartsOnShownPage(stage, tabs[0]);
    /* A spot two parts share (the Reply card has no spot) is not one part's. */
    const spot = (k: MakerPartKey) => (MAKER_PARTS[k].canvas ? `${MAKER_PARTS[k].canvas}|${MAKER_PARTS[k].el ?? ''}` : null);
    const own = parts.filter((k) => spot(k) && parts.filter((o) => spot(o) === spot(k)).length === 1);
    for (const tab of tabs) {
      for (const k of own) {
        const def = MAKER_PARTS[k];
        assert.equal(makerPartOfTap(stage, tab, def.canvas!, def.el ?? null), k, `${stage} › ${tab}: a tap on ${k} named another part`);
        checked++;
      }
    }
    for (const word of ['names', 'date', 'place', 'logo'] as const) assert.ok(own.includes(word), `${stage}: ${word} is one of the page's parts`);
  }
  assert.ok(checked > 40, `checked ${checked} taps`);
});

test('(4) a stage of tabbed pages, and the RSVP stage, keep each tab its own list', () => {
  for (const stage of ['event', RSVP_STAGE_KEY] as const) {
    for (const tab of tabsOf(stage)) assert.deepEqual([...makerPartsOnShownPage(stage, tab)], [...makerPartsOnPage(stage, tab)], `${stage} › ${tab}`);
  }
});

test('(5) wiring: the toolbar reads the cover through the rules; a no-part tap lets go only while nothing is picked', () => {
  const tools = readFileSync(path.join(process.cwd(), 'app/dashboard/[eventId]/launch/_components/stage-tools.tsx'), 'utf8');
  assert.match(tools, /const coverLeadsHere = Boolean\([^;]*makerCoverLeads\(stage, shownPage\)\);/, 'Cover Scene › Style reads the page on screen');
  assert.match(tools, /const next = makerCoverLineParts\(stageKey, shownPage\)/, 'Cover Scene › Edit reads the page on screen');
  assert.doesNotMatch(tools, /makerPartsOnPage\((stage|stageKey), shownPage\)\s*\.filter\(\(k\) => makerPartParent/, 'the cover lines are read off the tab again');
  const noPart = tools.slice(tools.indexOf('if (!k) {'), tools.indexOf('setPicked(k);', tools.indexOf('if (!k) {')));
  assert.ok(noPart.length > 0, 'the no-part branch is found');
  assert.match(noPart, /if \(pickedRef\.current === null\) openToolRef\.current\?\.close\(\);/, 'a pick made meanwhile would lose its body');
  assert.doesNotMatch(noPart, /=> openToolRef\.current\?\.close\(\)\)\)/, 'the body is let go unconditionally');
});
