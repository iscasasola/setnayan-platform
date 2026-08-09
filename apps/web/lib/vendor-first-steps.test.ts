/**
 * Guards for the vendor order-of-operations rail.
 *
 * WHY THESE ARE TESTS AND NOT COMMENTS. The rail's whole value is that it tells a
 * new vendor ONE true thing to do next. Three ways that silently stops being
 * true, each of which looks completely fine on screen:
 *
 *  1. TWO steps marked `now`. The rail stops being an order and becomes a menu —
 *     which is the state the owner asked us to replace.
 *  2. `go_live` offered as an action. A vendor cannot approve their own shop, so
 *     a button there is a lie shaped like a button. It must never be `now`.
 *  3. The rail going quiet while documents are under review. Nothing is
 *     pressable on the documents step for up to 5 working days; if the rail
 *     simply stops, the vendor is told to wait when there is real, free work
 *     they could be doing. `waiting` must be SKIPPED, not terminal.
 *
 * Plus the two conditions that came out of reading the live code rather than the
 * spec: a hand-verified shop (admin one-click, no application ever filed) must
 * not be nagged for paperwork, and the documents blocker must quote the server's
 * own refusal instead of a second hand-written copy of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFirstStepsRail,
  type FirstStepsInput,
  type FirstStepKey,
} from './vendor-first-steps';

/** A brand-new shop the minute after /open-shop redirects it. */
const FRESH: FirstStepsInput = {
  verified: false,
  profileDone: 4,
  profileTotal: 8,
  serviceCount: 0,
  docsStatus: 'none',
  docsIn: 0,
  docsTotal: 12,
  submitMissing: ['Finish your business profile'],
  customerCount: 0,
};

function stateOf(input: FirstStepsInput, key: FirstStepKey) {
  return buildFirstStepsRail(input).steps.find((s) => s.key === key)?.state;
}

test('at most one step is ever `now`', () => {
  const cases: FirstStepsInput[] = [
    FRESH,
    { ...FRESH, profileDone: 8 },
    { ...FRESH, profileDone: 8, serviceCount: 2, submitMissing: [] },
    { ...FRESH, profileDone: 8, serviceCount: 2, docsStatus: 'pending_review', submitMissing: [] },
    { ...FRESH, profileDone: 8, serviceCount: 2, docsStatus: 'in_review', customerCount: 3, submitMissing: [] },
    { ...FRESH, profileDone: 8, serviceCount: 2, docsStatus: 'approved', customerCount: 3, verified: true, submitMissing: [] },
    { ...FRESH, docsStatus: 'rejected', rejectionReason: 'Permit expired' },
  ];
  for (const input of cases) {
    const rail = buildFirstStepsRail(input);
    const nowCount = rail.steps.filter((s) => s.state === 'now').length;
    assert.ok(nowCount <= 1, `expected ≤1 \`now\`, got ${nowCount}`);
    // And `current` must agree with the array rather than being computed twice.
    assert.equal(rail.current?.state ?? null, nowCount === 1 ? 'now' : null);
  }
});

test('the first unfinished step is the one recommended', () => {
  assert.equal(stateOf(FRESH, 'shop_details'), 'now');
  // Everything after it is reachable but not recommended.
  assert.equal(stateOf(FRESH, 'service_card'), 'later');
  assert.equal(stateOf(FRESH, 'documents'), 'later');
});

test('finishing a step promotes the next one, in order', () => {
  const profileIn = { ...FRESH, profileDone: 8, submitMissing: [] };
  assert.equal(stateOf(profileIn, 'shop_details'), 'done');
  assert.equal(stateOf(profileIn, 'service_card'), 'now');

  const serviceIn = { ...profileIn, serviceCount: 1 };
  assert.equal(stateOf(serviceIn, 'service_card'), 'done');
  assert.equal(stateOf(serviceIn, 'documents'), 'now');
});

test('while documents are under review the rail hands over free work, not silence', () => {
  for (const docsStatus of ['pending_review', 'in_review'] as const) {
    const waiting: FirstStepsInput = {
      ...FRESH,
      profileDone: 8,
      serviceCount: 1,
      docsStatus,
      docsIn: 12,
      submitMissing: [],
    };
    assert.equal(stateOf(waiting, 'documents'), 'waiting');
    // The skip is the point: the vendor gets something they CAN do today.
    assert.equal(stateOf(waiting, 'own_customers'), 'now');
  }
});

test('go-live is never presented as something the vendor can press', () => {
  // ⚠ THE STATE HERE IS LOAD-BEARING AND THE OBVIOUS ONE DOES NOT TEST ANYTHING.
  // A first cut used docsStatus 'pending_review' — under which go_live is
  // `waiting` and returns BEFORE the guard is ever consulted. Deleting the guard
  // left that version green, which is how a decorative test looks from the
  // inside. go_live only reaches the guard when it is neither done nor waiting:
  // application APPROVED but the shop not yet flipped verified — a real
  // transient, since the two are separate writes on the admin approve path.
  const approvedNotYetFlipped: FirstStepsInput = {
    ...FRESH,
    verified: false,
    profileDone: 8,
    serviceCount: 1,
    docsStatus: 'approved',
    docsIn: 12,
    customerCount: 5,
    submitMissing: [],
  };
  const rail = buildFirstStepsRail(approvedNotYetFlipped);
  const goLive = rail.steps.find((s) => s.key === 'go_live');
  // Every other step is done, so without the guard go_live would be handed the
  // `now` badge and a call-to-action for something only an admin can do.
  assert.equal(goLive?.state, 'later');
  assert.equal(goLive?.href, null);
  assert.equal(goLive?.cta, null);
  assert.equal(rail.current, null);
});

test('nothing is recommended while the shop is genuinely waiting on Setnayan', () => {
  const rail = buildFirstStepsRail({
    ...FRESH,
    profileDone: 8,
    serviceCount: 1,
    docsStatus: 'in_review',
    docsIn: 12,
    customerCount: 5,
    submitMissing: [],
  });
  // Documents waiting, everything the vendor CAN do already done → silence is
  // the honest answer. The rail must not manufacture a task to fill the gap.
  assert.equal(rail.current, null);
  assert.equal(rail.steps.find((s) => s.key === 'documents')?.state, 'waiting');
});

test('a shop verified by hand is not nagged for paperwork it was never asked for', () => {
  // The /admin/verify one-click path sets the shop verified without any
  // application row ever existing. Reading `docsStatus` alone would leave the
  // documents step permanently unfinished on a live, approved shop.
  const handVerified: FirstStepsInput = {
    ...FRESH,
    verified: true,
    profileDone: 8,
    serviceCount: 1,
    docsStatus: 'none',
    docsIn: 0,
    submitMissing: [],
  };
  assert.equal(stateOf(handVerified, 'documents'), 'done');
  assert.equal(stateOf(handVerified, 'go_live'), 'done');
  assert.equal(buildFirstStepsRail(handVerified).complete, true);
});

test('the documents blocker quotes the server refusal, never a second copy of it', () => {
  // `verificationSubmitMissing` is the one source of truth for why Submit is
  // refused. Hand-writing the same sentence here is how the screen and the
  // server drift apart without either being wrong on its own.
  const rail = buildFirstStepsRail({
    ...FRESH,
    submitMissing: ['Finish your business profile', 'Add your government registration number'],
  });
  const docs = rail.steps.find((s) => s.key === 'documents');
  assert.equal(docs?.blockedBy, 'Finish your business profile');

  // Profile complete → the server would accept, so nothing is claimed to block.
  const unblocked = buildFirstStepsRail({ ...FRESH, profileDone: 8, submitMissing: [] });
  assert.equal(unblocked.steps.find((s) => s.key === 'documents')?.blockedBy, null);
});

test('a rejected application asks for a resend and carries the reason', () => {
  const rejected = buildFirstStepsRail({
    ...FRESH,
    profileDone: 8,
    serviceCount: 1,
    docsStatus: 'rejected',
    docsIn: 12,
    submitMissing: [],
    rejectionReason: 'Business permit expired',
  });
  const docs = rejected.steps.find((s) => s.key === 'documents');
  assert.equal(docs?.state, 'now');
  assert.equal(docs?.cta, 'Send them again');
  assert.ok(docs?.body.includes('Business permit expired'));
});

test('the rail counts only what is genuinely done', () => {
  assert.equal(buildFirstStepsRail(FRESH).doneCount, 0);
  const live = buildFirstStepsRail({
    ...FRESH,
    verified: true,
    profileDone: 8,
    serviceCount: 1,
    docsStatus: 'approved',
    docsIn: 12,
    customerCount: 2,
    submitMissing: [],
  });
  assert.equal(live.doneCount, 5);
  assert.equal(live.total, 5);
});

test('steps stay in their published order', () => {
  // The numbers are printed on screen; a reorder that leaves them stale reads as
  // a broken list rather than a changed one.
  const rail = buildFirstStepsRail(FRESH);
  assert.deepEqual(
    rail.steps.map((s) => s.key),
    ['shop_details', 'service_card', 'documents', 'own_customers', 'go_live'],
  );
  assert.deepEqual(rail.steps.map((s) => s.n), [1, 2, 3, 4, 5]);
});
