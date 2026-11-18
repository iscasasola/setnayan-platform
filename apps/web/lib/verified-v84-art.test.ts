/**
 * ✅ Every print that shows verification uses the APPROVED v84 Setnayan Verified (lib/verified-v84-art.ts) — owner
 * 17 Nov: "Prints did not use Setnayan Verified badge". And it is the prototype's own vector, not a redraw.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIED_V84_MARK, verifiedV84Body, verifiedV84Ops } from './verified-v84-art';
import { badgePrintSvg, badgePillOps } from './shop-badge-print';
import { verifiedBadge, milestoneBadge } from './shop-badges';

test('the art is the v84 drawing: its blue disc stops and its check, at the prototype geometry', () => {
  const b = verifiedV84Body('t', true);
  for (const bit of ['stop-color="#5C9BFF"', 'stop-color="#1F4CBA"', 'stop-color="#0B1D5A"', 'M35.5,45.5 L46,56 L65.5,34.5', 'M16,50 A34,34 0 1 1 84,50', '>VERIFIED</text>']) {
    assert.ok(b.includes(bit), `the v84 art lost ${bit}`);
  }
  assert.doesNotMatch(verifiedV84Body('t', false), /<text/, 'the print look carries letters a print file cannot set');
  assert.doesNotMatch(b, /b147_/, 'the ids are not made unique');
});

test('the badges print file draws the v84 Verified — and only for the Verified pill', () => {
  const withV = badgePrintSvg([verifiedBadge()]);
  assert.ok(withV.includes(VERIFIED_V84_MARK), 'the Verified pill prints without the v84 mark');
  assert.ok(withV.includes('M35.5,45.5 L46,56 L65.5,34.5'));
  const without = badgePrintSvg([milestoneBadge(10)]);
  assert.ok(!without.includes(VERIFIED_V84_MARK), 'a shop that is not verified prints the Verified mark');
});

test('the PDF ops draw the same v84 disc and check in flat ink', () => {
  const ops = badgePillOps(verifiedBadge(), 34, 0, 0).ops;
  assert.ok(verifiedV84Ops(0, 0, 10).some((o) => o.fill === '#1F4CBA'));
  assert.ok(ops.some((o) => o.t === 'path' && o.fill === '#1F4CBA'), 'the door sticker’s Verified pill has no v84 disc');
  assert.ok(ops.some((o) => o.t === 'path' && o.stroke === '#FFFFFF'), 'the door sticker’s Verified pill has no v84 check');
});
