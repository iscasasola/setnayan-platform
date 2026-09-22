/**
 * one-commission-promise.test.ts — the 0% commission claim, owner-ruled.
 *
 * ── THE RULING ─────────────────────────────────────────────────────────────
 * Owner 2026-08-06, recorded in `/pricing`'s own source, and re-confirmed
 * 2026-09-22: **"0% commission" is CORRECT and stays.** The couple pays the
 * supplier directly and Setnayan never touches that money. The booking fee is a
 * separate bill to the SUPPLIER for the introduction — *"so both sentences are
 * true at once, but only if the second one is actually said."*
 *
 * ── THE AUDIENCE DISTINCTION IS THE WHOLE RULE ─────────────────────────────
 * 🔑 A COUPLE-FACING "0% commission" NEEDS NO SECOND SENTENCE and must not be
 * made to carry one: a couple is not billed and never will be, so adding the
 * fee there raises a question they do not have. The second sentence is owed
 * wherever a SUPPLIER reads the claim. That is why this guard has a list of
 * supplier surfaces rather than banning a phrase globally.
 *
 * ── WHAT WAS ACTUALLY WRONG ────────────────────────────────────────────────
 * Three supplier pages promised **"0% commission while we launch"** with no
 * gate at all, while production had already charged and collected **₱837.50** —
 * the same claim `VendorGrowFairPay` records fixing on 2026-09-20, simply never
 * removed elsewhere. Two more hand-typed the fee schedule beside it.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { BANNED_LAUNCH_WINDOW_SHAPE } from '@/lib/commission-promise';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

/**
 * Surfaces a SUPPLIER reads. Each must name the booking fee wherever it names
 * commission — through the shared module, or (for `/pricing` and
 * `vendor-grow-sections`, which said both sentences before this module existed)
 * in their own already-correct prose.
 */
const SUPPLIER_SURFACES = [
  'app/vendors/_components/vendor-grow-hero.tsx',
  'app/vendors/_components/vendor-tier-matrix.tsx',
  'app/vendors/_components/vendor-tier-deltas.tsx',
  'app/vendors/_components/vendor-grow-sections.tsx',
  'app/vendor/claim/[token]/page.tsx',
  'app/_components/home/HomeOverlays.tsx',
  'app/_components/home/vendor-benefits.ts',
  'app/_components/frontdoor/front-door-feed.tsx',
  'app/vendor-dashboard/earnings/surface.tsx',
  'app/waitlist/page.tsx',
  'app/admin/custom-plans/_components/custom-composer.tsx',
  'app/(shell)/pricing/page.tsx',
  'lib/help.ts',
];

/** Does this source name the booking fee at all — derived or in prose? */
function namesTheFee(src: string): boolean {
  return (
    /supplierCommission(Promise|Short)\(/.test(src) ||
    /bookingFeeScheduleSummary\(/.test(src) ||
    /booking fee/i.test(src)
  );
}

// SABOTAGE: strip the fee sentence from any one surface → RED.
test('every supplier surface that says "commission" also says what the fee is', () => {
  for (const f of SUPPLIER_SURFACES) {
    const src = readCode(f);
    if (!/commission/i.test(src)) continue; // said nothing, owes nothing
    assert.ok(
      namesTheFee(src),
      `${f}: tells a supplier there is no commission and never mentions the booking fee — the ruling is that both sentences are true at once, but ONLY if the second one is actually said`,
    );
  }
});

// SABOTAGE: restore "0% commission while we launch" anywhere → RED.
test('no supplier surface ties the zero to a launch window', () => {
  for (const f of SUPPLIER_SURFACES) {
    const src = readCode(f);
    assert.equal(
      count(src, BANNED_LAUNCH_WINDOW_SHAPE),
      0,
      `${f}: promises a launch-period zero. That launch period ENDED — production charged and collected ₱837.50 on 2026-09-20 — so no wording, gated or not, can make it true`,
    );
  }
});

// SABOTAGE: hand-type "5%, then 1% beyond ₱100,000" on a supplier surface → RED.
test('a supplier surface never hand-types the fee schedule', () => {
  for (const f of SUPPLIER_SURFACES) {
    const src = readCode(f);
    assert.equal(
      count(src, /\d+%[^.<>{}]{0,30}then\s+\d+%/i),
      0,
      `${f}: types the schedule instead of deriving it from bookingFeeScheduleSummary() — a hand-edited sentence is exactly what went stale here, twice`,
    );
  }
});

// 🔑 THE OTHER DIRECTION. A guard that only ever adds obligations would
// eventually push the fee sentence onto couple pages, where it is noise and the
// ruling says it does not belong.
// SABOTAGE: add "booking fee" to the couple-facing marketplace copy → RED.
test('a COUPLE-facing surface is left alone — the zero is unqualified for them', () => {
  for (const f of ['app/(shell)/marketplace/page.tsx', 'app/(shell)/explore/page.tsx']) {
    const src = readCode(f);
    assert.equal(
      count(src, /booking fee/i),
      0,
      `${f}: a couple is not billed and never will be, so naming the supplier's fee here raises a question they do not have — the audience distinction IS the ruling`,
    );
  }
});

// SABOTAGE: delete a surface from the list → RED (the list must stay honest).
test('the supplier list still covers what it claims to', () => {
  assert.ok(SUPPLIER_SURFACES.length >= 13, 'floored: a shrinking list guards less while looking the same');
  let saying = 0;
  for (const f of SUPPLIER_SURFACES) if (/commission/i.test(readCode(f))) saying += 1;
  assert.ok(
    saying >= 10,
    `only ${saying} of the listed surfaces still mention commission — if the claim moved, this list is pointed at the wrong files`,
  );
});
