/**
 * the-desk-answers-and-the-news-does-not.test.ts
 *
 * The heading on the Today page now promises something: everything under
 * "Needs your answer" is a thing the supplier can answer. This guard makes the
 * promise keepable.
 *
 * ─── IT EXECUTES THE RULE, IT DOES NOT GREP FOR IT ───────────────────────
 * `vendor-overview.ts` is `server-only`, so a unit test cannot call into it.
 * That is exactly why the rule lives in the pure sibling
 * `vendor-desk-disposition.ts` — this file RUNS `deskDisposition` over one real
 * card of every kind instead of asserting that some string appears in a source
 * file. A source scan would still pass if the switch returned the wrong side.
 *
 * ─── THE FIXTURE IS THE FLOOR, AND TYPESCRIPT HOLDS IT ───────────────────
 * `SAMPLES` is a `Record<WhatsNewCard['kind'], …>`. Add a twelfth kind to the
 * union and this file stops COMPILING until somebody writes a card for it and
 * decides which side it belongs on. A hand-typed list of kind names would
 * instead have gone quietly stale — the failure this repo has already paid for
 * in a re-listed CHECK vocabulary.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { WhatsNewCard } from './vendor-overview';
import {
  deskDisposition,
  splitDesk,
  oldestAskWaitDays,
  deskStatusLine,
} from './vendor-desk-disposition';

const T0 = '2026-09-01T00:00:00.000Z';
const NOW = new Date('2026-09-22T00:00:00.000Z');

/** One real card per kind. Typed as a total Record — see the docblock. */
const SAMPLES: Record<WhatsNewCard['kind'], WhatsNewCard> = {
  mark_complete: {
    kind: 'mark_complete',
    id: 'c-done',
    eventVendorId: 'ev-1',
    eventId: 'e-1',
    eventName: 'The Santos wedding',
    eventDate: '2026-08-30',
    createdAt: T0,
  },
  inquiry: {
    kind: 'inquiry',
    id: 'c-inq',
    threadId: 't1',
    title: 'New inquiry — New customer',
    descriptor: 'A couple planning a wedding',
    eventDate: null,
    place: null,
    category: null,
    paxAtInquiry: null,
    messageExcerpt: null,
    createdAt: T0,
  },
  lock_request: {
    kind: 'lock_request',
    id: 'c-lr',
    eventId: 'e1',
    eventVendorId: 'ev1',
    coupleName: 'Ana & Miguel',
    eventDate: null,
    requestedAt: T0,
    expiresAt: null,
  },
  delete_request: {
    kind: 'delete_request',
    id: 'c-dr',
    eventId: 'e1',
    eventVendorId: 'ev1',
    eventDate: null,
    requestedAt: T0,
  },
  lock: {
    kind: 'lock',
    id: 'c-lk',
    eventId: 'e1',
    eventVendorId: 'ev1',
    coupleName: 'Ana & Miguel',
    eventDate: null,
    proofUrl: null,
    recordedAt: T0,
  },
  lock_request_lapsed: {
    kind: 'lock_request_lapsed',
    id: 'c-lrl',
    eventId: 'e1',
    eventVendorId: 'ev1',
    coupleName: 'Ana & Miguel',
    eventDate: null,
    requestedAt: T0,
    expiresAt: null,
  },
  review: {
    kind: 'review',
    id: 'c-rv',
    reviewId: 'r1',
    coupleName: 'Tala & Migo',
    quote: null,
    rating: 5,
    createdAt: T0,
  },
  dispute: {
    kind: 'dispute',
    id: 'c-dp',
    eventId: 'e1',
    eventName: 'Lim wedding',
    label: null,
    createdAt: T0,
    threadHref: null,
  },
  message: {
    kind: 'message',
    id: 'c-ms',
    threadId: 't1',
    eventId: 'e1',
    coupleName: 'Rosa & Ben',
    excerpt: null,
    lastMessageAt: T0,
  },
  meeting: {
    kind: 'meeting',
    id: 'c-mt',
    appointmentId: 'a1',
    eventId: 'e1',
    vendorProfileId: 'v1',
    coupleName: 'Maria & Jose',
    label: 'Tasting',
    meetingKind: 'video',
    location: null,
    scheduledAt: null,
    durationMin: null,
    proposedAt: T0,
    passed: false,
  },
  quote_draft: {
    kind: 'quote_draft',
    id: 'c-qd',
    proposalId: 'p1',
    publicId: null,
    eventId: null,
    title: 'Live band',
    totalCentavos: null,
    createdAt: T0,
  },
  contract_draft: {
    kind: 'contract_draft',
    id: 'c-cd',
    contractId: 'ct1',
    eventId: 'e1',
    title: 'Booking contract',
    createdAt: T0,
  },
};

/**
 * The kinds that render NO control, checked against the three card bodies that
 * carry none: `LockRequestLapsedBody`, a passed meeting, and `DisputeBody`.
 * Written out here on purpose — if a future change makes one of these
 * answerable, this list is where somebody has to say so out loud.
 */
const NEWS_KINDS = ['lock_request_lapsed', 'dispute'] as const;

test('every card kind lands on one side, and the silent ones land on news', () => {
  const kinds = Object.keys(SAMPLES) as WhatsNewCard['kind'][];
  // FLOORED. The union has had 11 kinds since 2026-09; a fixture that shrinks
  // below that is guarding less than it claims to.
  assert.ok(
    kinds.length >= 11,
    `expected at least 11 card kinds in the fixture, read ${kinds.length}: ${kinds.join(', ')}`,
  );

  for (const kind of kinds) {
    const side = deskDisposition(SAMPLES[kind]);
    assert.ok(
      side === 'answer' || side === 'news',
      `'${kind}' was classified '${side}', which is neither side`,
    );
  }

  for (const kind of NEWS_KINDS) {
    assert.equal(
      deskDisposition(SAMPLES[kind]),
      'news',
      `'${kind}' renders no control, so putting it under "Needs your answer" promises a button that is not there`,
    );
  }

  // A live proposal is an ask; the same card once its time has gone is not.
  const live = SAMPLES.meeting as Extract<WhatsNewCard, { kind: 'meeting' }>;
  assert.equal(deskDisposition({ ...live, passed: false }), 'answer');
  assert.equal(
    deskDisposition({ ...live, passed: true }),
    'news',
    'a meeting whose time has passed still offers Accept — it would ask the supplier to agree to yesterday',
  );
});

test('the split keeps every card, and keeps the order it was given', () => {
  const feed = [
    SAMPLES.lock_request,
    SAMPLES.dispute,
    SAMPLES.lock,
    SAMPLES.lock_request_lapsed,
    SAMPLES.message,
  ];
  const { answer, news } = splitDesk(feed);

  assert.equal(
    answer.length + news.length,
    feed.length,
    'the split dropped a card — a supplier would lose an answer with no error',
  );
  assert.deepEqual(
    answer.map((c) => c.id),
    ['c-lr', 'c-lk', 'c-ms'],
    'the answer half changed order — the feed arrives oldest-first and this must not re-sort it',
  );
  assert.deepEqual(news.map((c) => c.id), ['c-dp', 'c-lrl']);
});

test('the heading counts what is on screen, and says nothing over an empty set', () => {
  const waitedAt = (c: WhatsNewCard) =>
    new Date((c as { requestedAt?: string; createdAt?: string }).requestedAt
      ?? (c as { createdAt?: string }).createdAt
      ?? T0);

  // 21 days between 2026-09-01 and 2026-09-22.
  assert.equal(oldestAskWaitDays([SAMPLES.lock_request], waitedAt, NOW), 21);

  /*
    🔴 NOT ZERO. An empty desk has no oldest wait, and "oldest 0 days" is a
    measurement of nothing presented as a measurement of something — the exact
    shape this repo keeps paying for, where a refused read and an empty list
    render identically.
  */
  assert.equal(
    oldestAskWaitDays([], waitedAt, NOW),
    null,
    'an empty ask list reported an oldest wait',
  );
  assert.equal(deskStatusLine(0, null), '', 'an empty desk still printed a count');

  assert.equal(deskStatusLine(3, 4), '3 waiting · oldest 4 days');
  assert.equal(deskStatusLine(1, 1), '1 waiting · oldest 1 day', 'the singular day is pluralised');
  assert.equal(deskStatusLine(2, 0), '2 waiting · oldest today');
});

test('the count in the heading is the length of the list under it', () => {
  const feed = [SAMPLES.lock_request, SAMPLES.dispute, SAMPLES.message];
  const { answer } = splitDesk(feed);
  const line = deskStatusLine(answer.length, 4);
  assert.ok(
    line.startsWith(`${answer.length} waiting`),
    `the heading said "${line}" over a list of ${answer.length} — the count and the list are two answers to one question`,
  );
  assert.ok(
    !line.startsWith(`${feed.length} waiting`),
    'the heading is counting the whole feed again, including the cards that moved to "Nothing to answer"',
  );
});
