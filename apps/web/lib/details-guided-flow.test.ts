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
import {
  GUIDED_ROUNDS,
  GUIDED_STEPS,
  SEAT_PLAN_STEP_ITEMS,
  backScreen,
  buildGuidedPlan,
  firstOpenScreen,
  guideParamOf,
  guidedItemDone,
  guidedScreens,
  homeProgress,
  isUnfinished,
  nextScreen,
  parseGuideParam,
  progressLabel,
  skipScreen,
  stepStateOf,
  wordsAndPlansInputFrom,
  type GuidedItem,
  type GuidedDoneFacts,
} from './details-guided-flow';
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

/* ── (1) the order ──────────────────────────────────────────────────────── */

test('(1) three rounds in the approved order, each ending in its Ready screen', () => {
  const plan = fresh();
  assert.deepEqual(
    plan.steps.map((s) => `${s.round}:${s.key}`),
    [
      '1:names', '1:date', '1:venues', '1:theme', '1:colours', '1:logo', '1:hero',
      '2:parents', '2:march', '2:schedule', '2:rsvp', '2:words', '2:love-story', '2:prints',
      '3:day-prints',
    ],
    'the sequence is not the approved one',
  );
  const screens = guidedScreens(plan).map((s) => (s.kind === 'step' ? s.step : `ready-${s.round}`));
  assert.equal(screens.indexOf('ready-1'), 7, 'Round 1 does not end in its Ready screen');
  assert.equal(screens.indexOf('ready-2'), 15);
  assert.equal(screens.at(-1), 'ready-3');
  // Each step shows the SAME item Details draws — Colours is the Mood Board, First screen the hero.
  const by = Object.fromEntries(plan.steps.map((s) => [s.key, s.items]));
  assert.deepEqual(by.colours, ['mood-board']);
  assert.deepEqual(by.hero, ['hero']);
  assert.deepEqual(by.words, ['opening-line', 'kindly-reply', 'special-message']);
  assert.deepEqual(by.prints, ['download']);
  // The march's name is its item's (the event type writes it) — never typed here.
  assert.equal(plan.steps.find((s) => s.key === 'march')!.title, 'Wedding March');
  assert.equal(progressLabel(plan, { kind: 'step', step: 'venues' }), 'Round 1 · 3 of 7');
  assert.equal(progressLabel(plan, { kind: 'ready', round: 2 }), 'Round 2 · Apply', 'a Ready screen with steps left says "done"');
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
  assert.equal(plan.steps.find((s) => s.key === 'names')!.state, 'left');
  const words = plan.steps.find((s) => s.key === 'words')!;
  assert.deepEqual(words.left, ['opening-line', 'kindly-reply', 'special-message'], 'the step does not open on what is still left');
});

test('(2) a step whose item this event lacks is not in the plan — a birthday, and the Seat plan until its item exists', () => {
  const birthday = buildGuidedPlan(
    items(WEDDING_ITEMS.filter((k) => k !== 'names' && k !== 'march' && k !== 'love-story'), () => false),
    { solemn: false, parentsOffered: false },
  );
  const keys = birthday.steps.map((s) => s.key);
  for (const k of ['names', 'march', 'love-story'] as const) assert.ok(!keys.includes(k), `a birthday is asked for ${k}`);
  assert.equal(birthday.steps.find((s) => s.key === 'parents')!.shows, 'Hosts are who guests reply to.', 'a birthday is told about parents');
  assert.ok(!fresh().steps.some((s) => s.key === 'seat-plan'), 'the Seat plan step shows before its item exists');
  const withSeat = buildGuidedPlan(
    [...items(WEDDING_ITEMS, () => false), { key: SEAT_PLAN_STEP_ITEMS[0] as DetailsItemKey, label: 'Seat plan', done: false }],
    WORDS,
  );
  assert.deepEqual(
    withSeat.steps.filter((s) => s.round === 3).map((s) => s.key),
    ['seat-plan', 'day-prints'],
    'Round 3 is not Seat plan, then Day-of prints',
  );
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
  // done = the door is open), the pages that decide before Details draws — the
  // Maker opening on the flow, Home's "Round N · x of y" — must read it too, or
  // they would count Round 3 differently from the step list.
  const early = read(`${L}/details-guided-progress.ts`) + read('lib/details-guided-flow.ts').slice(read('lib/details-guided-flow.ts').indexOf('export function guidedItemDone'));
  for (const k of SEAT_PLAN_STEP_ITEMS.filter((k) => (DETAILS_ITEM_KEYS as readonly string[]).includes(k))) {
    assert.ok(
      new RegExp(`'${k}'`).test(early),
      `the Seat plan item "${k}" is in Details but Home and the Maker's opening never read it — add it to guidedPresent and guidedItemDone`,
    );
  }
});

/* ── (3) Next · Skip · Back ─────────────────────────────────────────────── */

test('(3) Next goes to the next UNFINISHED step, never over a look-over, then the Ready screen', () => {
  // Round 1: names, date and theme done; venues, colours, logo, hero left.
  const done = new Set<DetailsItemKey>(['names', 'date', 'theme', 'parents', 'march', 'schedule']);
  const plan = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? done.has(k) : undefined)), WORDS);
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'names' }), { kind: 'step', step: 'venues' }, 'Next did not skip the done date');
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'venues' }), { kind: 'step', step: 'colours' }, 'Next did not skip the done theme');
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'hero' }), { kind: 'ready', round: 1 }, 'the round does not end on its Ready');
  // From Round 1's Ready: parents, march and schedule are done → RSVP, a look-over, is where Next stops.
  assert.deepEqual(nextScreen(plan, { kind: 'ready', round: 1 }), { kind: 'step', step: 'rsvp' }, 'Next skipped a look-over');
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'love-story' }), { kind: 'step', step: 'prints' });
  assert.equal(nextScreen(plan, { kind: 'ready', round: 3 }), null, 'there is a screen after the last Ready');
  // A done step still opens when picked; its Next moves on as usual.
  assert.deepEqual(nextScreen(plan, { kind: 'step', step: 'date' }), { kind: 'step', step: 'venues' });
});

test('(3) Skip goes to the very next screen and marks nothing; Back to the one before', () => {
  const done = new Set<DetailsItemKey>(['date']);
  const plan = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? done.has(k) : undefined)), WORDS);
  assert.deepEqual(skipScreen(plan, { kind: 'step', step: 'names' }), { kind: 'step', step: 'date' }, 'Skip jumped over a step');
  assert.equal(plan.steps.find((s) => s.key === 'names')!.state, 'left', 'Skip changed a step');
  assert.deepEqual(skipScreen(plan, { kind: 'step', step: 'hero' }), { kind: 'ready', round: 1 });
  assert.equal(backScreen(plan, { kind: 'step', step: 'names' }), null, 'the first screen has a Back');
  assert.deepEqual(backScreen(plan, { kind: 'step', step: 'parents' }), { kind: 'ready', round: 1 });
});

/* ── (4) where it opens, Home, the address ─────────────────────────────── */

test('(4) unfinished = a step still left that is not optional; the flow opens on the first', () => {
  const plan = fresh();
  assert.equal(isUnfinished(plan), true);
  assert.deepEqual(firstOpenScreen(plan), { kind: 'step', step: 'names' });
  // Everything filled but the (optional) Love Story → finished; it opens on the last Ready when asked.
  const almost = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? k !== 'love-story' : undefined)), WORDS);
  assert.equal(isUnfinished(almost), false, 'an optional step holds the event open');
  assert.deepEqual(firstOpenScreen(almost), { kind: 'step', step: 'love-story' });
  const all = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? true : undefined)), WORDS);
  assert.deepEqual(firstOpenScreen(all), { kind: 'ready', round: 3 });
});

test('(4) Home says "Round N · x of y" for the first round with a step still left', () => {
  const done = new Set<DetailsItemKey>(['names', 'date', 'venues', 'theme', 'mood-board', 'logo', 'hero', 'parents']);
  const plan = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? done.has(k) : undefined)), WORDS);
  // Round 1 all done → Round 2: parents done, rsvp + prints are look-overs, love story optional-left.
  assert.deepEqual(homeProgress(plan), { round: 2, title: 'Invitations', done: 3, total: 7, next: 'march' });
  const r1 = homeProgress(fresh());
  assert.deepEqual(r1, { round: 1, title: 'Save the Date', done: 0, total: 7, next: 'names' });
  const all = buildGuidedPlan(items(WEDDING_ITEMS, (k) => (DONE_BY_DATA.has(k) ? true : undefined)), WORDS);
  assert.equal(homeProgress(all), null, 'Home still says something is left');
});

test('(4) the address: ?guide=1 and ?guide=ready-N, and nothing else', () => {
  assert.deepEqual(parseGuideParam('1'), { ready: null });
  assert.deepEqual(parseGuideParam('ready-2'), { ready: 2 });
  for (const bad of [undefined, null, '', '0', 'ready-4', 'ready-', 'yes', '1 ']) assert.equal(parseGuideParam(bad), null, String(bad));
  assert.equal(guideParamOf({ kind: 'step', step: 'venues' }), '1');
  assert.deepEqual(parseGuideParam(guideParamOf({ kind: 'ready', round: 3 })), { ready: 3 });
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
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const navItems = ['names', 'date', 'theme', 'address'].map((k) => ({ key: k, group: 'g', label: k, icon: null, done: k === 'date' }));
  const plan = buildGuidedPlan(navItems as GuidedItem[], WORDS);
  return renderToStaticMarkup(
    React.createElement(DetailsWorkspace, {
      groups: [{ key: 'g', label: 'G', items: navItems }],
      bodies: { names: 'NAMES-BODY', date: 'DATE-BODY', theme: 'THEME-BODY', address: 'ADDRESS-BODY' },
      editors: {
        names: React.createElement('i', { 'data-stub-editor': 'names' }),
        date: React.createElement('i', { 'data-stub-editor': 'date' }),
        theme: React.createElement('i', { 'data-stub-editor': 'theme' }),
        address: React.createElement('i', { 'data-stub-editor': 'address' }),
      },
      initial,
      guide: { plan, open: true, ready: null, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' }, ...guide },
    }),
  );
}

test('(6) a step is its item, one at a time: the heading, the narrowed navigator, Back · Skip · Next', async () => {
  const html = await paint({}, 'names');
  assert.match(html, /data-details-mode="guided"/);
  assert.match(html, /data-details-guide-top=""/, 'no progress line');
  assert.match(html, /data-details-guide-head="names"/, 'no step heading');
  assert.match(html, /Shows on your page, your invitation, every print and every pass\./);
  assert.match(html, /NAMES-BODY/, 'the step does not show its item’s own picture');
  assert.match(html, /data-details-guide-next=""/);
  assert.match(html, /data-details-guide-skip=""/);
  // One item, no pieces → the navigator steps aside; every editor is still mounted.
  assert.doesNotMatch(html, /aria-label="Details — what to edit"/, 'the whole navigator shows in the flow');
  for (const k of ['names', 'date', 'theme', 'address']) assert.match(html, new RegExp(`data-stub-editor="${k}"`), `${k}’s editor was unmounted`);
  // An item no step shows opens in All items, with the way back in.
  const all = await paint({}, 'address');
  assert.match(all, /data-details-mode="all"/);
  assert.match(all, /data-details-guide-open=""/, 'All items has no way back into What’s left');
});

test('(6) a Ready screen hides the items — never unmounts them — and offers Apply', async () => {
  const html = await paint({ ready: 1 }, 'names');
  assert.match(html, /data-details-guide-ready="1"/);
  assert.match(html, /data-details-row="" hidden=""/, 'the items are not hidden on the Ready screen');
  for (const k of ['names', 'date', 'theme', 'address']) assert.match(html, new RegExp(`data-stub-editor="${k}"`), `${k}’s editor was unmounted on Ready`);
  assert.match(html, /data-details-guide-apply="1"/);
  assert.match(html, /data-details-guide-ready-step="names"[^>]*data-state="left"/, 'the Ready list does not say what is left');
  assert.match(html, /Almost ready/, 'a round with a step left claims it is ready');
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

test('(7) no wedding word, and no "stage" or "scene", on the guided path', () => {
  const words = [
    ...GUIDED_STEPS.flatMap((s) => [
      typeof s.title === 'string' ? s.title : s.title('X'),
      s.shows({ solemn: false, parentsOffered: true }),
      s.shows({ solemn: true, parentsOffered: false }),
    ]),
    ...Object.values(GUIDED_ROUNDS).flatMap((r) => [r.title, r.ready]),
  ];
  assert.ok(words.length > 40, 'anti-vacuity: the step words were not read');
  for (const w of words) {
    assert.doesNotMatch(w, /\b(wedding|couple|bride|groom)\b/i, w);
    assert.doesNotMatch(w, /\b(stage|stages|scene|scenes)\b/i, w);
  }
  // A solemn event is never promised a countdown.
  assert.doesNotMatch(GUIDED_STEPS.find((s) => s.key === 'date')!.shows({ solemn: true, parentsOffered: false }), /countdown/);
  for (const f of [`${L}/details-guide.tsx`, 'lib/details-guided-flow.ts']) {
    assert.doesNotMatch(read(f), /\b(wedding|couple|bride|groom)\b/i, `${f} types a wedding word`);
  }
  // …and the flow's pieces never pop up over the page (the Maker's in-flow rule).
  const guide = read(`${L}/details-guide.tsx`);
  assert.doesNotMatch(guide, /role=["']dialog["']|aria-modal|\bfixed inset-0\b/);
});
