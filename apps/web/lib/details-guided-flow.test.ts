/**
 * details-guided-flow.test.ts — DETAILS PART 5: the guided "What's left"
 * (DECISION_LOG 2026-09-29 "IT NEEDS TO BE VERY EASY — DETAILS OPENS AS A
 * GUIDED WHAT'S LEFT", "THE EVENT HUB SEQUENCE, STEP 1 TO FINISH — THREE
 * ROUNDS…", "THE GUIDED FLOW IS APPROVED — AND ANY STEP CAN BE PICKED ANY TIME",
 * "THE PLAN ADAPTS TO EVERY EVENT TYPE").
 *
 * Held here:
 *   (1) the order — three rounds, the approved sequence, each ending in Ready;
 *   (2) a step IS an item: its done is its items' done; a step whose item this
 *       event lacks is not in the plan (a birthday; the Seat plan until its
 *       item lands — and a tripwire the day a seat item joins Details);
 *   (3) Next goes to the next UNFINISHED step (a look-over is never skipped),
 *       Skip to the very next, Back to the one before;
 *   (4) Home's "Round N · x of y", the address (`?guide=`), where it opens;
 *   (5) the pages that decide before Details draws read "done" through the
 *       very functions the navigator's rows use;
 *   (6) the workspace draws the flow AROUND the same items — editors stay
 *       mounted on a Ready screen — and Apply is the bar's one Apply, pressed
 *       once even with the bar mounted twice;
 *   (7) plain words: no wedding word, no "stage" / "scene" on this path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';
import {
  GUIDED_ROUNDS,
  WAKE_ROUNDS,
  guidedRoundsFor,
  GUIDED_STEPS,
  SEAT_PLAN_STEP_ITEMS,
  backScreen,
  buildGuidedPlan,
  firstOpenScreen,
  guideParamOf,
  guidedItemDone,
  guidedScreens,
  isUnfinished,
  nextScreen,
  parseGuideParam,
  progressLabel,
  skipScreen,
  stageSteps,
  startScreen,
  stepStateOf,
  wordsAndPlansInputFrom,
  type GuidedItem,
  type GuidedDoneFacts,
} from './details-guided-flow';
import { setupProgress, stageProgress } from './stage-setup';
import { DETAILS_ITEM_KEYS, FREE_PRINT_KEYS, wordsAndPlansItem, type DetailsItemKey } from './maker-details-items';
import { yourEventDone, type YourEventFacts } from './details-your-event';
import { parsePrintDetails } from './print-pieces';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Every item a wedding's Details draws, as the navigator hands them over. */
const WEDDING_ITEMS: DetailsItemKey[] = [
  'theme', 'mood-board', 'logo', 'hero', 'reveal',
  'names', 'date', 'venues', 'parents', 'march',
  'special-message', 'thank-you', 'opening-line', 'kindly-reply',
  'love-story', 'schedule', 'rsvp',
  'address', 'qr', 'invitation', 'entourage', 'details', 'menu', 'pass', 'poster', 'card',
  ...FREE_PRINT_KEYS,
  'download',
];
const DONE_BY_DATA = new Set<DetailsItemKey>([
  'theme', 'mood-board', 'logo', 'hero', 'names', 'date', 'venues', 'parents', 'march',
  'special-message', 'thank-you', 'opening-line', 'kindly-reply', 'love-story', 'schedule',
]);
const items = (keys: readonly DetailsItemKey[], done: (k: DetailsItemKey) => boolean | undefined): GuidedItem[] =>
  keys.map((k) => ({ key: k, label: k === 'march' ? 'Wedding March' : k === 'parents' ? 'Parents & hosts' : k, done: done(k) }));
const WORDS = { solemn: false, parentsOffered: true };
/** A new event: nothing filled in (the items with a "done" say false; the rest have none). */
const fresh = () => buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? false : undefined)), WORDS);

/* ── (1) the order, by stage ─────────────────────────────────────────────── */

const keysOf = (plan: ReturnType<typeof fresh>, r: Parameters<typeof stageSteps>[1]) => stageSteps(plan, r).map((s) => s.key);

test('(1) each stage walks its own facts, in the approved order; Post Event is never walked', () => {
  const plan = fresh();
  assert.deepEqual(plan.rounds, ['save_the_date', 'rsvp-stage', 'rsvp', 'event'], 'the stages walked are not the four (Post Event fills itself)');
  assert.deepEqual(keysOf(plan, 'save_the_date'), ['names', 'date', 'theme', 'logo', 'hero', 'love-story']);
  assert.deepEqual(keysOf(plan, 'rsvp-stage'), ['who', 'rsvp', 'reply-by'], 'the RSVP stage is not its three settings');
  assert.deepEqual(keysOf(plan, 'rsvp'), [
    'names', 'date', 'theme', 'logo', 'hero', 'love-story', 'venues', 'schedule', 'parents', 'march', 'colours', 'message',
  ]);
  assert.deepEqual(keysOf(plan, 'event'), ['names', 'date', 'theme', 'logo', 'hero', 'venues', 'schedule', 'parents', 'march']);
  assert.deepEqual(keysOf(plan, 'editorial'), []);
  const screens = guidedScreens(plan, 'save_the_date').map((s) => (s.kind === 'step' ? s.step : s.kind));
  assert.deepEqual(screens, ['before', 'names', 'date', 'theme', 'logo', 'hero', 'love-story', 'ready'], 'a stage is not Before · steps · Ready');
  // Each step shows the SAME item Details draws — Colours is the Mood Board, the cover the hero.
  const by = Object.fromEntries(plan.steps.map((s) => [s.key, s.items]));
  assert.deepEqual(by.colours, ['mood-board']);
  assert.deepEqual(by.hero, ['hero']);
  assert.deepEqual(by.message, ['special-message']);
  // RSVP's three settings are ONE item, each its own section (`RSVP_PIECES`).
  for (const [k, piece] of [['who', 'who'], ['rsvp', 'questions'], ['reply-by', 'reply-by']] as const) {
    assert.deepEqual(by[k], ['rsvp']);
    assert.equal(plan.steps.find((s) => s.key === k)!.piece, piece, `${k} does not open on its own section`);
  }
  // The march's name is its item's (the event type writes it) — never typed here.
  assert.equal(plan.steps.find((s) => s.key === 'march')!.title, 'Wedding March');
  assert.equal(progressLabel(plan, { kind: 'step', step: 'theme', round: 'save_the_date' }), 'Save the Date · 3 of 6');
  assert.equal(progressLabel(plan, { kind: 'step', step: 'theme', round: 'rsvp' }), 'Invitation · 3 of 12', 'a shared step counts in the stage being walked');
  assert.equal(progressLabel(plan, { kind: 'ready', round: 'rsvp' }), 'Invitation · Apply', 'a Ready screen with steps left says "done"');
  assert.equal(progressLabel(plan, { kind: 'stages' }), 'Which stage?');
});

/* ── (2) a step IS an item ──────────────────────────────────────────────── */

test('(2) a step’s state is its items’ own done — done · left · a look-over', () => {
  assert.equal(stepStateOf([true]), 'done');
  assert.equal(stepStateOf([false]), 'left');
  assert.equal(stepStateOf([true, false, true]), 'left', 'one unfilled item leaves the step in What’s left');
  assert.equal(stepStateOf([undefined]), 'check', 'nothing to fill is a look-over, never "done" or "left"');
  assert.equal(stepStateOf([true, undefined]), 'done');
  const plan = fresh();
  assert.equal(plan.steps.find((s) => s.key === 'rsvp')!.state, 'check');
  assert.equal(plan.steps.find((s) => s.key === 'who')!.state, 'check', 'without the setup’s facts, how guests get in makes no claim');
  assert.equal(plan.steps.find((s) => s.key === 'names')!.state, 'left');
  assert.deepEqual(plan.steps.find((s) => s.key === 'names')!.left, ['names'], 'the step does not open on what is still left');
});

test('(2) a step whose item this event lacks is not in the plan — a birthday, and the Seat plan until its item exists', () => {
  const birthday = buildGuidedPlan(
    items(WEDDING_ITEMS.filter((k) => k !== 'names' && k !== 'march' && k !== 'love-story'), () => false),
    { solemn: false, parentsOffered: false },
  );
  const keys = birthday.steps.map((s) => s.key);
  for (const k of ['names', 'march', 'love-story'] as const) assert.ok(!keys.includes(k), `a birthday is asked for ${k}`);
  assert.equal(birthday.steps.find((s) => s.key === 'parents')!.shows, 'Optional — who guests reply to.', 'a birthday is told about parents');
  assert.ok(!fresh().steps.some((s) => s.key === 'seat-plan'), 'the Seat plan step shows before its item exists');
  const withSeat = buildGuidedPlan(
    [...items(WEDDING_ITEMS, () => false), { key: SEAT_PLAN_STEP_ITEMS[0] as DetailsItemKey, label: 'Seat plan', done: false }],
    WORDS,
  );
  assert.deepEqual(stageSteps(withSeat, 'event').map((s) => s.key).slice(-1), ['seat-plan'], 'The Day does not end on the Seat plan');
  assert.deepEqual(withSeat.steps.find((s) => s.key === 'seat-plan')!.stages, ['event'], 'the Seat plan shows on another stage');
});

test('(2) tripwire: every seat item Details gains is known to the Seat plan step', () => {
  const seatItems = DETAILS_ITEM_KEYS.filter((k) => /seat/.test(k) && !(FREE_PRINT_KEYS as readonly string[]).includes(k));
  for (const k of seatItems) {
    assert.ok(
      SEAT_PLAN_STEP_ITEMS.includes(k),
      `Details has a seat item "${k}" the guided flow does not name — add it to SEAT_PLAN_STEP_ITEMS`,
    );
  }
  assert.equal(
    GUIDED_STEPS.find((s) => s.key === 'seat-plan')!.items,
    SEAT_PLAN_STEP_ITEMS,
    'the Seat plan step no longer reads SEAT_PLAN_STEP_ITEMS',
  );
  // …and the day the Seat plan item EXISTS (Details part 4 keys it `seating`, its
  // done = arranged), the pages that decide before Details draws — the Maker
  // opening on the flow, Home's card — must read it too, or they would count
  // The Day differently from the step list.
  const early = read(`${L}/details-guided-progress.ts`) + read('lib/details-guided-flow.ts').slice(read('lib/details-guided-flow.ts').indexOf('export function guidedItemDone'));
  for (const k of SEAT_PLAN_STEP_ITEMS.filter((k) => (DETAILS_ITEM_KEYS as readonly string[]).includes(k))) {
    assert.ok(
      new RegExp(`'${k}'`).test(early),
      `the Seat plan item "${k}" is in Details but Home and the Maker's opening never read it — add it to guidedPresent and guidedItemDone`,
    );
  }
});

/* ── (3) Next · Skip · Back, within a stage ─────────────────────────────── */

test('(3) Next goes to the next UNFINISHED step of the stage, never over a look-over, then its Ready screen', () => {
  // Save the Date: names, date and theme done; logo, hero left.
  const done = new Set<DetailsItemKey>(['names', 'date', 'theme', 'parents', 'march', 'schedule']);
  const plan = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? done.has(k) : undefined)), WORDS);
  const STD = 'save_the_date' as const;
  assert.deepEqual(nextScreen(plan, { kind: 'before', round: STD }), { kind: 'step', step: 'logo', round: STD }, 'Before we start does not open on the first step still to do');
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'names', round: STD }), { kind: 'step', step: 'logo', round: STD }, 'Next did not skip the done date and theme');
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'love-story', round: STD }), { kind: 'ready', round: STD }, 'the stage does not end on its Ready');
  // The RSVP stage: three look-overs — Next stops at each.
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'who', round: 'rsvp-stage' }), { kind: 'step', step: 'rsvp', round: 'rsvp-stage' }, 'Next skipped a look-over');
  // From a Ready screen: back to the stages — never on into another stage by itself.
  assert.deepEqual(nextScreen(plan, { kind: 'ready', round: STD }), { kind: 'stages' });
  assert.equal(nextScreen(plan, { kind: 'stages' }), null, 'the picker has a Next — a stage is picked, not walked into');
  // A done step still opens when picked; its Next moves on as usual.
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'date', round: STD }), { kind: 'step', step: 'logo', round: STD });
});

test('(3) Skip goes to the very next screen and marks nothing; Back to the one before — Before we start, then the stages', () => {
  const done = new Set<DetailsItemKey>(['date']);
  const plan = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? done.has(k) : undefined)), WORDS);
  const STD = 'save_the_date' as const;
  assert.deepEqual(skipScreen(plan, { kind: 'step', step: 'names', round: STD }), { kind: 'step', step: 'date', round: STD }, 'Skip jumped over a step');
  assert.equal(plan.steps.find((s) => s.key === 'names')!.state, 'left', 'Skip changed a step');
  assert.deepEqual(skipScreen(plan, { kind: 'step', step: 'love-story', round: STD }), { kind: 'ready', round: STD });
  assert.deepEqual(backScreen(plan, { kind: 'step', step: 'names', round: STD }), { kind: 'before', round: STD }, 'the first step has no way back to Before we start');
  assert.deepEqual(backScreen(plan, { kind: 'before', round: STD }), { kind: 'stages' });
  assert.equal(backScreen(plan, { kind: 'stages' }), null, 'the picker has a Back');
  // A step two stages share keeps the stage being walked.
  assert.deepEqual(backScreen(plan, { kind: 'step', step: 'venues', round: 'rsvp' }), { kind: 'step', step: 'love-story', round: 'rsvp' });
  assert.deepEqual(backScreen(plan, { kind: 'step', step: 'venues', round: 'event' }), { kind: 'step', step: 'hero', round: 'event' });
});

/* ── (4) where it opens, Home, the address ─────────────────────────────── */

test('(4) unfinished = a step still left that is not optional; a stage opens on its first', () => {
  const plan = fresh();
  assert.equal(isUnfinished(plan), true);
  assert.deepEqual(firstOpenScreen(plan, 'save_the_date'), { kind: 'step', step: 'names', round: 'save_the_date' });
  assert.deepEqual(firstOpenScreen(plan, 'rsvp-stage'), { kind: 'ready', round: 'rsvp-stage' }, 'a stage of look-overs opens anywhere but its Ready');
  // Everything filled but the (optional) Love Story → finished; it opens on the Love Story when walked.
  const almost = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? k !== 'love-story' : undefined)), WORDS);
  assert.equal(isUnfinished(almost), false, 'an optional step holds the event open');
  assert.deepEqual(firstOpenScreen(almost, 'save_the_date'), { kind: 'step', step: 'love-story', round: 'save_the_date' });
  const all = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? true : undefined)), WORDS);
  assert.deepEqual(firstOpenScreen(all, 'event'), { kind: 'ready', round: 'event' });
  // A stage picked: Before we start the first time, its first step after.
  assert.deepEqual(startScreen(plan, 'rsvp', false), { kind: 'before', round: 'rsvp' });
  assert.deepEqual(startScreen(plan, 'rsvp', true), { kind: 'step', step: 'names', round: 'rsvp' });
});

test('(4) Home and the picker count by stage — every fact once for the whole, each stage its own', () => {
  const done = new Set<DetailsItemKey>(['names', 'date', 'venues', 'theme', 'mood-board', 'logo', 'hero', 'parents']);
  const plan = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? done.has(k) : undefined)), WORDS);
  // 15 facts in all, each once: the Love Story (optional) · schedule · march · message left.
  assert.deepEqual(setupProgress(plan), { done: 11, total: 15, next: 'rsvp' }, 'the whole is not every fact once');
  // Save the Date is done but for the optional Love Story — it never holds a stage open.
  assert.deepEqual(stageProgress(plan, 'save_the_date'), { done: 5, total: 6 });
  assert.deepEqual(stageProgress(plan, 'rsvp-stage'), { done: 3, total: 3 }, 'three look-overs are not in place');
  assert.deepEqual(stageProgress(plan, 'rsvp'), { done: 8, total: 12 });
  const all = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? true : undefined)), WORDS);
  assert.equal(setupProgress(all).next, null, 'Home still says something is left');
});

test('(4) the address: ?guide=1 is the picker; walk-, before- and ready- name a stage; nothing else', () => {
  assert.deepEqual(parseGuideParam('1'), { kind: 'stages' });
  assert.deepEqual(parseGuideParam('ready-rsvp'), { kind: 'ready', round: 'rsvp' });
  assert.deepEqual(parseGuideParam('walk-rsvp-stage'), { kind: 'walk', round: 'rsvp-stage' });
  assert.deepEqual(parseGuideParam('before-event'), { kind: 'before', round: 'event' });
  for (const bad of [undefined, null, '', '0', 'ready-2', 'ready-', 'walk-wedding', 'yes', '1 ']) assert.equal(parseGuideParam(bad), null, String(bad));
  assert.equal(guideParamOf({ kind: 'step', step: 'venues', round: 'rsvp' }), 'walk-rsvp');
  assert.equal(guideParamOf({ kind: 'stages' }), '1');
  for (const at of [{ kind: 'ready', round: 'event' }, { kind: 'before', round: 'save_the_date' }] as const) {
    assert.deepEqual(parseGuideParam(guideParamOf(at)), at);
  }
});

/* ── (5) the same "done" everywhere ─────────────────────────────────────── */

test('(5) "done" for the pages that decide early is the navigator rows’ own functions', () => {
  const ye: YourEventFacts = {
    names: ['Claire', ''],
    date: { value: '2026-12-18', dayPrecise: true },
    venueCount: 0,
    parentCount: 0,
    hostCount: 1,
    marchLines: 3,
  };
  const stored = parsePrintDetails({ opening_line: 'Together with their families' });
  const words = wordsAndPlansInputFrom({ specialMessage: '  ', pabuyaMessage: 'Thank you', stored, loveStoryMoments: null, scheduleMoments: 2 });
  const facts: GuidedDoneFacts = { yourEvent: ye, kind: null, themeChosen: true, palette: false, logo: true, hero: false, words };
  for (const k of ['names', 'date', 'venues', 'parents', 'march'] as const) {
    assert.equal(guidedItemDone(k, facts), yourEventDone(k, ye), k);
  }
  for (const k of ['special-message', 'thank-you', 'opening-line', 'kindly-reply', 'love-story', 'schedule', 'rsvp'] as const) {
    assert.equal(guidedItemDone(k, facts), wordsAndPlansItem(k, words).done, k);
  }
  assert.equal(guidedItemDone('love-story', facts), undefined, 'an unread story was given a done');
  assert.equal(guidedItemDone('theme', facts), true);
  assert.equal(guidedItemDone('mood-board', facts), false);
  assert.equal(guidedItemDone('download', facts), undefined);
  assert.equal(guidedItemDone('names', { ...facts, yourEvent: null }), undefined, 'an unread event was given a done');
  // …and ONE builder of the words input: the navigator uses it too.
  const md = read(`${L}/maker-details.tsx`);
  assert.match(md, /wordsAndPlansItem\(\s*w,\s*wordsAndPlansInputFrom\(\{/, 'the navigator builds its own words input again');
  assert.match(md, /buildGuidedPlan\(\s*groups\.flatMap\(\(g\) => g\.items\)/, 'the flow is no longer built from the navigator’s own rows');
  // The launch page hands ONE derivation to both Details' rows and the decision to open.
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  for (const [prop, re] of [
    ['theme.chosen', /chosen: guided\.themeChosen,/],
    ['hasPalette', /hasPalette=\{guided\.palette\}/],
    ['logoDone', /logoDone: guided\.logo,/],
    ['heroDone', /heroDone: guided\.hero,/],
  ] as const) {
    assert.match(page, re, `Details' ${prop} no longer reads the shared derivation`);
  }
  assert.match(page, /detailsUnfinished = isUnfinished\(\s*guidedPlanFromFacts\(\{[\s\S]{0,500}facts: guided,/);
});

test('(5) the Maker opens on What’s left only for an unfinished event with no place named', () => {
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  const at = page.indexOf('const opensOnGuide =');
  assert.ok(at > 0, 'anti-vacuity: opensOnGuide not found');
  const rule = page.slice(at, page.indexOf(';', at));
  for (const needed of ['hasWork', 'detailsUnfinished', '!rawTool', 'search.scene', 'search.open', 'search.stage', 'search.pin']) {
    assert.ok(rule.includes(needed), `the Maker opens on the flow without checking ${needed}`);
  }
  assert.match(page, /opensOnGuide=\{opensOnGuide && guideAddress === null\}/, 'the tab’s own last place no longer wins over the default');
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /if \(openedOnGuide\.current && saved && 'selection' in saved\) \{/);
});

/* ── (6) the workspace, and the one Apply ──────────────────────────────── */

async function paint(guide: Record<string, unknown>, initial: string) {
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const navItems = ['names', 'date', 'theme', 'address'].map((k) => ({ key: k, group: 'g', label: k, icon: null, done: k === 'date' }));
  const plan = buildGuidedPlan(navItems as GuidedItem[], WORDS);
  const el = React.createElement(DetailsWorkspace, {
      groups: [{ key: 'g', label: 'G', items: navItems }],
      bodies: { names: 'NAMES-BODY', date: 'DATE-BODY', theme: 'THEME-BODY', address: 'ADDRESS-BODY' },
      editors: {
        names: React.createElement('i', { 'data-stub-editor': 'names' }),
        date: React.createElement('i', { 'data-stub-editor': 'date' }),
        theme: React.createElement('i', { 'data-stub-editor': 'theme' }),
        address: React.createElement('i', { 'data-stub-editor': 'address' }),
      },
      initial,
      guide: { plan, open: true, entry: null, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' }, ...guide },
    });
  /* ⚡ A step's heading, its foot and the Ready screens load lazily with the
     Details pieces (\`details-lazy.tsx\`). \`renderSettled\` waits on the loads
     themselves — the 500ms retry loop that stood here lost to a slow CI runner
     (PR #6159, run 36585597410: "no step heading"). */
  return renderSettled(el);
}

test('(6) a step is its item, one at a time: the heading, the narrowed navigator, Back · Skip · Next', async () => {
  const html = await paint({ entry: { kind: 'step', step: 'names', round: 'save_the_date' } }, 'names');
  assert.match(html, /data-details-mode="guided"/);
  assert.match(html, /data-details-guide-top=""/, 'no progress line');
  assert.match(html, /data-details-guide-head="names"/, 'no step heading');
  // 🚫 No "where it shows" caption under the step (owner, live iPhone test 2026-10-05).
  assert.doesNotMatch(html, /Shows on your page, your invitation, every print and every pass\./, 'a caption came back under the step');
  assert.match(html, /NAMES-BODY/, 'the step does not show its item’s own picture');
  assert.match(html, /data-details-guide-next=""/);
  assert.match(html, /data-details-guide-skip=""/);
  // 📱 …in the step's half sheet over the live page (`MakerHalfSheet`), titled by the step.
  assert.match(html, /data-half-sheet="half"/, 'the step is not the half sheet');
  assert.match(html, /data-half-sheet-lead=""/, 'the step ▾ is not the sheet’s header');
  assert.match(html, /Save the Date · 1 of 3/, 'the step does not say where it sits in its stage');
  // One item, no pieces → the navigator steps aside; every editor is still mounted.
  assert.doesNotMatch(html, /aria-label="Details — what to edit"/, 'the whole navigator shows in the flow');
  for (const k of ['names', 'date', 'theme', 'address']) assert.match(html, new RegExp(`data-stub-editor="${k}"`), `${k}’s editor was unmounted`);
  // An item no step shows opens in All items, with the way back in.
  const all = await paint({}, 'address');
  assert.match(all, /data-details-mode="all"/);
  assert.match(all, /data-details-guide-open=""/, 'All items has no way back into What’s left');
});

test('(6) a Ready screen hides the items — never unmounts them — and leaves Apply to the bar', async () => {
  const html = await paint({ entry: { kind: 'ready', round: 'save_the_date' } }, 'names');
  assert.match(html, /data-details-guide-ready="save_the_date"/);
  assert.match(html, /data-details-row="" hidden=""/, 'the items are not hidden on the Ready screen');
  for (const k of ['names', 'date', 'theme', 'address']) assert.match(html, new RegExp(`data-stub-editor="${k}"`), `${k}’s editor was unmounted on Ready`);
  // ✓ ONE Apply (owner 2026-10-05: two Apply buttons on "Almost ready") — the bar's, never the screen's own.
  assert.doesNotMatch(html, /data-details-guide-apply=/, 'the Ready screen grew a second Apply');
  assert.match(html, /data-details-guide-ready-step="names"[^>]*data-state="left"/, 'the Ready list does not say what is left');
  assert.match(html, /Almost ready/, 'a stage with a step left claims it is ready');
  assert.match(html, /data-details-guide-stages=""/, 'a Ready screen has no way back to the stages');
});

test('(6) every door opens "Which stage do you want ready?" — the items hidden, never unmounted', async () => {
  const html = await paint({ entry: { kind: 'stages' } }, 'names');
  assert.match(html, /data-stage-picker=""/, 'the picker is not what the flow opens on');
  assert.match(html, /Which stage do you want ready\?/);
  assert.match(html, /data-details-row="" hidden=""/);
  for (const k of ['names', 'date', 'theme', 'address']) assert.match(html, new RegExp(`data-stub-editor="${k}"`), `${k}’s editor was unmounted under the picker`);
  // The five stages, Post Event listed but never walked.
  for (const st of ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial']) assert.match(html, new RegExp(`data-stage-row="${st}"`), `${st} is not listed`);
  assert.match(html, /data-stage-row="editorial"[^>]*disabled=""|disabled=""[^>]*data-stage-row="editorial"/, 'Post Event can be walked');
  assert.match(html, /Fills itself from the day/);
});

test('(6) Apply is the bar’s ONE Apply — pressed once even with the bar mounted twice', async () => {
  const bar = read('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /window\.addEventListener\(MAKER_PRESS_APPLY_EVENT, press\)/, 'the bar no longer answers the Ready screen');
  assert.match(bar, /if \(!detail \|\| detail\.handled\) return;\s*detail\.handled = true;/, 'both mounted bars would apply');
  assert.match(bar, /if \(asksForPro\) \{\s*setSheetOpen\(true\);/, 'the Ready screen’s Apply skips the Pro sheet');
  const { pressMakerApply, MAKER_PRESS_APPLY_EVENT } = await import('../app/dashboard/[eventId]/website/_components/maker-press-apply');
  const g = globalThis as unknown as { window?: EventTarget };
  const had = g.window;
  g.window = new EventTarget();
  try {
    assert.equal(pressMakerApply(), null, 'no bar answered, and yet an outcome came back');
    let applied = 0;
    const bar1 = (e: Event) => {
      const d = (e as CustomEvent<{ handled: boolean; outcome: string | null }>).detail;
      if (!d || d.handled) return;
      d.handled = true;
      applied += 1;
      d.outcome = 'applying';
    };
    const bar2 = bar1;
    g.window.addEventListener(MAKER_PRESS_APPLY_EVENT, bar1);
    g.window.addEventListener(MAKER_PRESS_APPLY_EVENT, (e) => bar2(e));
    assert.equal(pressMakerApply(), 'applying');
    assert.equal(applied, 1, 'one press applied twice');
  } finally {
    g.window = had;
  }
});

/* ── (7) plain words ───────────────────────────────────────────────────── */

test('(7) no wedding word, and no "stage" or "scene" in a step’s own words', () => {
  const words = [
    ...GUIDED_STEPS.flatMap((s) => [
      typeof s.title === 'string' ? s.title : s.title('X'),
      s.shows({ solemn: false, parentsOffered: true }),
      s.shows({ solemn: true, parentsOffered: false }),
    ]),
    ...Object.values(GUIDED_ROUNDS).flatMap((r) => [r.title, r.ready]),
    ...Object.values(WAKE_ROUNDS).flatMap((r) => [r.title, r.ready]),
  ];
  assert.ok(words.length > 50, 'anti-vacuity: the step words were not read');
  for (const w of words) {
    assert.doesNotMatch(w, /\b(wedding|couple|bride|groom)\b/i, w);
    assert.doesNotMatch(w, /\b(stage|stages|scene|scenes)\b/i, w);
  }
  // A solemn event is never promised a countdown.
  assert.doesNotMatch(GUIDED_STEPS.find((s) => s.key === 'date')!.shows({ solemn: true, parentsOffered: false }), /countdown/);
  for (const f of [`${L}/details-guide.tsx`, `${L}/details-guide-top.tsx`, `${L}/stage-picker.tsx`, 'lib/details-guided-flow.ts', 'lib/stage-setup.ts']) {
    assert.doesNotMatch(read(f), /\b(wedding|couple|bride|groom)\b/i, `${f} types a wedding word`);
  }
  // …and the flow's pieces never pop up over the page (the Maker's in-flow rule).
  for (const f of [`${L}/details-guide.tsx`, `${L}/details-guide-top.tsx`, `${L}/stage-picker.tsx`]) {
    assert.doesNotMatch(read(f), /role=["']dialog["']|aria-modal|\bfixed inset-0\b/, `${f} pops up over the page`);
  }
});

// 🕯 OWNER 2026-09-29, "OWNER ANSWERS — TEN OPEN QUESTIONS" (6): nobody sends a
// wake a "Save the Date". Since PR-2 (owner 2026-10-04) the rounds are the
// STAGES, named in the one vocabulary the Maker's Page ▾ uses for every type
// (`the-look-moves-into-details.test.ts` (6)); what a wake's Ready screen
// promises stays the wake's own.
test('(8) the stages wear the one stage vocabulary; a wake’s Ready lines are its own', () => {
  const stages = ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial'] as const;
  assert.deepEqual(stages.map((r) => guidedRoundsFor({ solemn: false })[r].title), ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  assert.deepEqual(stages.map((r) => guidedRoundsFor({ solemn: true })[r].title), ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event'], 'a wake’s stages are named differently from Page ▾');
  const wake = buildGuidedPlan(items(WEDDING_ITEMS, () => undefined), { ...WORDS, solemn: true });
  assert.equal(wake.roundWords.save_the_date.ready, 'Your news is ready to share');
  assert.equal(wake.roundWords.rsvp.ready, 'Your service details are ready to share');
  assert.doesNotMatch(Object.values(wake.roundWords).map((r) => r.ready).join(' '), /Save the Date|invitations/i, 'a wake is asked to send a Save the Date');
  for (const f of ['details-guide.tsx', 'details-guide-top.tsx', 'stage-picker.tsx']) {
    const src = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'launch', '_components', f), 'utf8');
    assert.doesNotMatch(src, /GUIDED_ROUNDS\[/, `${f} names a stage from the fixed list instead of the plan's own words`);
  }
});
