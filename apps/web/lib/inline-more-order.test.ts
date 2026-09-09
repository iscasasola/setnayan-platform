/**
 * THE SORT REACHES THE BOTTOM TIER, AND STOPS THERE.
 *
 * Owner, 2026-09-09: *"bottom tier only."* Row 2's order comes from an
 * owner-locked ladder — relationship depth → BOOSTED (paid placement) →
 * top-reviews → tail. The couple's chosen lens now orders the tail. Nothing
 * above it may move, because what Setnayan sells is that default position and a
 * chip that could demote a paying vendor is a refund nobody agreed to.
 *
 * ⚠ THESE ARE NOT SHAPE TESTS. Each one is written so that the obvious wrong
 * implementation FAILS it:
 *  • "sort the whole array" fails `every protected rung keeps its exact index`.
 *  • "sort the last N rows" fails `the tail is not a contiguous suffix` — the
 *    service-date down-rank legitimately parks a busy BOOSTED vendor below tail
 *    rows, and a suffix sort would drag it around.
 *  • "run the comparator anyway" fails `a sort with nothing to sort by leaves
 *    the ladder alone`.
 *  • "feed the scorer everything the card has" fails `paid placement never
 *    reaches the scorer`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ORDERABLE_TIER,
  canOrderInlineMoreRow,
  inlineMoreCompatInputs,
  inlineMoreOrderNote,
  orderInlineMoreRow,
  type InlineMoreOrderable,
} from '@/lib/inline-more-order';

function row(
  id: string,
  ladderTier: InlineMoreOrderable['ladderTier'],
  over: Partial<InlineMoreOrderable> = {},
): InlineMoreOrderable {
  return {
    vendorProfileId: id,
    ladderTier,
    startsAtPhp: null,
    rating: null,
    reviewCount: null,
    distanceKm: null,
    serviceRadiusKm: 25,
    verified: false,
    ...over,
  };
}

const ids = (rows: readonly InlineMoreOrderable[]): string[] =>
  rows.map((r) => r.vendorProfileId);

// ── The commercial boundary ────────────────────────────────────────────────

test('every protected rung keeps its exact index — only the tail moves', () => {
  const rows = [
    row('rel', 'relationship', { startsAtPhp: 900_000 }),
    row('paid-1', 'boosted', { startsAtPhp: 800_000 }),
    row('paid-2', 'boosted', { startsAtPhp: 700_000 }),
    row('rev', 'top_reviews', { startsAtPhp: 600_000 }),
    row('t-expensive', 'tail', { startsAtPhp: 500_000 }),
    row('t-cheap', 'tail', { startsAtPhp: 10_000 }),
    row('t-mid', 'tail', { startsAtPhp: 100_000 }),
  ];
  const out = orderInlineMoreRow(rows, 'price');

  // The cheapest tail card is now the first TAIL card — the feature works.
  assert.deepEqual(ids(out), [
    'rel',
    'paid-1',
    'paid-2',
    'rev',
    't-cheap',
    't-mid',
    't-expensive',
  ]);
  // …and every protected row is byte-for-byte where the ladder put it, even
  // though three of them are more expensive than every tail card.
  for (let i = 0; i < rows.length; i += 1) {
    const before = rows[i] as InlineMoreOrderable;
    if (before.ladderTier === ORDERABLE_TIER) continue;
    assert.equal(
      out[i]?.vendorProfileId,
      before.vendorProfileId,
      `protected row ${before.vendorProfileId} moved off index ${i}`,
    );
  }
});

test('the tail is not a contiguous suffix — a busy paid vendor parked at the end still never moves', () => {
  // The service-date down-rank in category-search.ts stable-partitions vendors
  // who are busy on the date to the very end, ACROSS tier boundaries. So the
  // last row in the array can be a boosted one, sitting below tail rows.
  const rows = [
    row('paid', 'boosted', { startsAtPhp: 400_000 }),
    row('t-expensive', 'tail', { startsAtPhp: 500_000 }),
    row('t-cheap', 'tail', { startsAtPhp: 10_000 }),
    row('paid-busy', 'boosted', { startsAtPhp: 999_000 }),
  ];
  const out = orderInlineMoreRow(rows, 'price');
  assert.deepEqual(ids(out), ['paid', 't-cheap', 't-expensive', 'paid-busy']);
  // A "sort the last N" implementation would have pulled `paid-busy` forward,
  // because it is the most expensive card in the set.
  assert.equal(out[3]?.vendorProfileId, 'paid-busy');
  assert.equal(out[0]?.vendorProfileId, 'paid');
});

test('a tail card with no price sorts last, never as zero', () => {
  const rows = [
    row('t-none', 'tail'),
    row('t-cheap', 'tail', { startsAtPhp: 10_000 }),
    row('t-dear', 'tail', { startsAtPhp: 90_000 }),
  ];
  assert.deepEqual(ids(orderInlineMoreRow(rows, 'price')), ['t-cheap', 't-dear', 't-none']);
});

test('a sort with nothing to sort by leaves the ladder alone', () => {
  // Not one tail card carries a price. Running the comparator anyway would
  // shuffle on tie-breaks the couple never asked for; the ladder's own order is
  // the honest answer, and the row's sentence says so.
  const rows = [
    row('paid', 'boosted'),
    row('t-a', 'tail'),
    row('t-b', 'tail'),
    row('t-c', 'tail'),
  ];
  assert.equal(canOrderInlineMoreRow('price', rows.filter((r) => r.ladderTier === 'tail')), false);
  assert.deepEqual(ids(orderInlineMoreRow(rows, 'price')), ['paid', 't-a', 't-b', 't-c']);
});

test('the no-signal check is behaviour, not decoration — a lens that cannot discriminate moves nothing', () => {
  // ⚠ THE PRICE CASE ABOVE CANNOT PROVE THIS ON ITS OWN. With no prices at all
  // every card ties at Infinity and Array.prototype.sort is stable, so deleting
  // the guard leaves that order identical and the test still passes. This one
  // is written so the mutation is VISIBLE: under "Nearest to your venue" only
  // one card has a measured distance, so §15.2 refuses the lens — but the
  // scorer would happily float that single measured card to the front if it
  // were allowed to run. It is placed LAST so the move cannot be missed.
  const rows = [
    row('t-unmeasured-a', 'tail'),
    row('t-unmeasured-b', 'tail'),
    row('t-measured', 'tail', { distanceKm: 1 }),
  ];
  assert.equal(canOrderInlineMoreRow('near', rows), false);
  assert.deepEqual(ids(orderInlineMoreRow(rows, 'near')), [
    't-unmeasured-a',
    't-unmeasured-b',
    't-measured',
  ]);
});

test('one tail card is never "ordered" — there is nothing to put it in order against', () => {
  const rows = [row('paid', 'boosted'), row('t-only', 'tail', { startsAtPhp: 1 })];
  assert.equal(canOrderInlineMoreRow('price', [rows[1] as InlineMoreOrderable]), false);
});

test('Top rated orders the tail and leaves paid placement above it', () => {
  const rows = [
    row('paid-poor', 'boosted', { rating: 2.1 }),
    row('t-good', 'tail', { rating: 4.2 }),
    row('t-best', 'tail', { rating: 4.9 }),
  ];
  const out = orderInlineMoreRow(rows, 'rating');
  assert.deepEqual(ids(out), ['paid-poor', 't-best', 't-good']);
});

test('a ranking lens orders the tail through the ONE scorer', () => {
  // "Nearest to your venue" — distance 0.45. Same travel radius on every card,
  // so the decay is comparable and nearer must win.
  const rows = [
    row('paid-far', 'boosted', { distanceKm: 90 }),
    row('t-far', 'tail', { distanceKm: 60 }),
    row('t-near', 'tail', { distanceKm: 2 }),
    row('t-mid', 'tail', { distanceKm: 20 }),
  ];
  const out = orderInlineMoreRow(rows, 'near');
  assert.deepEqual(ids(out), ['paid-far', 't-near', 't-mid', 't-far']);
});

test('a lens inherits the shipped §15.2 gate rather than a second copy of it', () => {
  // `LENSES[mode].hideWhen` is the ONE predicate for "can this lens
  // discriminate?" — three candidates minimum, two of them measured. Reusing it
  // means the tail cannot be re-ordered under conditions where the chip itself
  // would have been refused, and there is no second rule to drift from it.
  const two = [
    row('t-near', 'tail', { distanceKm: 2 }),
    row('t-far', 'tail', { distanceKm: 60 }),
  ];
  assert.equal(canOrderInlineMoreRow('near', two), false);

  const threeButOneMeasured = [
    row('t-a', 'tail', { distanceKm: 2 }),
    row('t-b', 'tail'),
    row('t-c', 'tail'),
  ];
  assert.equal(canOrderInlineMoreRow('near', threeButOneMeasured), false);

  const threeMeasured = [
    row('t-a', 'tail', { distanceKm: 2 }),
    row('t-b', 'tail', { distanceKm: 20 }),
    row('t-c', 'tail'),
  ];
  assert.equal(canOrderInlineMoreRow('near', threeMeasured), true);
});

test('the default lens can always order — it has no driving input to be missing', () => {
  const rows = [
    row('t-a', 'tail', { rating: 3 }),
    row('t-b', 'tail', { rating: 5 }),
    row('t-c', 'tail', { rating: 4 }),
  ];
  assert.equal(canOrderInlineMoreRow('fit', rows), true);
});

test('paid placement never reaches the scorer', () => {
  // compat-score documents `boosted` as ad_rank > 0. Feeding it would let ad
  // spend buy score inside the one tier that is supposed to be free of it.
  const inputs = inlineMoreCompatInputs(row('x', 'tail', { verified: true }));
  assert.equal('boosted' in inputs, false);
  assert.equal(Object.prototype.hasOwnProperty.call(inputs, 'boosted'), false);
});

test('the date verdict is not a term inside the score — it is the partition applied after', () => {
  // dateHeadroomRatio is deliberately absent: classifyInlineMoreRow sinks a
  // clashing candidate, and scoring it down as well would sink it twice.
  const inputs = inlineMoreCompatInputs(row('x', 'tail'));
  assert.equal('dateHeadroomRatio' in inputs, false);
});

test('the input array is never mutated', () => {
  const rows = [
    row('t-dear', 'tail', { startsAtPhp: 90_000 }),
    row('t-cheap', 'tail', { startsAtPhp: 10_000 }),
  ];
  const before = ids(rows);
  orderInlineMoreRow(rows, 'price');
  assert.deepEqual(ids(rows), before);
});

// ── The sentence ───────────────────────────────────────────────────────────

test('the row says which rungs lead it and what orders the rest', () => {
  const note = inlineMoreOrderNote({
    rows: [
      row('paid', 'boosted'),
      row('rev', 'top_reviews'),
      row('t-a', 'tail', { startsAtPhp: 1 }),
      row('t-b', 'tail', { startsAtPhp: 2 }),
    ],
    mode: 'price',
    modeLabel: 'Lowest price',
  });
  assert.equal(note, 'Featured and most reviewed first, then your ‘Lowest price’.');
});

test('it names only the rungs this row actually contains', () => {
  const note = inlineMoreOrderNote({
    rows: [
      row('rel', 'relationship'),
      row('paid', 'boosted'),
      row('rev', 'top_reviews'),
      row('t-a', 'tail', { startsAtPhp: 1 }),
      row('t-b', 'tail', { startsAtPhp: 2 }),
    ],
    mode: 'price',
    modeLabel: 'Lowest price',
  });
  assert.equal(
    note,
    'Suppliers you know, Featured and most reviewed first, then your ‘Lowest price’.',
  );
  // A row with no boosted vendor must not say "Featured".
  const noPaid = inlineMoreOrderNote({
    rows: [row('rev', 'top_reviews'), row('t-a', 'tail', { startsAtPhp: 1 }), row('t-b', 'tail', { startsAtPhp: 2 })],
    mode: 'price',
    modeLabel: 'Lowest price',
  });
  assert.equal(noPaid, 'Most reviewed first, then your ‘Lowest price’.');
  assert.equal(noPaid?.includes('Featured'), false);
});

test('when the sort changed nothing, the row does not claim it did', () => {
  const note = inlineMoreOrderNote({
    rows: [row('paid', 'boosted'), row('t-a', 'tail'), row('t-b', 'tail'), row('t-c', 'tail')],
    mode: 'price',
    modeLabel: 'Lowest price',
  });
  assert.equal(note, 'Featured first, then Setnayan’s order.');
  assert.equal(note.includes('Lowest price'), false);
});

test('a row with nothing below the protected rungs explains the stillness', () => {
  const note = inlineMoreOrderNote({
    rows: [row('paid', 'boosted'), row('rev', 'top_reviews')],
    mode: 'price',
    modeLabel: 'Lowest price',
  });
  assert.equal(
    note,
    'Featured and most reviewed first — your ‘Lowest price’ orders anything below them.',
  );
});

test('a row that is all tail says the sort ordered all of it', () => {
  const note = inlineMoreOrderNote({
    rows: [
      row('t-a', 'tail', { startsAtPhp: 1 }),
      row('t-b', 'tail', { startsAtPhp: 2 }),
      row('t-c', 'tail', { startsAtPhp: 3 }),
    ],
    mode: 'price',
    modeLabel: 'Lowest price',
  });
  assert.equal(note, 'Ordered by your ‘Lowest price’.');
});

test('an empty row says nothing at all', () => {
  assert.equal(inlineMoreOrderNote({ rows: [], mode: 'price', modeLabel: 'Lowest price' }), null);
});

test('the sentence quotes the chip the couple actually pressed', () => {
  // The label differs by flag — "Best fit" off, "Best matches" on — so it is
  // passed in from the component that rendered the chips, never looked up.
  const rows = [
    row('paid', 'boosted'),
    row('t-a', 'tail', { rating: 4 }),
    row('t-b', 'tail', { rating: 3 }),
  ];
  assert.equal(
    inlineMoreOrderNote({ rows, mode: 'fit', modeLabel: 'Best fit' }),
    'Featured first, then your ‘Best fit’.',
  );
  assert.equal(
    inlineMoreOrderNote({ rows, mode: 'fit', modeLabel: 'Best matches' }),
    'Featured first, then your ‘Best matches’.',
  );
});

// ── THE OTHER END OF THE SAME BOUNDARY ──────────────────────────────────────
//
// Everything above proves the ORDERER respects `ladderTier`. None of it can see
// whether the SERVER still tells the truth in that field — and a mis-stamp is
// the silent version of this defect: stamp a boosted row `'tail'` and the sort
// starts demoting paid placement with every test above still green.
//
// So the stamping is pinned here too, on the STRIPPED source (a guard that
// matches its own explanatory comment guards nothing — this repo has shipped
// one that did).

test('the server still stamps all four rungs, and returns the stamp it made', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { stripComments } = await import('@/lib/strip-comments');

  const WEB = join(import.meta.dirname, '..');
  const LADDER = 'app/dashboard/[eventId]/vendors/_actions/category-search.ts';
  const src = stripComments(readFileSync(join(WEB, LADDER), 'utf8'));

  // Non-vacuity: if the file moved or the reader broke, every check below would
  // "pass" against an empty string. Refuse that outcome loudly.
  assert.ok(src.length > 20_000, `ladder source looks wrong: ${src.length} chars`);

  // Each of the three PROTECTED rungs is stamped from its own assembly array.
  // Lose one of these lines and its vendors fall through to the `'tail'`
  // default — which is exactly the tier the couple's sort is allowed to move.
  for (const [array, tier] of [
    ['withRelationship', 'relationship'],
    ['boosted', 'boosted'],
    ['top10', 'top_reviews'],
    ['tail', 'tail'],
  ] as const) {
    const stamp = new RegExp(
      `for\\s*\\(\\s*const\\s+\\w+\\s+of\\s+${array}\\s*\\)\\s*\\w+\\._tier\\s*=\\s*'${tier}'`,
    );
    assert.match(src, stamp, `the ${tier} rung is no longer stamped from ${array}`);
  }

  // …and the public field carries that stamp rather than a literal or a
  // re-derivation from the public fields.
  assert.match(src, /ladderTier:\s*s\._tier\b/, 'ladderTier is no longer the stamp the ladder made');
  assert.equal(
    /ladderTier:\s*'(relationship|boosted|top_reviews|tail)'/.test(src),
    false,
    'ladderTier is being set to a constant somewhere',
  );

  // The couple's "Lowest price" must have a price to read whether or not the
  // smart-sort flag is on — `_startsAt` is flag-gated and is NOT that field.
  assert.match(
    src,
    /startsAtPhp:\s*startsAtByVendor\.get\(r\.vendor_profile_id\)\s*\?\?\s*null/,
    'startsAtPhp is no longer read unconditionally',
  );
});

test('the bench actually renders the ordered rows, and actually prints the sentence', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { stripComments } = await import('@/lib/strip-comments');

  const WEB = join(import.meta.dirname, '..');
  const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
  const src = stripComments(readFileSync(join(WEB, BENCH), 'utf8'));
  assert.ok(src.length > 60_000, `the bench read as ${src.length} chars — the scan is not reading it`);

  // Computing the order and then handing the classifier the RAW rows is the
  // silent version of the original defect: everything type-checks, every test
  // above passes, and the couple's sort quietly stops reaching this row again.
  assert.match(
    src,
    /orderInlineMoreRow\(\s*excludeBenchVendors\(/,
    'row 2 is no longer ordered by the couple’s sort',
  );
  assert.match(
    src,
    /classifyInlineMoreRow\(\{\s*rows:\s*moreVisible,/,
    'the classifier is being fed rows that were never ordered',
  );
  // …and the sentence reaches the screen rather than a variable.
  assert.match(src, /\{moreOrderNote\}/, 'the "what this is ordered by" line is no longer rendered');
});
