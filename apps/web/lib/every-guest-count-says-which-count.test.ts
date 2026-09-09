/**
 * EVERY GUEST COUNT SAYS WHICH GUEST COUNT IT IS.
 *
 * ── WHAT BROKE ──────────────────────────────────────────────────────────────
 * A conversation stores two headcounts — `pax_at_inquiry` (what the couple
 * asked with, what a quote is written against) and the live count (what they
 * are planning now). The supplier's thread page showed BOTH, in different
 * places, and only one of them said so: the header read "planning for ~170
 * guests · was 150 at inquiry" while the accept card, four hundred lines away,
 * rendered a bare "150 pax". The owner caught it on a drawing.
 *
 * 🔑 MONEY RIDES ON IT — a supplier quotes against one number and is paid
 * against the other, which is why a "guest count changed — accept or hold your
 * price" card already exists.
 *
 * ── WHAT IS PINNED, AND WHY IT IS PINNED THIS WAY ───────────────────────────
 * Two halves, and the negative one is the one that matters:
 *
 *   • POSITIVE: each of the four surfaces goes through the shared helper. A
 *     surface can be checked by name.
 *   • NEGATIVE: the RAW COLUMNS may only appear on lines that hand them to the
 *     helper or to a fetcher. Any other line mentioning `pax_at_inquiry` or
 *     `pax_current` is a fifth surface inventing a sixth wording — which is
 *     exactly how the fourth one got here. The allow-list is by LINE and its
 *     size is asserted, so adding a render site fails even if it is spelled
 *     differently than anything anticipated here.
 *
 * ⚠ IT SCANS THE STRIPPED SOURCE, because this file and the page both talk
 * about the columns at length and a guard that matches its own explanation
 * guards nothing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  guestCountChip,
  guestCountLine,
  guestCountRow,
  readGuestCount,
} from '@/lib/guest-count-provenance';
import { buildCustomerEventSummary } from '@/lib/customer-event-summary';

const WEB = join(import.meta.dirname, '..');
const THREAD = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const MAKER = 'app/_components/proposal-maker.tsx';
const RAIL = 'app/vendor-dashboard/messages/[threadId]/_components/chat-info-rail.tsx';

const threadSrc = stripComments(readFileSync(join(WEB, THREAD), 'utf8'));
const makerSrc = stripComments(readFileSync(join(WEB, MAKER), 'utf8'));
const railSrc = stripComments(readFileSync(join(WEB, RAIL), 'utf8'));

function linesWith(src: string, needle: string): string[] {
  return src.split('\n').filter((l) => l.includes(needle)).map((l) => l.trim());
}

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE HELPER — both numbers survive, and each is named
// ───────────────────────────────────────────────────────────────────────────

test('the live count leads with a tilde and names the inquiry count behind it', () => {
  const r = readGuestCount({ live: 170, atInquiry: 150 }, 'live');
  assert.equal(r!.label, '~170 guests');
  assert.equal(r!.basisLabel, 'now planning');
  assert.equal(r!.otherLabel, 'was 150 at inquiry');
  assert.equal(guestCountLine({ live: 170, atInquiry: 150 }), '~170 guests · was 150 at inquiry');
});

test('the count a supplier is being paid against is never softened with a tilde', () => {
  const r = readGuestCount({ live: 170, atInquiry: 150 }, 'at_inquiry', { unit: 'pax' });
  assert.equal(r!.label, '150 pax', 'the quoted figure is a fact, not an estimate');
  assert.equal(r!.basisLabel, 'at inquiry');
  assert.equal(r!.otherLabel, 'their plan says 170 now');
});

test('a SHRINKING guest count still names both numbers', () => {
  // ⚠ THE SHIPPED HEADER ONLY NAMED THE INQUIRY COUNT WHEN IT WAS SMALLER
  // (`pax_at_inquiry < headerPax`). A couple who cut their list from 200 to 120
  // therefore saw the second number vanish — the direction that costs a
  // supplier money.
  assert.equal(guestCountLine({ live: 120, atInquiry: 200 }), '~120 guests · was 200 at inquiry');
});

test('one number is still labelled, and no number renders nothing', () => {
  const only = guestCountChip({ live: null, atInquiry: 150 }, 'at_inquiry', { unit: 'pax' });
  assert.deepEqual(only, { label: '150 pax', basisLabel: 'at inquiry' });
  assert.equal(
    readGuestCount({ live: null, atInquiry: null }, 'live'),
    null,
    'a surface with no headcount must draw nothing, never invent one',
  );
});

test('asking for a basis the thread does not carry answers under the OTHER basis’s name', () => {
  const r = readGuestCount({ live: 170, atInquiry: null }, 'at_inquiry', { unit: 'pax' });
  assert.equal(r!.count, 170);
  assert.equal(r!.basisLabel, 'now planning', 'never the live number under the words "at inquiry"');
});

test('two equal counts do not render as a change', () => {
  assert.equal(guestCountLine({ live: 150, atInquiry: 150 }), '~150 guests');
  assert.equal(guestCountRow({ live: 150, atInquiry: 150 })!.note, null);
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE RAIL ROW, built by the same helper
// ───────────────────────────────────────────────────────────────────────────

test('the customer rail’s Guests row carries the inquiry count as its note', () => {
  const s = buildCustomerEventSummary({
    hostName: 'Ice Casasola',
    eventTypeLabel: 'Wedding',
    eventName: 'Cale & Ice',
    createdAt: '2026-06-19T02:00:00.000Z',
    targetDate: '2026-12-18',
    pax: 170,
    paxAtInquiry: 150,
    location: 'Tagaytay',
    lockedVendors: 4,
    totalVendors: 9,
  });
  const pax = s.facts.find((f) => f.label === 'Pax')!;
  assert.equal(pax.value, '~170 now');
  assert.equal(pax.note, '150 at inquiry');
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · EVERY SURFACE GOES THROUGH THE HELPER — positively
// ───────────────────────────────────────────────────────────────────────────

test('the header names both counts through the helper', () => {
  assert.match(threadSrc, /Planning for \{guestCountLine\(guestCounts\)\}/);
});

test('the accept card renders the count AND its basis label', () => {
  assert.match(
    threadSrc,
    /guestCountChip\(guestCounts, 'at_inquiry', \{ unit: 'pax' \}\)/,
    'the chip leads with the count being accepted',
  );
  assert.match(
    threadSrc,
    /\{chip\.label\}[\s\S]{0,120}\{chip\.basisLabel\}/,
    'and the basis label renders beside it — the label is what was missing',
  );
});

test('the quote builder is told the live count without being reseeded by it', () => {
  assert.match(
    threadSrc,
    /requestedPax=\{thread\.pax_at_inquiry \?\? headerPax \?\? 100\}/,
    'THE SEED IS UNCHANGED: re-seeding from the live count moves what a supplier prices against',
  );
  assert.match(threadSrc, /livePax=\{headerPax \?\? null\}/);
  // ⚠ BY COUNT, NOT BY PRESENCE. The builder header has TWO branches — "sized
  // to their request" and "quoting X, request was Y" — and each shows the
  // seeded figure. A `match` anywhere in the file passes while one of them has
  // silently lost its label, which is what a first version of this assertion
  // did: the mutation that stripped the first branch left it green.
  assert.equal(
    (makerSrc.match(/pax at inquiry/g) ?? []).length,
    2,
    'both branches of the builder header must name which count they opened at',
  );
  assert.equal(
    (makerSrc.match(/their plan now says \{livePax\}/g) ?? []).length,
    2,
    'and both must name the live count when it differs',
  );
});

test('the customer rail is fed both counts, and renders the second one', () => {
  assert.match(threadSrc, /paxAtInquiry: thread\.pax_at_inquiry \?\? null/);
  assert.match(railSrc, /\{note\}/, 'the rail must actually render a fact row’s note');
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · AND NO FIFTH SURFACE MAY READ THE COLUMNS RAW — negatively
// ───────────────────────────────────────────────────────────────────────────

test('the raw guest-count columns are only ever handed to the helper or a fetcher', () => {
  // Every line of the thread page that names a raw count column, and the reason
  // that line is allowed to. A new render site produces a line that matches
  // none of these.
  const ALLOWED = [
    /atInquiry: thread\.pax_at_inquiry \?\? null/, // → the one guestCounts object
    /paxAtInquiry: thread\.pax_at_inquiry/, // → fetchVendorPaxProposals + the rail builder
    /requestedPax=\{thread\.pax_at_inquiry \?\? headerPax \?\? 100\}/, // → the quote seed
    /const headerPax = livePax \?\? thread\.pax_current;/, // → the live count, read once
  ];

  const offending = [...linesWith(threadSrc, 'pax_at_inquiry'), ...linesWith(threadSrc, 'pax_current')]
    .filter((l) => !ALLOWED.some((re) => re.test(l)));

  assert.deepEqual(
    offending,
    [],
    'a guest count outside the helper is a surface that can lose its label',
  );

  // The allow-list is exhaustive in the other direction too: if one of these
  // reads disappears, a surface has silently stopped being fed.
  assert.equal(linesWith(threadSrc, 'pax_at_inquiry').length, 4);
  assert.equal(linesWith(threadSrc, 'pax_current').length, 1);
});
