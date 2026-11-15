/**
 * the-starter-step-counts-like-the-row.test.ts — RW-304b (14 Nov 2026, live on the owner's plan): the empty floor's
 * "Build my seating draft" step read "Seat your 4 guests" while the top row read "6 unseated". Both were true and
 * counted different people (the couple). The step now counts what the draft seats and, when that is not the row's
 * number, says the row's number and why. Held two ways: the pure rule, and the editor drawing it (not a copy).
 *
 * SABOTAGE (seen RED, then restored): the hint back to a bare `Seat your ${draftable} guests` with no row number ·
 * the editor's old `g.role !== 'bride' && g.role !== 'groom'` filter back in place of the helper.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { starterDraftHint } from './seat-plan-details';

const HERE = dirname(fileURLToPath(import.meta.url));
const COUPLE = new Set(['bride', 'groom']);
const g = (role: string, rsvp: string | null = 'attending', seated: string | null = null) => ({
  role,
  rsvp_status: rsvp,
  seated_table_id: seated,
});

test('4 guests + the couple: the step says 4 of the row’s 6, and why', () => {
  const r = starterDraftHint({
    guests: [g('bride'), g('groom'), g('guest'), g('guest', 'pending'), g('ninong'), g('guest', null), g('guest', 'declined')],
    coupleRoles: COUPLE,
  });
  assert.equal(r.unseated, 6, 'the row’s Unseated: everyone coming without a seat, the couple too');
  assert.equal(r.draftable, 4, 'the draft seats everyone coming but the couple');
  assert.match(r.hint, /^Seat 4 of your 6 unseated by role — you two pick your own table$/);
});

test('no couple on the list: one number, the same as the row', () => {
  const r = starterDraftHint({ guests: [g('guest'), g('guest')], coupleRoles: COUPLE });
  assert.equal(r.hint, 'Seat your 2 guests by role');
  assert.equal(r.unseated, r.draftable);
});

test('only the couple (or nobody coming): the step asks for guests', () => {
  assert.equal(starterDraftHint({ guests: [g('bride'), g('groom')], coupleRoles: COUPLE }).hint, 'Add guests first');
  assert.equal(starterDraftHint({ guests: [g('guest', 'declined')], coupleRoles: COUPLE }).hint, 'Add guests first');
});

test('the editor draws the helper’s words — no second count of its own', () => {
  const ed = readFileSync(join(HERE, '..', 'app', 'dashboard', '[eventId]', 'seating', '_components', 'seating-editor.tsx'), 'utf8');
  assert.match(ed, /starterDraftHint\(\{ guests, coupleRoles: roleSet\.coupleRoles \}\)/, 'the step counts its own way again');
  assert.match(ed, /label="Build my seating draft" hint=\{draftHint\}/, 'the step does not draw the helper’s hint');
  assert.doesNotMatch(ed, /g\.role !== 'bride' && g\.role !== 'groom'/, 'a hard-coded couple filter is back');
});
