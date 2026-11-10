/**
 * 🧾 DETAILS = WHAT IS AGREED NOW, EVERY ROW WITH ITS HISTORY (Supplier Build 3 · lane B).
 *
 * What would silently undo it:
 *   1. a row hides when its fact is unset — it must say so in words, never vanish and never print "—";
 *   2. "Changed N×" miscounts, or the history is not newest first, or names the wrong person;
 *   3. the agreed quote is not the one shown once a quote is accepted;
 *   4. won / lost stops being automatic;
 *   5. a refused history read reads as "No changes".
 *
 * Run: cd apps/web && npx tsx --test lib/agreed-now.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { COULD_NOT_LOAD, agreedOutcome, agreedRows, changedLabel, type AgreedInputs } from './agreed-now';
import { orderQuoteVersions, type QuoteVersionRow } from './quote-versions';
import type { BookingChange } from './booking-changes';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';

const q = (id: string, status: string, at: string, total: number): QuoteVersionRow => ({
  proposal_id: id,
  public_id: `S89P-${id}`,
  event_id: 'e',
  vendor_profile_id: 'v',
  status,
  sent_at: at,
  created_at: at,
  total_centavos: total,
  line_items: [],
  payment_schedule: null,
});
const ch = (id: number, field: BookingChange['field'], from: string | null, to: string | null, by: string | null, at: string, subjectId: string | null = null): BookingChange => ({
  changeId: id,
  eventId: 'e',
  vendorProfileId: null,
  field,
  subjectId,
  fromValue: from,
  toValue: to,
  changedBy: by,
  changedAt: at,
});

const base: AgreedInputs = {
  viewerUserId: ME,
  quotes: [],
  event: { eventDate: null, estimatedPax: null, finalPax: null },
  changes: [],
  meetings: [],
  names: new Map(),
  booking: { isBooked: false, declined: false },
  quoteBy: 'You',
};

test('1 · a brand-new client: every row is there and says so in words', () => {
  const rows = agreedRows(base);
  assert.deepEqual(
    rows.map((r) => [r.key, r.value]),
    [
      ['quote', 'No quote sent yet'],
      ['event_date', 'No date set yet'],
      ['guest_count', 'No count yet'],
      ['meetings', 'No meeting set'],
    ],
  );
  for (const r of rows) {
    assert.ok(r.value.trim().length > 0 && r.value !== '—', r.key);
    assert.equal(changedLabel(r.history, true), 'No changes');
  }
});

test('2 · Changed N×, newest first, with who: You · a first name · Someone · Setnayan', () => {
  const rows = agreedRows({
    ...base,
    event: { eventDate: '2026-12-12', estimatedPax: 150, finalPax: null },
    changes: [
      ch(1, 'guest_estimate', '120', '140', ANA, '2026-11-01T10:00:00+08:00'),
      ch(2, 'guest_estimate', '140', '150', ME, '2026-11-05T10:00:00+08:00'),
      ch(3, 'event_date', '2026-12-05', '2026-12-12', null, '2026-11-02T10:00:00+08:00'),
      ch(4, 'event_date', '2026-11-30', '2026-12-05', 'stranger', '2026-10-02T10:00:00+08:00'),
    ],
    names: new Map([[ANA, 'Ana']]),
  });
  const pax = rows.find((r) => r.key === 'guest_count')!;
  assert.equal(pax.value, '150 guests');
  assert.equal(changedLabel(pax.history, true), 'Changed 2×');
  assert.deepEqual(pax.history.map((h) => [h.who, h.from, h.to]), [
    ['You', '140 guests', '150 guests'],
    ['Ana', '120 guests', '140 guests'],
  ]);
  const date = rows.find((r) => r.key === 'event_date')!;
  assert.deepEqual(date.history.map((h) => h.who), ['Setnayan', 'Someone']);
  assert.equal(date.history[0]!.to, 'Dec 12, 2026');
});

test('3 · the ACCEPTED quote is the agreed one; its history is every earlier version', () => {
  const versions = orderQuoteVersions([
    q('a', 'sent', '2026-10-01T00:00:00Z', 5_000_000),
    q('b', 'accepted', '2026-10-05T00:00:00Z', 5_500_000),
    q('c', 'draft', '2026-10-09T00:00:00Z', 9_900_000),
  ]);
  const quote = agreedRows({ ...base, quotes: versions }).find((r) => r.key === 'quote')!;
  assert.equal(quote.label, 'Agreed quote');
  assert.match(quote.value, /^Version 2 · ₱55,000/);
  assert.equal(quote.history.length, 1);
  assert.equal(quote.history[0]!.who, 'You');
  assert.match(quote.history[0]!.from!, /^Version 1/);
});

test('3b · a meeting row per live meeting, with its own time history', () => {
  const rows = agreedRows({
    ...base,
    meetings: [
      { appointmentId: 'm1', title: 'Tasting', scheduledAt: '2026-11-20T06:00:00Z', status: 'confirmed' },
      { appointmentId: 'm2', title: 'Ocular', scheduledAt: '2026-11-21T06:00:00Z', status: 'cancelled' },
    ],
    changes: [ch(9, 'meeting_time', '2026-11-19T06:00:00Z', '2026-11-20T06:00:00Z', ME, '2026-11-08T00:00:00Z', 'm1')],
  });
  const m = rows.filter((r) => r.key.startsWith('meeting'));
  assert.deepEqual(m.map((r) => r.key), ['meeting:m1']);
  assert.equal(m[0]!.history.length, 1);
});

test('4 · won / lost is automatic', () => {
  assert.equal(agreedOutcome({ isBooked: true, declined: false }, []).kind, 'won');
  assert.equal(agreedOutcome({ isBooked: false, declined: true }, []).kind, 'lost');
  const declined = orderQuoteVersions([q('a', 'declined', '2026-10-01T00:00:00Z', 1)]);
  assert.equal(agreedOutcome({ isBooked: false, declined: false }, declined).kind, 'lost');
  assert.equal(agreedOutcome({ isBooked: false, declined: false }, []).kind, 'open');
});

test('5 · a refused history read says it could not load — never "No changes"', () => {
  assert.equal(changedLabel([], false), COULD_NOT_LOAD);
  assert.notEqual(changedLabel([], false), 'No changes');
});
