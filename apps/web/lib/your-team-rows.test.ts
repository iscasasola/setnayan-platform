/**
 * your-team-rows.test.ts — each row on the phone's Your Team shows AT MOST ONE
 * next-step action, and that action comes from the REAL state, never a guess.
 *
 * Executed, not grepped: every branch of `teamRowOf` is driven from the same
 * raw facts the page reads (`event_vendors.status` · `lock_request_state` ·
 * `DepositStep` · the bench card's lock verdict · the review map · the
 * inquiry). If a branch starts offering "Pay" on a deposit the read could not
 * see, or "Lock" on a supplier the card withholds it from, this fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamRowOf, teamRows, teamCountsLine, initialsOf, type TeamRowFacts } from '@/lib/your-team-rows';

const CTX = { eventId: 'E', lockHandshakeEnabled: true, now: new Date('2027-01-01T00:00:00Z') };

function facts(over: Partial<TeamRowFacts> = {}): TeamRowFacts {
  return {
    vendorId: 'v1',
    name: 'Lumina Studio',
    service: 'Photo & video',
    logoUrl: null,
    status: 'considering',
    lockRequestState: null,
    lockRequestExpiresAt: null,
    inBuild: false,
    lockGroupId: null,
    lockBlocked: null,
    inquiryStatus: null,
    threadId: null,
    pricePhp: null,
    depositStep: null,
    reviewStatus: null,
    quoteWaitingOnCouple: false,
    ...over,
  };
}

const kindOf = (f: TeamRowFacts) => teamRowOf(f, CTX)?.action?.kind ?? null;

test('booked + deposit due → Pay, to the deposit card', () => {
  const r = teamRowOf(facts({ status: 'contracted', depositStep: 'due' }), CTX)!;
  assert.equal(r.group, 'booked');
  assert.equal(r.pill.text, 'Booked');
  assert.equal(r.next, 'pay your deposit');
  assert.deepEqual(r.action, {
    kind: 'pay',
    label: 'Pay',
    href: '/dashboard/E/vendors/v1/workspace?tab=payments#deposit',
  });
  assert.equal(r.needsYou, true);
});

test('booked + deposit refused → Pay again, and the pill says why', () => {
  const r = teamRowOf(facts({ status: 'contracted', depositStep: 'refused' }), CTX)!;
  assert.equal(r.action?.kind, 'pay');
  assert.equal(r.pill.text, 'Deposit not received');
});

test('a REFUSED deposit read is never "pay" — it is a neutral Check', () => {
  // depositStepOf returns `unknown` for a refused read. Telling a couple who
  // already paid to pay again is the failure-shaped-like-an-answer this repo
  // keeps fencing.
  const r = teamRowOf(facts({ status: 'contracted', depositStep: 'unknown' }), CTX)!;
  assert.equal(r.action?.kind, 'check');
  assert.equal(r.needsYou, false);
  assert.doesNotMatch(r.next, /pay/i);
});

test('booked + deposit sent → nothing to press; confirmed/deposit_paid → all set', () => {
  assert.equal(kindOf(facts({ status: 'contracted', depositStep: 'sent' })), null);
  assert.equal(teamRowOf(facts({ status: 'contracted', depositStep: 'sent' }), CTX)!.next, 'they confirm your deposit');
  assert.equal(kindOf(facts({ status: 'contracted', depositStep: 'confirmed' })), null);
  const paid = teamRowOf(facts({ status: 'deposit_paid' }), CTX)!;
  assert.equal(paid.action, null);
  assert.equal(paid.next, 'nothing — all set');
});

test('the deposit is read ONLY for contracted — deposit_paid never shows Pay', () => {
  // Mirrors the page: the Locked-QR path promotes to deposit_paid without
  // stamping deposit_recorded_at, so a stray step must not resurrect Pay.
  assert.equal(kindOf(facts({ status: 'deposit_paid', depositStep: 'due' })), null);
});

test('after the day, an OPEN review window → Review; submitted → all set', () => {
  const r = teamRowOf(facts({ status: 'complete', reviewStatus: 'open' }), CTX)!;
  assert.deepEqual(r.action, { kind: 'review', label: 'Review', href: '/dashboard/E/vendors/v1/review' });
  assert.equal(kindOf(facts({ status: 'complete', reviewStatus: 'submitted' })), null);
});

test('asked to lock → Waiting on THEM; Nudge opens the conversation', () => {
  const r = teamRowOf(
    facts({
      lockRequestState: 'pending',
      threadId: 't9',
      lockRequestExpiresAt: '2027-01-01T20:00:00Z',
    }),
    CTX,
  )!;
  assert.equal(r.group, 'asked');
  assert.equal(r.pill.text, 'Waiting');
  assert.match(r.next, /^they agree to your lock · 20 hours left to answer$/);
  assert.deepEqual(r.action, { kind: 'nudge', label: 'Nudge', href: '/dashboard/E/messages/t9' });
  assert.equal(r.needsYou, false, 'the ball is in the supplier’s court');
});

test('asked with no thread → no Nudge invented', () => {
  assert.equal(kindOf(facts({ lockRequestState: 'pending' })), null);
});

test('handshake flag OFF → a pending marker is not an ask (lockRequestStateOf decides)', () => {
  const off = { ...CTX, lockHandshakeEnabled: false };
  assert.equal(teamRowOf(facts({ lockRequestState: 'pending', threadId: 't' }), off), null);
});

test('in the build and lockable → Lock, with the price when there is one', () => {
  const r = teamRowOf(facts({ inBuild: true, lockGroupId: 'catering', pricePhp: 96000 }), CTX)!;
  assert.equal(r.pill.text, 'Quote in');
  assert.equal(r.next, 'lock the price — ₱96,000');
  assert.deepEqual(r.action, { kind: 'lock', label: 'Lock', groupId: 'catering' });
  const unpriced = teamRowOf(facts({ inBuild: true, lockGroupId: 'catering' }), CTX)!;
  assert.equal(unpriced.next, 'lock them in');
});

test('a quote waiting on the couple (not in the build) → Lock when the card offers it', () => {
  assert.equal(kindOf(facts({ quoteWaitingOnCouple: true, lockGroupId: 'music', pricePhp: 20000 })), 'lock');
  // …and never when the card withholds Lock (lockGroupId null).
  assert.equal(teamRowOf(facts({ quoteWaitingOnCouple: true, pricePhp: 20000 }), CTX), null);
});

test('in the build but blocked → no Lock, the reason named', () => {
  const r = teamRowOf(
    facts({ inBuild: true, lockGroupId: null, lockBlocked: 'inquiry_declined' }),
    CTX,
  )!;
  assert.equal(r.action, null);
  assert.match(r.next, /declined/i);
});

test('reached out, no answer → Waiting · they send a quote · Nudge', () => {
  const r = teamRowOf(facts({ inquiryStatus: 'pending', threadId: 't2' }), CTX)!;
  assert.equal(r.group, 'waiting');
  assert.equal(r.next, 'they send a quote');
  assert.equal(r.action?.kind, 'nudge');
});

test('a name on the bench nobody wrote to is NOT on the team', () => {
  assert.equal(teamRowOf(facts(), CTX), null);
  assert.equal(teamRowOf(facts({ inquiryStatus: 'declined', threadId: 't' }), CTX), null);
});

test('EVERY row carries at most one action, and a "need you" row always carries one', () => {
  const states: Partial<TeamRowFacts>[] = [
    { status: 'contracted', depositStep: 'due' },
    { status: 'contracted', depositStep: 'refused' },
    { status: 'contracted', depositStep: 'sent' },
    { status: 'contracted', depositStep: 'unknown' },
    { status: 'contracted', depositStep: 'confirmed' },
    { status: 'deposit_paid' },
    { status: 'complete', reviewStatus: 'open' },
    { lockRequestState: 'pending', threadId: 't' },
    { inBuild: true, lockGroupId: 'g' },
    { inBuild: true, lockBlocked: 'not_available' },
    { inquiryStatus: 'pending', threadId: 't' },
  ];
  for (const s of states) {
    const r = teamRowOf(facts(s), CTX)!;
    assert.ok(r, `expected a row for ${JSON.stringify(s)}`);
    assert.ok(r.next.length > 0, 'a row always says what happens next');
    if (r.needsYou) assert.ok(r.action, `a row that needs the couple must give them the button: ${JSON.stringify(s)}`);
  }
});

test('BOOKED suppliers come first, then asked, deciding, waiting — stable within a group', () => {
  const rows = teamRows(
    [
      facts({ vendorId: 'w', name: 'DJ Marco', inquiryStatus: 'pending', threadId: 't' }),
      facts({ vendorId: 'd', name: 'Kusina', inBuild: true, lockGroupId: 'g', pricePhp: 1 }),
      facts({ vendorId: 'b1', name: 'Lumina', status: 'contracted', depositStep: 'due' }),
      facts({ vendorId: 'a', name: 'Asked', lockRequestState: 'pending' }),
      facts({ vendorId: 'b2', name: 'Flores', status: 'deposit_paid' }),
      facts({ vendorId: 'b2', name: 'Flores (dupe)', status: 'deposit_paid' }),
    ],
    CTX,
  );
  assert.deepEqual(
    rows.map((r) => r.vendorId),
    ['b1', 'b2', 'a', 'd', 'w'],
  );
  assert.deepEqual(teamCountsLine(rows), { booked: 2, needYou: 2 });
});

test('initials for the logo square', () => {
  assert.equal(initialsOf('Lumina Studio'), 'LS');
  assert.equal(initialsOf('DJ'), 'DJ');
  assert.equal(initialsOf('  '), '·');
});
