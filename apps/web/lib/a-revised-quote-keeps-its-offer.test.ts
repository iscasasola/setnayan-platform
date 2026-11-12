/**
 * 🏷 A REVISED QUOTE KEEPS ITS LINE'S OFFER — and re-opens each line as it was priced.
 *
 * Owner 12 Nov 2026 ("QUOTE MONEY — THREE ANSWERS" (1)): *"The supplier chooses which offer applies on the quotation;
 * once the client has added a service at that price, that service's discount stays with it."* Before this, a revision
 * folded EVERY negative line into the Discount field, so "Update this quote" quietly turned the supplier's offer into a
 * typed discount — the offer was gone, and with it its reach and its gifts. And every line came back flat with
 * `minPax: 0`, so a per-pax line stopped following the guest list the moment it was revised.
 *
 * Also fails if the send path drops the line's facts on the way into the row (`keepLineStructure` after the free-travel
 * rule rebuilds every line bare), or the pax facts stop reaching `merge_snapshot`.
 *
 * The figures are fixtures, not prices.
 * SABOTAGE (seen red, restored): fold the offer line into `discountCentavos` again · drop `keepLineStructure` in the
 * send path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { seedQuoteRevision, QUOTE_REVISION_SELECT } from './quote-revision-seed';
import { keepLineStructure, lineStructureOf } from './quote-line-structure';
import { applyFreeTransportToQuote } from './vendor-free-transport';
import { stripComments } from './strip-comments';

const row = (line_items: unknown[], merge_snapshot: unknown = null) => ({
  public_id: 'S89J-X',
  title: 'Garden wedding',
  total_centavos: 0,
  status: 'sent',
  sent_at: null,
  rendered_body: '',
  valid_until: null,
  line_items,
  payment_method_ids: [],
  merge_snapshot,
});

test('the offer’s named line comes back as the OFFER — not folded into the Discount', () => {
  const seed = seedQuoteRevision(
    row([
      { label: 'Garden buffet', detail: '₱450 × 150 pax', amount_centavos: 6_750_000, card_id: 'card-a', basis: 'per_pax', rate_centavos: 45_000 },
      { label: 'Album', detail: 'from offer · Dry-season weekday', amount_centavos: null, offer_id: 'S89O-1' },
      { label: 'Dry-season weekday', detail: '5% off · on Garden buffet only · offer', amount_centavos: -337_500, offer_id: 'S89O-1' },
      { label: 'Discount', detail: 'Booked early', amount_centavos: -100_000 },
    ]),
  );
  assert.deepEqual(seed.offer, {
    id: 'S89O-1',
    name: 'Dry-season weekday',
    offPhp: 3375,
    detail: '5% off · on Garden buffet only · offer',
    giftLabels: ['Album'],
  });
  assert.equal(seed.discountPhp, 1000, 'only the typed discount is the Discount');
  assert.deepEqual(seed.lines.map((l) => l.label), ['Garden buffet'], 'the offer’s gift comes back WITH the offer, not as a stray line');
});

test('a per-pax line re-opens per-pax on its card — it keeps following their guest list; the ONE minimum comes back', () => {
  const seed = seedQuoteRevision(
    row(
      [
        { label: 'Garden buffet', detail: null, amount_centavos: 6_750_000, card_id: 'card-a', basis: 'per_pax', rate_centavos: 45_000 },
        { label: 'Photo booth', detail: null, amount_centavos: 2_500_000, card_id: 'card-b', basis: 'per_hour', rate_centavos: 2_000_000, incl_hours: 4, extra_hour_centavos: 250_000 },
        { label: 'Old line', detail: null, amount_centavos: 100_000 },
      ],
      { source: 'proposal_maker', billed_pax: 150, min_pax: 120 },
    ),
  );
  assert.deepEqual(
    seed.lines.map((l) => [l.label, l.basis, l.ratePhp, l.basePhp, l.inclHours, l.extraPhp, l.cardId]),
    [
      ['Garden buffet', 'per_pax', 450, 0, 0, 0, 'card-a'],
      ['Photo booth', 'per_hour', 0, 20000, 4, 2500, 'card-b'],
      ['Old line', 'flat', 0, 0, 0, 0, null],
    ],
  );
  assert.equal(seed.minPax, 120);
  assert.equal(seedQuoteRevision(row([])).minPax, null, 'a quote from before the minimum says nothing');
  assert.match(QUOTE_REVISION_SELECT, /merge_snapshot/, 'the revision read stopped asking for the minimum');
});

test('the line’s facts survive the send: validated, and put back after the free-travel rule rebuilds the lines', () => {
  assert.deepEqual(lineStructureOf({ card_id: 'x'.repeat(65), basis: 'per_seat', rate_centavos: -1, offer_id: 'S89O-1' }), { offer_id: 'S89O-1' });
  const sent = [
    { label: 'Garden buffet', detail: null, amount_centavos: 6_750_000, card_id: 'card-a', basis: 'per_pax' as const, rate_centavos: 45_000 },
    { label: 'Transportation', detail: 'Flat fee', amount_centavos: 150_000 },
    { label: 'Dry-season weekday', detail: '5% off · offer', amount_centavos: -337_500, offer_id: 'S89O-1' },
  ];
  const enforced = applyFreeTransportToQuote(sent, { transportLocked: true }).lineItems;
  assert.ok(!('card_id' in enforced[0]!), 'the enforcement builds lines bare — this is why keepLineStructure exists');
  const kept = keepLineStructure(sent, enforced);
  assert.equal(kept[0]!.card_id, 'card-a');
  assert.equal(kept[0]!.basis, 'per_pax');
  assert.equal(kept[0]!.rate_centavos, 45_000);
  assert.equal(kept.find((l) => l.label === 'Dry-season weekday')!.offer_id, 'S89O-1');
  assert.equal(kept.find((l) => l.label === 'Transportation')!.amount_centavos, 0);
});

test('the send path keeps the facts and writes the pax into merge_snapshot', () => {
  const src = stripComments(readFileSync(path.join(__dirname, 'proposal-send.ts'), 'utf8'));
  assert.match(src, /amount_centavos: amount, \.\.\.lineStructureOf\(li\)/, 'the sanitizer drops the line’s facts');
  assert.match(src, /keepLineStructure\(sanitized\.lineItems, enforced\.lineItems\)/, 'the free-travel rebuild drops the line’s facts');
  assert.match(src, /\.\.\.quotePaxSnapshot\(input\.pax\)/, 'billed_pax / min_pax no longer reach merge_snapshot');
});
