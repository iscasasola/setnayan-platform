/**
 * planner-seats.test.ts — the hired planner's seat shows on THEIR supplier
 * workspace, and a seat no booking claims is never left with no screen (the
 * Hosts fold, 2026-09-30; see planner-seats.ts for the prod measurement).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { plannerSeatsForVendor, PLANNER_SEAT_ROLE } from '@/lib/planner-seats';

const seat = (id: string, email: string | null, role = PLANNER_SEAT_ROLE) => ({
  id,
  role_subtype: role,
  invitation_email: email,
});

test('a seat invited at this booking’s email is this booking’s — case and spaces aside', () => {
  const seats = [seat('a', ' Plan@Acme.ph '), seat('b', 'other@x.ph')];
  const mine = plannerSeatsForVendor(seats, 'plan@acme.ph', ['plan@acme.ph', 'other@x.ph']);
  assert.deepEqual(mine.map((s) => s.id), ['a']);
});

test('a seat another planner booking claims is not shown here', () => {
  const seats = [seat('b', 'other@x.ph')];
  assert.deepEqual(plannerSeatsForVendor(seats, 'plan@acme.ph', ['plan@acme.ph', 'other@x.ph']), []);
});

test('a seat NO booking claims (no email, or an unknown one) shows on every planner workspace', () => {
  const seats = [seat('noemail', null), seat('stray', 'old@gone.ph')];
  assert.deepEqual(
    plannerSeatsForVendor(seats, 'plan@acme.ph', ['plan@acme.ph']).map((s) => s.id),
    ['noemail', 'stray'],
  );
  assert.deepEqual(
    plannerSeatsForVendor(seats, null, [null]).map((s) => s.id),
    ['noemail', 'stray'],
    'a booking with no email still shows the unclaimed seats',
  );
});

test('only the hired planner’s seats — never a co-host’s or a helper’s', () => {
  const seats = [seat('bride', 'plan@acme.ph', 'bride'), seat('helper', null, 'viewer'), seat('p', 'plan@acme.ph')];
  assert.deepEqual(plannerSeatsForVendor(seats, 'plan@acme.ph', ['plan@acme.ph']).map((s) => s.id), ['p']);
});
