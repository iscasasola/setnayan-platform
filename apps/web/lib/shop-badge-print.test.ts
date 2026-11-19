/**
 * 🖨 The badges' print file wears ONLY the approved v84 art (owner 15 Nov: "THE BADGES IN THE APPROVED PROTOTYPE ARE THE
 * ONLY BADGES") — today's badges, nothing the shop has not earned, no retired pill.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgePrintSvg, printBadgeOps, printBadgeRef } from './shop-badge-print';
import { BUSY_PRINT_BADGES } from './print-badges-v84.fixture';
import { VERIFIED_V84_MARK } from './verified-v84-art';

test('one picture per badge, in print order, no <text> a print shop could lack the font for', () => {
  const svg = badgePrintSvg(BUSY_PRINT_BADGES);
  assert.deepEqual([...svg.matchAll(/data-badge="([^"]+)"/g)].map((m) => m[1]), ['top10', 'verified', 'completed_bookings', 'five_star_reviews']);
  assert.deepEqual([...svg.matchAll(/data-print-badge="([^"]+)"/g)].map((m) => m[1]), ['seal', 'verified', 'tier', 'tier']);
  assert.doesNotMatch(svg, /<text\b/);
  assert.ok(svg.includes(VERIFIED_V84_MARK), 'Setnayan Verified is the v84 blue check');
  assert.doesNotMatch(svg, /foil\d|data-tier=|milestone:|data-badge="(rating|years)"/, 'a retired pill printed');
  assert.match(svg, /^<\?xml/);
});

test('every badge stands at the file’s one height; nothing earned = nothing drawn', () => {
  const svg = badgePrintSvg(BUSY_PRINT_BADGES, { size: 100 });
  assert.match(svg, /height="100pt"/);
  assert.equal(badgePrintSvg([]).includes('data-print-badge'), false);
});

test('the PDF ops: Verified is vector, a tier or a seal is its picture by ref', () => {
  const [seal, verified, tier] = BUSY_PRINT_BADGES;
  assert.ok(printBadgeOps(verified!, 0, 0, 10).ops.every((o) => o.t === 'path'), 'Verified prints as the v84 vector');
  for (const a of [seal!, tier!]) {
    const { ops } = printBadgeOps(a, 0, 0, 10);
    assert.deepEqual(ops.map((o) => o.t), ['image']);
    assert.equal((ops[0] as { ref: string }).ref, printBadgeRef(a));
  }
});
