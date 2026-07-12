/**
 * Unit suite for the specialty recommendations engine — the first (deterministic)
 * consumer of the captured per-type signature signals. Guards that a recommendation
 * only fires when a real captured signal backs it, and that output is stable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { specialtyRecommendations, type SpecialtyRecommendation } from './specialty-recommendations';

const keys = (recs: SpecialtyRecommendation[]) => recs.map((r) => r.key).sort();

test('no signals → no recommendations (never invented)', () => {
  assert.deepEqual(specialtyRecommendations('debut', {}), []);
  assert.deepEqual(specialtyRecommendations('christening', {}), []);
});

test('unknown type / null inputs → []', () => {
  assert.deepEqual(specialtyRecommendations('not_a_type', { x: 1 }), []);
  assert.deepEqual(specialtyRecommendations(null, { x: 1 }), []);
  assert.deepEqual(specialtyRecommendations('debut', null), []);
  assert.deepEqual(specialtyRecommendations(undefined, undefined), []);
});

test('debut: a captured cotillion + 18 Candles fire their own recs; empties do not', () => {
  const recs = specialtyRecommendations('debut', {
    cotillion: [{ name: 'A', pair_role: 'escort' }],
    eighteen_candles: [{ name: 'Tita' }, { name: 'Lola' }],
    eighteen_treasures: [],
    theme_peg: '',
  });
  const k = keys(recs);
  assert.ok(k.includes('debut_cotillion_rehearsals'));
  assert.ok(k.includes('debut_collect_candle_messages'));
  assert.ok(!k.includes('debut_confirm_treasures')); // empty roster → no rec
  assert.ok(!k.includes('debut_brief_stylist_peg')); // empty string → no rec
  // The candle rec names the captured count.
  const candle = recs.find((r) => r.key === 'debut_collect_candle_messages')!;
  assert.match(candle.reason, /2 of your 18 Candles/);
});

test('debut: the theme peg is echoed into the recommendation title', () => {
  const recs = specialtyRecommendations('debut', { theme_peg: 'Enchanted Garden' });
  const peg = recs.find((r) => r.key === 'debut_brief_stylist_peg');
  assert.ok(peg && peg.title.includes('Enchanted Garden'));
});

test('christening: godparent rosters drive the confirmation-cert recommendation', () => {
  const recs = specialtyRecommendations('christening', {
    godparents_principal: [{ name: 'Ninong 1' }],
    godparents_secondary: [{ name: 'Ninang A' }, { name: 'Ninang B' }],
    officiant_parish: 'San Agustin',
  });
  const k = keys(recs);
  assert.ok(k.includes('christening_collect_sponsor_certs'));
  assert.ok(k.includes('christening_seminar'));
  assert.match(recs.find((r) => r.key === 'christening_collect_sponsor_certs')!.reason, /3 ninong\/ninang/);
});

test('gender_reveal: the secret-keeper + method drive privacy-aware recs', () => {
  const recs = specialtyRecommendations('gender_reveal', {
    secret_keeper: 'Tita Baker',
    reveal_method: 'smoke cannon',
    guessing_game: true,
  });
  const k = keys(recs);
  assert.ok(k.includes('reveal_confirm_secret_keeper'));
  assert.ok(k.includes('reveal_book_supplier'));
  assert.ok(k.includes('reveal_team_game'));
});

test('every recommendation is well-formed (keyed, categorised, scheduled)', () => {
  const CATS = new Set(['foundations', 'vendors', 'paperwork', 'logistics', 'attire', 'guests']);
  const samples = [
    ['debut', { cotillion: [{ name: 'x' }], eighteen_candles: [{ name: 'y' }], theme_peg: 'P' }],
    ['christening', { godparents_principal: [{ name: 'x' }], officiant_parish: 'P' }],
    ['anniversary', { tribute_program: 'yes', renewal_of_vows: true }],
    ['birthday', { palabunutan: true, milestone_type: '60th' }],
    ['reunion', { reunion_shirt: true, balikbayan_honorees: [{ name: 'x' }] }],
  ] as const;
  const seen = new Set<string>();
  for (const [type, sig] of samples) {
    for (const r of specialtyRecommendations(type, sig)) {
      assert.ok(r.key && r.title && r.reason, `${type}: incomplete rec`);
      assert.ok(CATS.has(r.category), `${type}/${r.key}: bad category ${r.category}`);
      assert.ok(Number.isFinite(r.dueOffsetDays) && r.dueOffsetDays > 0, `${type}/${r.key}: bad due`);
      assert.ok(!seen.has(r.key), `duplicate rec key across types: ${r.key}`);
      seen.add(r.key);
    }
  }
});

test('recommendations are pure + deterministic (same input → same output)', () => {
  const sig = { cotillion: [{ name: 'x' }], theme_peg: 'P' };
  assert.deepEqual(specialtyRecommendations('debut', sig), specialtyRecommendations('debut', sig));
  assert.deepEqual(sig, { cotillion: [{ name: 'x' }], theme_peg: 'P' }); // input not mutated
});
