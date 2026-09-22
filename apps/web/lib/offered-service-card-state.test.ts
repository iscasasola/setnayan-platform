/**
 * offered-service-card-state.test.ts — a quote replaces the offer, and the
 * offer survives as history.
 *
 * EXECUTES the decision. The owner's ruling has two halves and a test that
 * only checks the first would pass while the second was broken:
 *   · the quote REPLACES the offer  → it stops being actionable;
 *   · the offer is KEPT as history  → it is never removed, and says why.
 *
 * Sabotages watched red before commit:
 *   1. make a superseded card actionable again → "a replaced offer offers nothing" fails
 *   2. drop the tie case (`<=` → `<`)          → "a tie goes to the quote" fails
 *   3. supersede on a missing/unreadable date  → "unreadable data leaves it live" fails
 *   4. return `kind: 'removed'` / drop the note → "history is kept and labelled" fails
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  offeredServiceCardState,
  latestQuoteAtFrom,
} from '@/lib/offered-service-card-state';

const T0 = '2026-09-20T10:00:00.000Z';
const T1 = '2026-09-20T11:00:00.000Z';

test('no quote yet — the offer is live and actionable', () => {
  const s = offeredServiceCardState({ offeredAt: T0, latestQuoteAt: null });
  assert.equal(s.kind, 'live');
  assert.equal(s.actionable, true);
  assert.equal(s.note, null);
});

test('a quote after the offer replaces it — and the offer offers nothing', () => {
  const s = offeredServiceCardState({ offeredAt: T0, latestQuoteAt: T1 });
  assert.equal(s.kind, 'superseded');
  assert.equal(s.actionable, false, 'a replaced offer must not still be actionable');
});

test('history is KEPT and LABELLED — replaced is not removed', () => {
  const s = offeredServiceCardState({ offeredAt: T0, latestQuoteAt: T1 });
  // The mitigation is half the ruling: the card stays and says why.
  assert.notEqual(s.kind as string, 'removed', 'the card must never resolve to removed');
  assert.notEqual(s.kind as string, 'hidden');
  assert.equal(typeof s.note, 'string');
  assert.ok((s.note ?? '').length > 0, 'a superseded card must say why');
  assert.match(s.note as string, /replaced/i);
});

test('a quote BEFORE the offer does not replace it', () => {
  const s = offeredServiceCardState({ offeredAt: T1, latestQuoteAt: T0 });
  assert.equal(s.kind, 'live', 'an older quote cannot retire a newer offer');
  assert.equal(s.actionable, true);
});

test('a tie goes to the quote — it is the card that carries money', () => {
  const s = offeredServiceCardState({ offeredAt: T0, latestQuoteAt: T0 });
  assert.equal(s.kind, 'superseded');
});

test('unreadable or missing data leaves the card LIVE — an absence is not a quote', () => {
  for (const bad of [null, undefined, '', 'not-a-date', 'yesterday']) {
    assert.equal(
      offeredServiceCardState({ offeredAt: T0, latestQuoteAt: bad }).kind,
      'live',
      `latestQuoteAt=${String(bad)} must not retire the offer`,
    );
    assert.equal(
      offeredServiceCardState({ offeredAt: bad, latestQuoteAt: T1 }).kind,
      'live',
      `offeredAt=${String(bad)} must not retire the offer`,
    );
  }
});

test('latestQuoteAtFrom picks the newest quote, ignoring order and non-quotes', () => {
  const msgs = [
    { created_at: T1, proposal_id: 'p2' },
    { created_at: '2026-09-20T09:00:00.000Z', proposal_id: null },
    { created_at: T0, proposal_id: 'p1' },
    { created_at: '2026-09-20T23:00:00.000Z' },
  ];
  assert.equal(latestQuoteAtFrom(msgs), T1, 'newest QUOTE, not newest message');
  assert.equal(latestQuoteAtFrom([]), null);
  assert.equal(latestQuoteAtFrom([{ created_at: T0, proposal_id: null }]), null);
  assert.equal(
    latestQuoteAtFrom([{ created_at: 'junk', proposal_id: 'p1' }]),
    null,
    'an unreadable date is not a newest quote',
  );
});

test('end to end: the newest quote is what decides, not the newest message', () => {
  const messages = [
    { created_at: T0, proposal_id: null },              // the offer's own message
    { created_at: T1, proposal_id: 'p1' },              // the quote
    { created_at: '2026-09-21T08:00:00.000Z' },         // later chatter, no quote
  ];
  const s = offeredServiceCardState({
    offeredAt: T0,
    latestQuoteAt: latestQuoteAtFrom(messages),
  });
  assert.equal(s.kind, 'superseded');
  assert.equal(s.note, 'Replaced by a quote');
});
