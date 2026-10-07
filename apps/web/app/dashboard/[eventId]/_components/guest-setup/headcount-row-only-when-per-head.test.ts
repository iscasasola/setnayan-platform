/**
 * headcount-row-only-when-per-head.test.ts — the Headcount row renders only
 * when the list needs finalizing: a BOOKED supplier prices it per head
 * (owner 2026-10-07: *"Only for guestlist that needs finalization"*, G31).
 * `adaptive_pricing_mode` cannot decide it — it is NOT NULL DEFAULT 'realtime'
 * on every event (controller-approved deviation, `lib/headcount-row.ts`).
 *
 * 🛡 Sabotage: `showsHeadcountRow` returns true always → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anyPerHead, headcountMayFinalize, showsHeadcountRow } from '@/lib/headcount-row';
import { renderSetup } from './render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));

test('the rule: per-head booked → row + button; none → no row; unread → row, no button; locked → row, no button', () => {
  assert.equal(showsHeadcountRow({ perHeadBooked: false, locked: false }), false, 'no per-head booking = nothing to finalize');
  assert.equal(showsHeadcountRow({ perHeadBooked: true, locked: false }), true);
  assert.equal(headcountMayFinalize({ perHeadBooked: true, locked: false }), true);
  assert.equal(showsHeadcountRow({ perHeadBooked: null, locked: false }), true, 'a refused read never says "nothing to finalize"');
  assert.equal(headcountMayFinalize({ perHeadBooked: null, locked: false }), false, 'no money button on an unread fact');
  assert.equal(showsHeadcountRow({ perHeadBooked: false, locked: true }), true, 'a locked count stays visible');
  assert.equal(headcountMayFinalize({ perHeadBooked: true, locked: true }), false);
  assert.equal(anyPerHead(['fixed', 'per_hour']), false);
  assert.equal(anyPerHead(['fixed', 'per_pax']), true);
});

test('the page feeds the rule from the booked per-head read, never from adaptive_pricing_mode', () => {
  const panel = readFileSync(join(HERE, '..', '..', 'guests', 'invite', '_components', 'invite-panel.tsx'), 'utf8');
  assert.match(panel, /readPerHeadBooked\(/);
  assert.match(panel, /show: showsHeadcountRow\(gate\)/);
  assert.doesNotMatch(panel, /show:[^\n]*adaptive_pricing_mode/);
  const read = readFileSync(join(HERE, '..', '..', '..', '..', '..', 'lib', 'headcount-row.server.ts'), 'utf8');
  assert.match(read, /\.in\('status', COMMITTED_BOOKING_STATUSES/, 'only a BOOKED supplier counts');
  assert.match(read, /select\('pricing_basis'\)/);
});

test('rendered: the row is absent without it and present with it', async () => {
  const off = await renderSetup({ headcount: { show: showsHeadcountRow({ perHeadBooked: false, locked: false }) } });
  assert.ok(!off.includes('data-setup-row="headcount"'), 'Headcount drawn with no per-head booking');
  const on = await renderSetup({ headcount: { show: true, mayFinalize: true } });
  assert.ok(on.includes('data-setup-row="headcount"'));
  assert.match(on, /aria-label="Finalize now"/);
});
