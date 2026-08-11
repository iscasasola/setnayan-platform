/**
 * Tests for the onboarding Papic picker's pure math.
 *
 * The fixtures below are SHAPES, not the live ladder: the point of the module is
 * that it works off whatever the catalog resolves to, so pinning it to today's
 * prices would make this suite fail the next time the owner reprices — exactly
 * the coupling papic-copy-guardrails exists to stop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { PapicTypeView } from '@/lib/onboarding/services-step-data';
import {
  EMPTY_SERVICES_SELECTION,
  parseServicesStepSelection,
  poolPriceAt,
  poolRungAt,
  poolShotsAt,
  poolStepCount,
  poolStepOf,
  quoteServicesStepSelection,
  selectionHasPurchase,
  setAi,
  stepPool,
} from './onboarding-services-selection';

const POOL: PapicTypeView = {
  id: 'pool',
  inappKey: 'papic_guest',
  freePoints: 50,
  freeCameras: null,
  rungs: [
    { key: 'P_A', points: 3_000, pricePhp: 1_000 },
    { key: 'P_B', points: 6_000, pricePhp: 2_000 },
    { key: 'P_C', points: 10_000, pricePhp: 3_000 },
  ],
};

const ONE: PapicTypeView = {
  id: 'one',
  inappKey: 'papic_seats',
  freePoints: 5,
  freeCameras: 1,
  rungs: [
    { key: 'O_A', points: 50, pricePhp: 50 },
    { key: 'O_B', points: 100, pricePhp: 100 },
  ],
};

const TYPES = [POOL, ONE];

// ── the pool ladder ────────────────────────────────────────────────────────

test('step 0 is the free floor: real shots, no charge', () => {
  assert.equal(poolStepOf(POOL, EMPTY_SERVICES_SELECTION), 0);
  assert.equal(poolRungAt(POOL, 0), null);
  assert.equal(poolShotsAt(POOL, 0), POOL.freePoints);
  assert.equal(poolPriceAt(POOL, 0), 0);
});

test('the free floor is ADDED to every paid step, never replaced by it', () => {
  for (let step = 1; step < poolStepCount(POOL); step += 1) {
    const rung = poolRungAt(POOL, step);
    assert.ok(rung, `step ${step} must land on a rung`);
    assert.equal(
      poolShotsAt(POOL, step),
      POOL.freePoints + rung!.points,
      'a paid step must include the free grant — it is armed at commit either way',
    );
  }
});

test('+ walks up the ladder and stops at the top; − walks back to free', () => {
  let s = EMPTY_SERVICES_SELECTION;
  const top = poolStepCount(POOL) - 1;
  for (let i = 0; i < top; i += 1) s = stepPool(POOL, s, +1);
  assert.equal(poolStepOf(POOL, s), top);

  // Pressing + at the ceiling is a no-op, not a wrap-around and not an
  // unpriceable step.
  s = stepPool(POOL, s, +1);
  assert.equal(poolStepOf(POOL, s), top);
  assert.equal(poolPriceAt(POOL, poolStepOf(POOL, s)), POOL.rungs[top - 1]!.pricePhp);

  for (let i = 0; i < top + 3; i += 1) s = stepPool(POOL, s, -1);
  assert.equal(poolStepOf(POOL, s), 0, '− bottoms out at the free floor');
  assert.equal(s.poolRungKey, null);
});

test('every reachable step names a rung the catalog priced', () => {
  let s = EMPTY_SERVICES_SELECTION;
  for (let i = 1; i < poolStepCount(POOL); i += 1) {
    s = stepPool(POOL, s, +1);
    assert.ok(
      POOL.rungs.some((r) => r.key === s.poolRungKey),
      'the picker must never land on a key that is not on the live ladder',
    );
  }
});

test('a ladder with no sellable rung still has its free floor', () => {
  const dead: PapicTypeView = { ...POOL, rungs: [] };
  assert.equal(poolStepCount(dead), 1);
  assert.equal(poolShotsAt(dead, 0), dead.freePoints);
  assert.equal(stepPool(dead, EMPTY_SERVICES_SELECTION, +1).poolRungKey, null);
});

test('a selection whose rung was deactivated falls back to FREE, not another rung', () => {
  // The dangerous alternative is resolving by index: rung 2 disappearing would
  // silently slide the couple onto a different — possibly dearer — rung.
  const stale = { ...EMPTY_SERVICES_SELECTION, poolRungKey: 'GONE' };
  assert.equal(poolStepOf(POOL, stale), 0);
  assert.equal(poolPriceAt(POOL, poolStepOf(POOL, stale)), 0);
});

test('the ladder is DATA — a nine-rung Pool needs no code change', () => {
  // Owner 2026-08-11 extended the Pool to 3k · 6k · 10k · 13k · 16k · 20k · 23k
  // · 26k · 30k. Nothing in this module knows how many rungs there are, and this
  // test exists to keep it that way: `poolStepCount` is derived, not a constant,
  // so lengthening the ladder is a migration and nothing else. Prices are left
  // as a linear placeholder here ON PURPOSE — pinning the real ones would make
  // this suite fail the next time the owner reprices, which is the coupling
  // papic-copy-guardrails exists to stop.
  const NINE: PapicTypeView = {
    ...POOL,
    rungs: [3_000, 6_000, 10_000, 13_000, 16_000, 20_000, 23_000, 26_000, 30_000].map(
      (points, i) => ({ key: `R${i}`, points, pricePhp: (i + 1) * 1_000 }),
    ),
  };

  assert.equal(poolStepCount(NINE), 10, 'the free floor plus nine rungs');

  // Walk the whole ladder with + and check every landing.
  let s = EMPTY_SERVICES_SELECTION;
  const seen: Array<{ shots: number; php: number }> = [];
  for (let i = 0; i < 12; i += 1) {
    s = stepPool(NINE, s, +1);
    const step = poolStepOf(NINE, s);
    seen.push({ shots: poolShotsAt(NINE, step), php: poolPriceAt(NINE, step) });
  }

  // It reaches the top and STOPS there — twelve presses on a nine-rung ladder
  // must not wrap, overflow, or land on a rung that is not on the list.
  assert.equal(poolStepOf(NINE, s), 9);
  assert.equal(poolShotsAt(NINE, 9), NINE.freePoints + 30_000);
  for (const { shots, php } of seen) {
    assert.ok(
      NINE.rungs.some((r) => r.points + NINE.freePoints === shots && r.pricePhp === php),
      `landed on ${shots} shots at ${php} — not a rung on the ladder`,
    );
  }

  // Every step is strictly bigger and strictly dearer than the one below it.
  // A ladder that ever goes DOWN as you press + is the kind of thing an ordering
  // mistake in a migration produces, and it would read as a bug in the button.
  for (let step = 2; step <= 9; step += 1) {
    assert.ok(
      poolShotsAt(NINE, step) > poolShotsAt(NINE, step - 1),
      `step ${step} offers no more shots than step ${step - 1}`,
    );
    assert.ok(
      poolPriceAt(NINE, step) > poolPriceAt(NINE, step - 1),
      `step ${step} costs no more than step ${step - 1}`,
    );
  }

  // And − walks all the way back to free without stranding them mid-ladder.
  for (let i = 0; i < 12; i += 1) s = stepPool(NINE, s, -1);
  assert.equal(poolStepOf(NINE, s), 0);
  assert.equal(poolPriceAt(NINE, 0), 0);
});

// ── papic one is GONE from this screen (owner 2026-08-11) ─────────────────
//
// Seven tests stood here for the camera stepper: its default, its per-camera
// billing, its cheapest-rung default, its bound, and the both-directions
// consistency between a rung key and a count. Every one described a control
// that no longer exists — cameras are free and unlimited, and a dedicated one
// is made in the studio out of shots the couple already owns.
//
// ONE assertion replaced them, in the parse section below: a tab opened before
// this change still POSTS the old fields, and what happens to that payload is
// the only camera behaviour this module still has an opinion about.

// ── the quote ──────────────────────────────────────────────────────────────

test('the running total is the shots plus the planner', () => {
  const sel = stepPool(POOL, EMPTY_SERVICES_SELECTION, 1);
  const q = quoteServicesStepSelection([POOL], sel);
  assert.equal(q.poolPhp, POOL.rungs[0]!.pricePhp);
  assert.equal(q.papicPhp, q.poolPhp, 'Papic is one product — its subtotal IS the shots line');
  assert.equal(q.totalPhp, q.poolPhp);
});

test('touching nothing costs nothing', () => {
  assert.equal(quoteServicesStepSelection(TYPES, EMPTY_SERVICES_SELECTION).totalPhp, 0);
  assert.equal(selectionHasPurchase(EMPTY_SERVICES_SELECTION), false);
});

test('either line alone counts as a purchase', () => {
  assert.equal(selectionHasPurchase(stepPool(POOL, EMPTY_SERVICES_SELECTION, +1)), true);
});

// ── the untrusted boundary ─────────────────────────────────────────────────

test('parse strips anything that is not one of the four fields', () => {
  assert.deepEqual(parseServicesStepSelection(null), EMPTY_SERVICES_SELECTION);
  assert.deepEqual(parseServicesStepSelection('P_A'), EMPTY_SERVICES_SELECTION);
  assert.deepEqual(parseServicesStepSelection(42), EMPTY_SERVICES_SELECTION);
  assert.deepEqual(parseServicesStepSelection({ poolRungKey: 'P_A', evil: 'x', totalPhp: 0 }), {
    poolRungKey: 'P_A',
    ai: false,
  });
});

test('a tab opened before the change buys nothing extra', () => {
  // ⚠ THE ONE CAMERA BEHAVIOUR THIS MODULE STILL HAS AN OPINION ABOUT. A browser
  // loaded before Papic became one product keeps posting `oneRungKey` and
  // `oneExtraCameras` — its JavaScript still knows those fields. Carrying them
  // through would mint a line for a retired product at a price nobody set.
  // Dropping them is exactly right: the couple's real pick, their shots, is
  // untouched.
  const stale = parseServicesStepSelection({
    poolRungKey: 'P_A',
    oneRungKey: 'O_A',
    oneExtraCameras: 3,
  });
  assert.deepEqual(stale, { poolRungKey: 'P_A', ai: false });
  assert.equal(selectionHasPurchase(stale), true, 'their shots still count as a purchase');

  // …and a payload naming ONLY cameras buys nothing at all.
  const camerasOnly = parseServicesStepSelection({ oneRungKey: 'O_A', oneExtraCameras: 3 });
  assert.deepEqual(camerasOnly, EMPTY_SERVICES_SELECTION);
  assert.equal(selectionHasPurchase(camerasOnly), false);
});

test('parse does not authorise — it only shapes', () => {
  // An unknown key survives parsing on purpose: whether a rung is real, live and
  // priced is the server's question, answered against the tier tables. Deciding
  // it here would put an allow-list in the browser bundle that goes stale the
  // moment an admin edits a row.
  const s = parseServicesStepSelection({ poolRungKey: 'NOT_A_RUNG' });
  assert.equal(s.poolRungKey, 'NOT_A_RUNG');
  assert.equal(poolStepOf(POOL, s), 0, 'and the ladder still refuses to price it');
});

test('an over-long key is dropped rather than carried to the server', () => {
  assert.equal(parseServicesStepSelection({ poolRungKey: 'x'.repeat(200) }).poolRungKey, null);
  assert.equal(parseServicesStepSelection({ poolRungKey: '   ' }).poolRungKey, null);
});

// ── setnayan ai ────────────────────────────────────────────────────────────

const AI_PHP = 499;

test('AI is OFF by default and adds nothing', () => {
  assert.equal(EMPTY_SERVICES_SELECTION.ai, false);
  const q = quoteServicesStepSelection(TYPES, EMPTY_SERVICES_SELECTION, AI_PHP);
  assert.equal(q.aiPhp, 0);
  assert.equal(q.totalPhp, 0);
});

test('ticking AI adds its OWN line and leaves the Papic subtotal alone', () => {
  // The whole reason the quote reports papicPhp separately (owner: "yes it can
  // be just 50 and 499"): the two must never be conflated on screen.
  let s = stepPool(POOL, EMPTY_SERVICES_SELECTION, 1);
  const papicOnly = quoteServicesStepSelection(TYPES, s, AI_PHP);
  s = setAi(s, true);
  const withAi = quoteServicesStepSelection(TYPES, s, AI_PHP);

  assert.equal(withAi.papicPhp, papicOnly.papicPhp, 'ticking AI must not move the Papic figure');
  assert.equal(withAi.aiPhp, AI_PHP);
  assert.equal(withAi.totalPhp, papicOnly.papicPhp + AI_PHP);
});

test('AI alone is a purchase — a couple may buy only the planner', () => {
  const s = setAi(EMPTY_SERVICES_SELECTION, true);
  assert.equal(selectionHasPurchase(s), true);
  assert.equal(quoteServicesStepSelection(TYPES, s, AI_PHP).papicPhp, 0);
  assert.equal(quoteServicesStepSelection(TYPES, s, AI_PHP).totalPhp, AI_PHP);
});

test('a ticked AI with NO price offered on this type charges nothing', () => {
  // `view.ai === null` (a vendor-free type) means the card never rendered, so a
  // selection carrying ai:true can only come from a stale or tampered payload.
  // It must quote ZERO rather than fall back to some other type's figure.
  const s = setAi(EMPTY_SERVICES_SELECTION, true);
  assert.equal(quoteServicesStepSelection(TYPES, s, null).aiPhp, 0);
  assert.equal(quoteServicesStepSelection(TYPES, s, 0).aiPhp, 0);
  assert.equal(quoteServicesStepSelection(TYPES, s, null).totalPhp, 0);
});

test('un-ticking AI removes it completely', () => {
  const s = setAi(setAi(EMPTY_SERVICES_SELECTION, true), false);
  assert.equal(s.ai, false);
  assert.equal(quoteServicesStepSelection(TYPES, s, AI_PHP).aiPhp, 0);
  assert.equal(selectionHasPurchase(s), false);
});

test("parse treats the STRING 'false' as NO — Boolean('false') is true", () => {
  // The simple-event flow posts this as a form field, where every value is a
  // string. A naive Boolean() would leave the planner permanently ticked and
  // silently bill every one of those couples.
  assert.equal(parseServicesStepSelection({ ai: 'false' }).ai, false);
  assert.equal(parseServicesStepSelection({ ai: '0' }).ai, false);
  assert.equal(parseServicesStepSelection({ ai: '' }).ai, false);
  assert.equal(parseServicesStepSelection({ ai: 'yes' }).ai, false);
  assert.equal(parseServicesStepSelection({}).ai, false);
  assert.equal(parseServicesStepSelection({ ai: 1 }).ai, false);
  // Only a genuine yes, in either of the two shapes that legitimately reach us.
  assert.equal(parseServicesStepSelection({ ai: true }).ai, true);
  assert.equal(parseServicesStepSelection({ ai: 'true' }).ai, true);
});

test('the selection carries NO price and NO tier for AI', () => {
  // Setnayan AI is priced per EVENT TYPE, server-side, from the event's stored
  // type. If a price or tier ever appears on this object, a tampered payload
  // could pick a cheaper one.
  const s = setAi(EMPTY_SERVICES_SELECTION, true);
  assert.deepEqual(Object.keys(s).sort(), ['ai', 'poolRungKey']);
  const parsed = parseServicesStepSelection({ ai: true, aiPricePhp: 1, aiTier: 'D' });
  assert.deepEqual(Object.keys(parsed).sort(), ['ai', 'poolRungKey']);
});
