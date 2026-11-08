/**
 * WHICH SERVICES STAY ON — the pure rules (owner 2026-11-06, DECISION_LOG: SERVICES LIFE CYCLE · A DOWNGRADE PUTS
 * EXTRA SERVICES ON HOLD · THE AFTER-FIRST-BOOKING CHOICE IS A PLAN PICKER WITH SWAP). Every number read from
 * `TIER_CAPS`, never typed here, so a re-priced plan cannot leave this test asserting the old one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PLAN_LADDER,
  capsOf,
  defaultKeep,
  keptFits,
  ladderFor,
  overThePlan,
  pickModeFor,
  planThatHoldsAll,
  stayOnNeed,
  toggleKeep,
  HOLD_WORDS,
  type PlanCard,
  type StayOnFacts,
} from './service-plan-hold';
import { TIER_CAPS, type VendorTier } from './vendor-tier-caps';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));

const card = (id: string, kind: string, families: string[], over: Partial<PlanCard> = {}): PlanCard => ({
  id,
  name: id,
  kind,
  families,
  live: true,
  hold: null,
  holdStartsOn: null,
  ...over,
});
// Two band cards (one kind, one family) and a lights card (another family).
const BAND_A = card('band-a', 'live_band', ['music']);
const BAND_B = card('band-b', 'live_band', ['music']);
const LIGHTS = card('lights', 'lights_and_sound', ['production']);
const THREE = [BAND_A, BAND_B, LIGHTS];

const facts = (
  tier: VendorTier,
  cards: PlanCard[],
  firstBooking: 'done' | 'not_yet' | 'unreadable',
  pending: VendorTier | null = null,
): StayOnFacts => ({ status: 'ok', shop: { tier, pending, founder: false }, cards, firstBooking });

test('the fit is the create gate: cards per kind ≤ servicesPerLeaf, families ≤ parentCategories — read from TIER_CAPS', () => {
  const free = capsOf('free');
  assert.equal(free.parentCategories, TIER_CAPS.free.parentCategories);
  assert.equal(free.servicesPerLeaf, TIER_CAPS.free.servicesPerLeaf);
  assert.deepEqual(keptFits([BAND_A], free), { ok: true });
  assert.equal(keptFits([BAND_A, BAND_B], free).ok, TIER_CAPS.free.servicesPerLeaf >= 2);
  assert.equal(keptFits([BAND_A, LIGHTS], free).ok, TIER_CAPS.free.parentCategories >= 2);
  // An exempt kind (no family) never counts toward families.
  const exempt = card('exempt', 'host', []);
  assert.equal(keptFits([BAND_A, exempt], capsOf('free')).ok, TIER_CAPS.free.servicesPerLeaf >= 1);
  // A founder shop is never capped.
  assert.deepEqual(keptFits(THREE, capsOf('free', true)), { ok: true });
});

test('the plan that holds them all is the lowest plan on the ladder whose caps fit every card', () => {
  const p = planThatHoldsAll(THREE);
  assert.ok(p, 'some plan must hold three cards');
  assert.ok(keptFits(THREE, capsOf(p!)).ok);
  for (const lower of PLAN_LADDER.slice(0, PLAN_LADDER.indexOf(p!))) assert.equal(keptFits(THREE, capsOf(lower)).ok, false, lower);
});

test('the ladder starts at the plan the shop lands on, and offers Free without its twin Verified', () => {
  assert.deepEqual(ladderFor('free', null), PLAN_LADDER.filter((t) => t !== 'verified'));
  assert.equal(ladderFor('verified', null)[0], 'verified');
  // A Pro shop with Solo scheduled is offered Solo and up — never Free.
  assert.deepEqual(ladderFor('pro', 'solo'), PLAN_LADDER.slice(PLAN_LADDER.indexOf('solo')));
  assert.equal(pickModeFor('solo', 'pro', 'solo'), 'at_plan_change');
  assert.equal(pickModeFor('pro', 'pro', 'solo'), 'now');
  assert.equal(pickModeFor('enterprise', 'pro', 'solo'), 'upgrade');
  assert.equal(pickModeFor('free', 'pro', 'solo'), null, 'a plan the shop is not moving to is never a pick');
});

test('tapping a service swaps it on a one-service plan; on a bigger plan an over-the-plan tap is refused with why', () => {
  const free = capsOf('free');
  const kept = defaultKeep(THREE, free);
  assert.deepEqual(kept, ['band-a'], 'Free keeps the first that fits');
  // The ruling's "tapping a service swaps it".
  assert.deepEqual(toggleKeep(kept, 'lights', THREE, free, 'free'), { keep: ['lights'], refused: null });
  // Off is always allowed.
  assert.deepEqual(toggleKeep(['band-a'], 'band-a', THREE, free, 'free'), { keep: [], refused: null });
  // A plan of 2 kinds' worth that is full refuses, never silently drops one the supplier picked.
  const tight = { parentCategories: 1, servicesPerLeaf: 2 };
  const t = toggleKeep(['band-a', 'band-b'], 'lights', THREE, tight, 'solo');
  assert.deepEqual(t.keep, ['band-a', 'band-b']);
  assert.match(t.refused ?? '', /Turn one off first\./);
});

test('before the first booking a Free shop keeps everything and is told so; after it, it must choose', () => {
  if (keptFits(THREE, capsOf('free')).ok) return; // a Free plan that holds three has nothing to choose
  assert.deepEqual(stayOnNeed(facts('free', THREE, 'not_yet')), { show: false, line: HOLD_WORDS.beforeFirstBooking });
  assert.deepEqual(stayOnNeed(facts('free', THREE, 'done')), { show: true, reason: 'first_booking', startPlan: 'free' });
  // The first-booking fact could not be read → no claim either way.
  assert.deepEqual(stayOnNeed(facts('free', THREE, 'unreadable')), { show: false, line: null });
  assert.deepEqual(stayOnNeed({ status: 'unreadable' }), { show: false, line: null });
});

test('a lower plan scheduled that holds fewer than are on → the shop picks at the downgrade', () => {
  const sevenBands = Array.from({ length: TIER_CAPS.solo.servicesPerLeaf + 1 }, (_, i) => card(`b${i}`, 'live_band', ['music']));
  assert.ok(overThePlan(sevenBands, capsOf('solo')));
  assert.equal(overThePlan(sevenBands, capsOf('pro')), false);
  assert.deepEqual(stayOnNeed(facts('pro', sevenBands, 'done', 'solo')), { show: true, reason: 'downgrade', startPlan: 'solo' });
  // A held card always shows the screen, to swap or bring back.
  const withHeld = [BAND_A, card('h', 'live_band', ['music'], { live: false, hold: 'held' })];
  assert.equal(stayOnNeed(facts('free', withHeld, 'done')).show, true);
});

test('the server reads families with parentsOfKind and the action re-checks keptFits before it writes', () => {
  const server = code('lib/service-plan-hold.server.ts');
  assert.match(server, /parentsOfKind\(/, 'families must be counted the way the create gate counts them');
  const action = code('app/vendor-dashboard/services/stay-on-actions.ts');
  assert.match(action, /keptFits\(/, 'the action must refuse a pick the plan cannot hold');
  assert.match(action, /rpc\('apply_service_plan_pick'/);
  // No plan number is typed into the picker or the action — they come from TIER_CAPS through capsOf.
  for (const f of ['app/vendor-dashboard/services/stay-on-actions.ts', 'app/vendor-dashboard/services/_components/stay-on-picker.tsx']) {
    assert.doesNotMatch(code(f), /parentCategories:\s*\d|servicesPerLeaf:\s*\d/, f);
  }
});
