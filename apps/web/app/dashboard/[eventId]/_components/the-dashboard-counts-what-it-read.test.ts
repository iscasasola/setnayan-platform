/**
 * the-dashboard-counts-what-it-read.test.ts
 *
 * The couple's Overview computed money and headcounts from two reads whose
 * failures nothing could see.
 *
 * 🔑 THE CATCH COULD NEVER FIRE. Both reads were wrapped
 * `try { return await supabase… } catch { return { data: [], error: null } }` —
 * but Supabase RESOLVES with `{ error }` instead of throwing, so a refused
 * query never reaches a `catch`. It arrived as `data: null`, `?? []` made it an
 * empty list, and:
 *
 *   • committed = paidOrdersTotal + contractedVendorsTotal → understated or ₱0,
 *     rendered as "₱0 committed of ₱800,000" with a 0% ring to a couple who
 *     had set a budget — progress they had not made, on the screen they use to
 *     decide what they can still afford;
 *   • "0 of 21 booked" and "No vendors booked yet — start with the ones that
 *     book out first", to a couple whose venue was already locked.
 *
 * The try/catch is KEPT (a genuine throw is still worth catching); what was
 * missing is that nobody read `.error`.
 *
 * 🛡 Source-anchored, and every assertion mutation-checked by occurrence count.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { budgetTileCommitted } from '@/lib/budget-tile-committed';

// Comments stripped: this file now explains the defect using the very strings
// it forbids, so a raw-source guard would flag its own explanation.
const src = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'event-dashboard.tsx'), 'utf8'),
);

test('both reads report whether they actually happened', () => {
  assert.match(src, /const vendorsMeasured = !eventVendorsRes\.error;/, 'suppliers');
  assert.match(src, /const ordersMeasured = !paidOrdersRes\.error;/, 'orders');
});

test('the committed figure needs BOTH reads, so it requires both flags', () => {
  // Since #5936 the tile's state comes from lib/budget-tile-committed.ts, which returns `unread` unless BOTH flags
  // are true (proved by calling it in lib/a-hidden-amount-never-reads-as-a-figure.test.ts) — so the dashboard must
  // hand it both, and "measured" must be that rule's answer.
  assert.match(
    src,
    /budgetTileCommitted\(\{\s*vendorsMeasured,\s*ordersMeasured,/,
    'committed is a SUM — either refusal understates it, so one flag is not enough',
  );
  assert.match(src, /const committedMeasured = committed\.state === 'measured';/);
  assert.deepEqual(
    budgetTileCommitted({ vendorsMeasured: true, ordersMeasured: false, amountsHidden: false, centavos: 1 }),
    { state: 'unread' },
  );
  assert.deepEqual(
    budgetTileCommitted({ vendorsMeasured: false, ordersMeasured: true, amountsHidden: false, centavos: 1 }),
    { state: 'unread' },
  );
});

test('no peso figure is printed that was not measured', () => {
  const gated = src.match(/committedMeasured \? formatPeso\(committedCentavos\) : '—'/g) ?? [];
  // Two branches render it: the ring layout and the plain layout.
  assert.equal(gated.length, 2, 'both budget-tile branches must be gated');
  const raw = src.match(/\{formatPeso\(committedCentavos\)\}/g) ?? [];
  assert.equal(raw.length, 0, 'no ungated committed figure may remain');
});

test('the supplier card states neither a count nor an absence it did not read', () => {
  assert.match(src, /!vendorsMeasured\s*\?\s*'not loaded'/, 'the booked badge must be gated');
  assert.match(
    src,
    /We couldn&rsquo;t load your suppliers just now/,
    '"No vendors booked yet" must not be shown for a read that never happened',
  );
});
