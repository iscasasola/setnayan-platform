/**
 * 🍱 A REVISED QUOTE COUNTS ITS CREW MEAL ONCE (CHAT-31 · walk 16 Nov 2026).
 *
 * The supplier opened "Update this quote" on an accepted ₱8,750 quote and the editor said ₱10,500. Read from the live
 * row (S89J-EV66BY94V6, prod SELECT, 16 Nov): ONE sent version, no per-guest line — Ceremony Sound Kit ₱12,000 +
 * Crew meal ₱1,750 − Discount ₱5,000 = ₱8,750. The ₱1,750 gap is the crew meal, counted twice: the stored line seeds
 * as an ordinary flat line (lib/quote-revision-seed.ts, by design), and the builder's crew state started at
 * "charge 5 × ₱350" regardless, so it emitted a second "Crew meal" on top. The seed's own header promised the
 * crew/transport modes "stay 'included' so nothing is counted twice" — nothing held it to that.
 *
 * What would silently undo it: the builder's crew state defaulting to 'charge' (or 'offset') again when a revision
 * opens it, or the seed dropping the stored crew line (then the revision would be ₱1,750 cheaper instead).
 *
 * The figures are the walk's own row, not prices.
 * SABOTAGE (seen red, restored): `mode: revision ? 'included' : …` → `mode: coupleCrewProvider ? 'offset' : 'charge'`.
 *
 * Run: cd apps/web && npx tsx --test lib/a-revised-quote-counts-its-crew-meal-once.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { seedQuoteRevision } from './quote-revision-seed';
import { stripComments } from './strip-comments';

const WALK_ROW = {
  public_id: 'S89J-EV66BY94V6',
  title: 'Ceremony Sound Kit',
  total_centavos: 875_000,
  status: 'accepted',
  sent_at: null,
  rendered_body: '',
  valid_until: null,
  payment_method_ids: [],
  merge_snapshot: null,
  line_items: [
    { basis: 'flat', label: 'Ceremony Sound Kit', detail: null, card_id: 'card-a', amount_centavos: 1_200_000 },
    { label: '2 wireless handheld mics', detail: 'Complimentary', card_id: 'card-a', amount_centavos: null },
    { label: 'Crew meal', detail: '5 crew × ₱350/head', amount_centavos: 175_000 },
    { label: 'Transportation', detail: 'Quoted after site check', amount_centavos: null },
    { label: 'Discount', detail: 'First couple · ₱5,000 off', from_offer_id: 'S89D-X', amount_centavos: -500_000 },
  ],
};

test('the seed carries the stored crew meal as ONE ordinary line, and its lines add back to the accepted total', () => {
  const seed = seedQuoteRevision(WALK_ROW);
  const crewLines = seed.lines.filter((l) => /crew meal/i.test(l.label));
  assert.equal(crewLines.length, 1, 'the stored crew meal should seed once, as a line');
  assert.equal(crewLines[0].flatPhp, 1750);
  const offerOff = seed.offer?.offPhp ?? 0;
  const linesPhp = seed.lines.reduce((s, l) => s + (l.free ? 0 : l.flatPhp), 0);
  assert.equal(linesPhp - seed.discountPhp - offerOff, 8750, 'seeded lines − discount must equal the accepted ₱8,750');
});

test('the builder does not add a SECOND crew meal on top of a revision', () => {
  const src = stripComments(
    readFileSync(path.join(__dirname, '..', 'app', '_components', 'proposal-maker.tsx'), 'utf8'),
  );
  const init = src.match(/useState<Crew>\(\{\s*mode:\s*([^,]+),/);
  assert.ok(init, 'the crew state initialiser moved — re-anchor this test, do not delete it');
  assert.match(
    init[1],
    /^revision\s*\?\s*'included'/,
    "a revision already carries its crew charge in its lines — the builder's crew must start 'included'",
  );
});
