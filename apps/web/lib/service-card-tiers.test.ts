/**
 * service-card-tiers.test.ts — 🪜 the tier grid (Card Maker HYBRID, owner-approved 17 Nov; DECISION_LOG 16 Nov *"tier
 * grid will show what is added to the higher tiers"*). Starting is the card; each tier has its OWN typed price (never a
 * sum of priced lines — 11 Nov "an included line has no price"); "Gold adds …" names only what the tier below lacks.
 *
 * Sabotage (2026-11-17): compare `adds` against Starting instead of the tier below → test 2 red; sum line prices into a
 * tier → test 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTierGrid, tierHasLine } from './service-card-tiers';

const card = { startingPricePhp: null, startingLines: ['Hall for 5 hours', 'Tables and chairs', 'Basic lights'] };

test('1 · Starting is the card itself, first, with its own lines ticked', () => {
  const g = buildTierGrid({ ...card, tiers: [] });
  assert.equal(g.columns.length, 1);
  assert.equal(g.columns[0]!.name, 'Starting');
  assert.deepEqual(g.lines, card.startingLines);
  assert.ok(card.startingLines.every((l) => tierHasLine(g.columns[0]!, l)));
});

test('2 · a higher tier says only what it adds over the tier below it, cheapest first', () => {
  const g = buildTierGrid({
    ...card,
    tiers: [
      { name: 'Platinum', priceCentavos: 14_000_000, lines: [...card.startingLines, 'bridal  room', 'Ceiling drapes', '2 more hours'] },
      { name: 'Gold', priceCentavos: 11_000_000, lines: [...card.startingLines, 'Bridal room', 'Ceiling drapes'] },
    ],
  });
  assert.deepEqual(g.columns.map((c) => c.name), ['Starting', 'Gold', 'Platinum']);
  assert.deepEqual(g.columns[1]!.adds, ['Bridal room', 'Ceiling drapes'], 'words matched across case and spacing');
  assert.deepEqual(g.columns[2]!.adds, ['2 more hours'], 'Platinum repeats what Gold already added');
  assert.equal(g.lines.length, 6);
  assert.ok(!tierHasLine(g.columns[0]!, 'Bridal room'));
});

test('3 · a tier’s price is its own typed price, in pesos — never added up from lines', () => {
  const g = buildTierGrid({ ...card, tiers: [{ name: 'Gold', priceCentavos: 11_000_000, lines: ['Hall for 5 hours'] }] });
  assert.equal(g.columns[1]!.pricePhp, 110_000);
  assert.equal(g.columns[0]!.pricePhp, null, 'Starting’s price is the card’s own, shown from the card');
});
