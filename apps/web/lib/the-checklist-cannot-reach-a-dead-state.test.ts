/**
 * the-checklist-cannot-reach-a-dead-state.test.ts — CTRL-B3 build 4.
 *
 * Production 2026-09-22: `event_vendors.status` holds `considering` 34 ·
 * `contracted` 14 · `deposit_paid` 3. **Zero `shortlisted`.** Its only writer,
 * `lib/reusable-bookings.server.ts`, is behind
 * `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED`, absent from production — so
 * `one_option` and `searching` have never been rendered.
 *
 * 🔑 NEITHER OF THE BRIEF'S TWO ANSWERS FITS. Making it reachable is a
 * production flag, which is the owner's. Deleting the arms would break the
 * feature silently the day the flag is flipped — reusable bookings would mint
 * `shortlisted` rows and the checklist would report `not_started` about a
 * category the couple is actively comparing.
 *
 * So this binds the dead states to the switch that revives them, and asserts
 * BOTH ENDS: that the writer still exists, and that nothing else can produce
 * them. A dead branch nobody wrote down is the defect; one bound to its switch
 * is a feature waiting.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  resolveCategoryState,
  FLAG_DEPENDENT_STATES,
  SHORTLISTED_REQUIRES_FLAG,
  type CategoryDecisionState,
} from '@/lib/checklist-state';

const HERE = dirname(fileURLToPath(import.meta.url));
const readCode = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));
const v = (status: string) => ({ status });

/** Every status production actually holds today. */
const LIVE_STATUSES = ['considering', 'contracted', 'deposit_paid'];

// SABOTAGE: return 'one_option' for a single 'considering' vendor → RED.
test('no combination of LIVE statuses can reach a flag-dependent state', () => {
  const reached = new Set<CategoryDecisionState>();
  for (const a of LIVE_STATUSES) {
    reached.add(resolveCategoryState(null, [v(a)]));
    for (const b of LIVE_STATUSES) {
      reached.add(resolveCategoryState(null, [v(a), v(b)]));
    }
  }
  reached.add(resolveCategoryState(null, []));
  for (const dead of FLAG_DEPENDENT_STATES) {
    assert.ok(
      !reached.has(dead),
      `${dead} was reached from statuses production actually holds — either the flag shipped, or this state is no longer flag-dependent and the docs above it are now wrong`,
    );
  }
  assert.ok(reached.has('needs_more_options'), 'the reachable sibling must still work');
  assert.ok(reached.has('in_progress'), 'and so must the booked path');
});

// SABOTAGE: delete the one_option/searching arms → RED.
test('…but the moment a shortlisted row exists, they ARE reached', () => {
  assert.equal(
    resolveCategoryState(null, [v('shortlisted')]),
    'one_option',
    'deleting these arms would break reusable bookings silently the day the flag flips — the checklist would say not_started about a category the couple is comparing',
  );
  assert.equal(
    resolveCategoryState(null, [v('shortlisted'), v('shortlisted')]),
    'searching',
  );
});

// SABOTAGE: remove the shortlisted INSERT from reusable-bookings.server.ts → RED.
test('the writer that revives them still exists, behind the flag named here', () => {
  const writer = readCode('lib/reusable-bookings.server.ts');
  assert.match(
    writer,
    /status: 'shortlisted'/,
    'if the only writer of shortlisted is gone, these states are dead for good and the arms above should go with it — do not leave a branch with no possible producer',
  );
  const gate = readCode('lib/reusable-bookings.ts');
  assert.ok(
    gate.includes(SHORTLISTED_REQUIRES_FLAG),
    `the flag named in checklist-state (${SHORTLISTED_REQUIRES_FLAG}) is not the one gating the writer — the coupling this file exists to pin would be pointing at nothing`,
  );
});
