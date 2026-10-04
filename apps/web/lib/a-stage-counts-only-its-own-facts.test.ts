/**
 * a-stage-counts-only-its-own-facts.test.ts — "FINISH YOUR EVENT HUB", BY STAGE
 * (PR-2; owner 2026-10-04, DECISION_LOG "YES TO ALL" — study
 * `EVENT_DETAILS_STUDY_2026-10-04_fable.md` § 3 and § 7 PR-2).
 *
 * Held here:
 *   (1) each stage's parts are DERIVED from the shipped tables — its hideable
 *       parts are `STAGE_SCENES[stage]`, the fixed ones are where the page places
 *       them, the RSVP stage is its three settings (real `RSVP_PIECES` keys), and
 *       Post Event has none (it fills itself from the day);
 *   (2) 🔑 EACH STAGE'S COUNT EQUALS THE FACTS ITS PARTS DRAW — counted here
 *       independently of `stageProgress`, on a full wedding plan, and drawn on
 *       the picker exactly so;
 *   (3) 🔑 A SHARED FACT IS ASKED ONCE — one step, listed under every stage
 *       that shows it and counted for each, once for the whole; filled in one
 *       stage, the other stage's walk never stops on it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STAGE_FIXED, STAGE_SCENES } from './stage-scenes';
import { WIDGET_TYPES } from './invitation-widgets';
import { FREE_PRINT_KEYS, RSVP_PIECES, type DetailsItemKey } from './maker-details-items';
import {
  RSVP_SETTING_PARTS,
  SETUP_STAGES,
  STEP_PARTS,
  rsvpSettingPiece,
  setupProgress,
  stageFacts,
  stageParts,
  stageProgress,
  stagesOfStep,
  type SetupStage,
  type StagePart,
} from './stage-setup';
import { buildGuidedPlan, nextScreen, stageSteps, type GuidedItem, type GuidedScreen } from './details-guided-flow';
import { hubSetupRound, type HubSetupFacts } from './hub-setup-steps';

(globalThis as unknown as { React: unknown }).React = React;

const WEDDING_ITEMS: DetailsItemKey[] = [
  'theme', 'mood-board', 'logo', 'hero', 'reveal',
  'names', 'date', 'venues', 'parents', 'march', 'papic', 'gifts', 'seating',
  'special-message', 'thank-you', 'opening-line', 'kindly-reply',
  'love-story', 'schedule', 'rsvp',
  'address', 'qr', 'invitation', 'entourage', 'details', 'menu', 'pass', 'poster', 'card',
  ...FREE_PRINT_KEYS,
  'download',
];
const HAS_DONE = new Set<DetailsItemKey>(['theme', 'mood-board', 'logo', 'hero', 'names', 'date', 'venues', 'parents', 'march', 'special-message', 'love-story', 'schedule', 'seating']);
const items = (done: (k: DetailsItemKey) => boolean): GuidedItem[] =>
  WEDDING_ITEMS.map((k) => ({ key: k, label: k, done: HAS_DONE.has(k) ? done(k) : undefined }));
const WORDS = { solemn: false, parentsOffered: true };
const SETUP: HubSetupFacts = {
  guestList: true,
  arrival: false,
  venuesLocked: { ceremony: false, reception: false },
  venuesNamed: { ceremony: false, reception: false },
  loveStoryMoments: 0,
  wear: false,
  replyBy: false,
  guests: 0,
};
const ALL = new Set<string>(WEDDING_ITEMS);
/** A wedding straight out of onboarding: names, date, the look and the cover in. */
const AFTER_A = new Set<DetailsItemKey>(['theme', 'mood-board', 'hero', 'names', 'date']);
const weddingPlan = (done: (k: DetailsItemKey) => boolean = (k) => AFTER_A.has(k), facts: HubSetupFacts = SETUP) =>
  buildGuidedPlan(items(done), WORDS, hubSetupRound(facts, ALL));

/* ── (1) the parts, derived ─────────────────────────────────────────────── */

test('(1) a stage draws the top part, ITS scenes (STAGE_SCENES) and its fixed parts — the RSVP stage its three settings, Post Event nothing', () => {
  assert.deepEqual(SETUP_STAGES, ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial'], 'not the five stages of Page ▾, in its order');
  for (const s of ['save_the_date', 'rsvp', 'event'] as const) {
    const parts = stageParts(s);
    assert.equal(parts[0], 'hero', `${s}: the top part is not first`);
    // After the top part (the always-on `hero` row itself), the hideable parts — exactly the table's —
    // then only the fixed parts the page places itself.
    const n = STAGE_SCENES[s].length;
    assert.deepEqual(parts.slice(1, 1 + n), [...STAGE_SCENES[s]], `${s}: its scenes are not STAGE_SCENES' — a second list`);
    for (const p of parts.slice(1 + n)) assert.ok(['entourage', 'greeting', 'find_your_seat'].includes(p), `${s}: "${p}" is no fixed part`);
    assert.ok(parts.every((p) => (WIDGET_TYPES as readonly string[]).includes(p) || p === 'entourage' || p === 'find_your_seat'), `${s}: a part the page does not know`);
    assert.equal(parts.includes('entourage'), STAGE_FIXED.entourage.includes(s), `${s}: the entourage is not where the page places it`);
  }
  assert.ok(stageParts('event').includes('find_your_seat') && !stageParts('rsvp').includes('find_your_seat'), 'Find your seat is not The Day’s');
  assert.deepEqual(stageParts('rsvp-stage'), [...RSVP_SETTING_PARTS]);
  for (const p of RSVP_SETTING_PARTS) {
    assert.ok(RSVP_PIECES.some((x) => x.key === rsvpSettingPiece(p)), `${p} is not a section MakerRsvpSettings draws`);
  }
  assert.deepEqual(stageParts('editorial'), [], 'Post Event is walked — it fills itself from the day');
});

test('(1) every part a fact names is one some stage really draws — a typo can never hide a fact', () => {
  const drawn = new Set<StagePart>(SETUP_STAGES.flatMap((s) => stageParts(s)));
  for (const [key, parts] of Object.entries(STEP_PARTS)) {
    for (const p of parts) assert.ok(drawn.has(p), `${key} names "${p}", which no stage draws`);
  }
});

/* ── (2) the count IS the facts its parts draw ──────────────────────────── */

test('🔑 (2) each stage’s count equals the facts its parts draw — counted here from the parts, not from the plan’s own filter', () => {
  const plan = weddingPlan();
  const facts = [...plan.steps, ...plan.links];
  assert.ok(facts.length >= 18, `anti-vacuity: the wedding plan has only ${facts.length} facts`);
  let checked = 0;
  for (const s of SETUP_STAGES) {
    const parts = stageParts(s);
    // Independently: every fact of the plan whose own parts meet this stage's.
    const drawn = facts.filter((f) => STEP_PARTS[f.key].some((p) => parts.includes(p))).map((f) => f.key);
    assert.deepEqual(stageFacts(plan, s).map((f) => f.key).sort(), [...drawn].sort(), `${s}: counts a fact its parts do not draw, or misses one they do`);
    assert.equal(stageProgress(plan, s).total, drawn.length, `${s}: its "of m" is not the facts it shows`);
    assert.equal(
      stageProgress(plan, s).done,
      facts.filter((f) => drawn.includes(f.key) && f.state !== 'left').length,
      `${s}: its "n" is not the facts in place`,
    );
    checked += drawn.length;
  }
  assert.ok(checked > facts.length, 'anti-vacuity: no fact was shared between stages');
  assert.equal(stageProgress(plan, 'editorial').total, 0, 'Post Event counts a step');
  assert.deepEqual(
    stageSteps(plan, 'save_the_date').map((s) => s.key),
    ['names', 'date', 'theme', 'logo', 'hero', 'love-story'],
    'the Save the Date asks what it does not show (or misses its cover, logo, names)',
  );
});

test('🔑 (2) the picker draws each stage’s own "n of m" — the same numbers, Post Event a dash', async () => {
  const { StagePicker } = await import('../app/dashboard/[eventId]/launch/_components/stage-picker');
  const plan = weddingPlan();
  const html = renderToStaticMarkup(React.createElement(StagePicker, { plan, onPick: () => {} }));
  for (const s of SETUP_STAGES.filter((x) => x !== 'editorial')) {
    const p = stageProgress(plan, s);
    assert.match(html, new RegExp(`data-stage-row="${s}"[^>]*data-stage-count="${p.done}/${p.total}"`), `${s}: the picker shows another count`);
  }
  assert.match(html, /data-stage-row="editorial"[^>]*data-stage-count=""/);
  const whole = setupProgress(plan);
  assert.match(html, new RegExp(`data-stage-picker-whole="">${whole.done} of ${whole.total} in place`));
});

/* ── (3) a shared fact is asked once ────────────────────────────────────── */

/** Every step a stage's walk stops on, from its Before we start to its Ready screen. */
function walk(plan: ReturnType<typeof weddingPlan>, round: SetupStage): string[] {
  const seen: string[] = [];
  let at: GuidedScreen | null = { kind: 'before', round };
  for (let i = 0; i < 40 && at && at.kind !== 'ready'; i++) {
    at = nextScreen(plan, at);
    if (at?.kind === 'step') seen.push(at.step);
  }
  return seen;
}

test('🔑 (3) a fact two stages share is ONE step: listed under each, counted for each, once for the whole', () => {
  const plan = weddingPlan(() => false);
  for (const key of ['names', 'date', 'theme', 'venues', 'schedule'] as const) {
    const id = key === 'schedule' ? 'arrive' : key;
    assert.equal(plan.steps.filter((s) => s.key === id).length, 1, `${id} is two steps`);
    const stages = plan.steps.find((s) => s.key === id)!.stages;
    assert.ok(stages.length >= 2, `${id} is shown on one stage only — anti-vacuity`);
    assert.deepEqual(stages, stagesOfStep(id), `${id}: its stages are not the ones whose parts draw it`);
    for (const s of stages) assert.ok(stageFacts(plan, s).some((f) => f.key === id), `${id} is not counted on ${s}`);
  }
  const sumOfStages = SETUP_STAGES.reduce((n, s) => n + stageProgress(plan, s).total, 0);
  assert.ok(sumOfStages > setupProgress(plan).total, 'the whole counts a shared fact once per stage');
  assert.equal(setupProgress(plan).total, plan.steps.length + plan.links.length);
});

test('🔑 (3) filled in one stage, a shared fact is never asked again in another', () => {
  // Nothing filled: both walks stop on the names and the date.
  const none = weddingPlan(() => false);
  for (const s of ['save_the_date', 'rsvp', 'event'] as const) {
    assert.ok(walk(none, s).includes('names') && walk(none, s).includes('date'), `${s}: an unfilled shared fact is not asked`);
  }
  // The Save the Date filled the names and the date (the one record): the Invitation and The Day pass them.
  const after = weddingPlan((k) => k === 'names' || k === 'date');
  for (const s of ['rsvp', 'event'] as const) {
    const stops = walk(after, s);
    assert.ok(stops.length > 0, `anti-vacuity: ${s} walked nothing`);
    for (const shared of ['names', 'date']) assert.ok(!stops.includes(shared), `${s} asks "${shared}" again after the Save the Date filled it`);
  }
  // …and both stages count it as in place.
  assert.equal(
    stageFacts(after, 'rsvp').find((f) => f.key === 'names')?.state,
    stageFacts(after, 'save_the_date').find((f) => f.key === 'names')?.state,
  );
});
