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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  offeredServiceCardState,
  latestQuoteAtFrom,
  quoteCoversCards,
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

/* ───────────────────────────────────────────────────────────────────────────
   A QUOTE SUPERSEDES ONLY THE CARDS IT WAS BUILT FROM (2026-09-22).

   The rule above decides from two timestamps, so it retires offers no quote
   ever covered. Measured against the shipped code before this change:

     offer PHOTO · offer VIDEO · one quote built from PHOTO
       PHOTO -> superseded    (right)
       VIDEO -> superseded    (wrong — retired by a quote that never covered it)

   `vendor_proposals.service_card_ids` (migration 20271243019419) is the record
   that was always available at compose time and never stored.

   Sabotages watched red before commit:
     1. drop the `forCardId` filter entirely        → "only the cards it was built from" fails
     2. treat a null/unreadable list as "covers nothing" → "silence still counts" fails
     3. treat `[]` as "never said"                  → "an empty list is a statement" fails
   ─────────────────────────────────────────────────────────────────────────── */

const PHOTO = 'card-photo';
const VIDEO = 'card-video';

test('quoteCoversCards tells "never said" apart from "covers nothing"', () => {
  assert.equal(quoteCoversCards(null), null, 'null = never said');
  assert.equal(quoteCoversCards(undefined), null);
  assert.equal(quoteCoversCards('not json'), null, 'unreadable = never said, never "covers nothing"');
  assert.equal(quoteCoversCards({ a: 1 }), null, 'a non-array is not a statement');
  assert.deepEqual(quoteCoversCards([]), [], 'an empty list IS a statement');
  assert.deepEqual(quoteCoversCards([PHOTO, VIDEO]), [PHOTO, VIDEO]);
  assert.deepEqual(quoteCoversCards(JSON.stringify([PHOTO])), [PHOTO], 'jsonb may arrive as text');
  assert.deepEqual(quoteCoversCards([PHOTO, '', null, 7]), [PHOTO], 'junk entries are dropped');
});

test('a quote supersedes only the cards it was built from — THE DEFECT', () => {
  const messages = [
    { message_id: 'm1', offered_service_id: PHOTO, proposal_id: null, created_at: T0 },
    { message_id: 'm2', offered_service_id: VIDEO, proposal_id: null, created_at: T0 },
    { message_id: 'm3', proposal_id: 'q1', created_at: T1, service_card_ids: [PHOTO] },
  ];

  const photo = offeredServiceCardState({
    offeredAt: T0,
    latestQuoteAt: latestQuoteAtFrom(messages, PHOTO),
  });
  assert.equal(photo.kind, 'superseded', 'the card the quote WAS built from is replaced');

  const video = offeredServiceCardState({
    offeredAt: T0,
    latestQuoteAt: latestQuoteAtFrom(messages, VIDEO),
  });
  assert.equal(
    video.kind,
    'live',
    'an offer the quote never covered was retired — the mitigation "a view must not be destroyed" failing',
  );
  assert.equal(video.actionable, true, 'and it must still be actionable');
});

test('silence still counts — a quote that never said supersedes as it always did', () => {
  // Every quote written before migration 20271243019419 has NULL here. Treating
  // that as "covers nothing" would make stale offers look live again, which is
  // the one mistake this file says can make someone act on the wrong number.
  for (const said of [undefined, null, 'not json', { not: 'an array' }]) {
    const messages = [{ proposal_id: 'q1', created_at: T1, service_card_ids: said }];
    assert.equal(
      latestQuoteAtFrom(messages, VIDEO),
      T1,
      `a quote whose card list is ${JSON.stringify(said) ?? 'undefined'} stopped counting`,
    );
  }
});

test('an empty list is a statement: a from-scratch quote supersedes nothing', () => {
  const messages = [{ proposal_id: 'q1', created_at: T1, service_card_ids: [] }];
  assert.equal(latestQuoteAtFrom(messages, VIDEO), null, '[] means it covered no card');
  assert.equal(
    offeredServiceCardState({ offeredAt: T0, latestQuoteAt: latestQuoteAtFrom(messages, VIDEO) }).kind,
    'live',
  );
});

test('passing no card reproduces the old behaviour exactly', () => {
  // The existing call site passes no card, so it must be byte-for-byte the old
  // answer until the stream is wired. This is what makes the change additive.
  const messages = [
    { proposal_id: 'q1', created_at: T0, service_card_ids: [PHOTO] },
    { proposal_id: 'q2', created_at: T1, service_card_ids: [] },
  ];
  assert.equal(latestQuoteAtFrom(messages), T1, 'unfiltered, the newest quote wins regardless of cards');
  assert.equal(latestQuoteAtFrom(messages, PHOTO), T0, 'filtered, only the covering quote counts');
});

test('the stream ASKS for the cards, and hands the rule the offer it is drawing', () => {
  /* The rule is pure and tested above, but it can only be as right as its
     inputs. Both halves of the wiring live in a client component that no unit
     test can import, so they are asserted from source — and this is the exact
     layer that silently dropped a column on the quote-revision read earlier
     today: the query stopped asking, the value arrived undefined, and every
     pure test stayed green. */
  const stream = readFileSync(join(process.cwd(), 'app/_components/chat-message-stream.tsx'), 'utf8');

  assert.match(
    stream,
    /service_card_ids',?\s*\n?\s*\)/,
    'the proposal read stopped asking for service_card_ids — every quote then reads as ' +
      '"never said" and the per-card rule silently degrades to the thread-wide one',
  );
  assert.match(
    stream,
    /latestQuoteAtFrom\(quoteCoverage,\s*m\.offered_service_id\)/,
    'the rule is no longer told WHICH offer it is deciding about, so it is back to ' +
      'superseding every offer in the thread',
  );
  assert.match(
    stream,
    /serviceCardIds: p\.service_card_ids/,
    'the fetched ids never reach the card data, so quoteCoverage carries undefined for all',
  );
});
