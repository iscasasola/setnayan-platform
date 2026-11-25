/**
 * saves-seats-and-slips-hold-final-check.test.ts — final check, area 2, fix batch 6 (25 Nov 2026).
 *
 * Ten findings: saves that went to the error screen or said nothing (paperwork, Nikah, locking a date), a refused read
 * drawn as "none" (referrals), a button handed to someone its writer always refuses (Put this away), four "still to
 * seat" numbers for one event, an order slip naming a pay rail of its own, an honorific guessed from the family side,
 * and replaced paperwork scans left in a private bucket. Behaviour for the one pure reader; comment-stripped source for
 * the wiring (a comment that names the fix cannot satisfy it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { countStillToSeat } from '@/lib/seating';
import { unseatedCount } from '@/lib/print-entrance-chart';
import { PAPERWORK_STAY_DOORS } from '@/lib/stay-doors/paperwork';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string): string => stripComments(readFileSync(join(web, rel), 'utf8'));

test('A2-I10: every paperwork save is a stay door, so a refusal is said under its form', () => {
  const page = src('app/dashboard/[eventId]/paperwork/page.tsx');
  assert.doesNotMatch(page, /<form\b/, 'no plain form posts a paperwork save');
  for (const action of ['seedPaperworkForEvent', 'markPaperworkRequested', 'markPaperworkReceived', 'setPaperworkStatus', 'uploadPaperworkScan', 'setPaperworkNotes']) {
    assert.ok(PAPERWORK_STAY_DOORS.includes(`paperwork.${action}` as (typeof PAPERWORK_STAY_DOORS)[number]), `${action} is a door`);
    assert.match(page, new RegExp(`door="paperwork\\.${action}" action=\\{${action}\\}`), `${action}'s form posts through its door`);
  }
});

test('A2-I19: "Save Nikah details" reads its write and says a failure', () => {
  const action = src('app/dashboard/[eventId]/nikah-actions.ts');
  assert.match(action, /const \{ data: saved, error \} = await sb/);
  assert.match(action, /if \(error \|\| !saved\?\.length\) \{/);
  const card = src('app/dashboard/[eventId]/_components/nikah-essentials-card.tsx');
  assert.match(card, /<StayForm\s+door="paperwork\.updateNikahDetails"/);
  assert.match(card, /<input type="hidden" name="event_id" value=\{eventId\} \/>/);
});

test('A2-F10: a refused referral read is said, never "No referrals yet"', () => {
  assert.match(src('lib/referral-actions.ts'), /redemptionsRefused: Boolean\(rowsError\)/);
  const page = src('app/dashboard/[eventId]/refer/page.tsx');
  assert.ok(page.indexOf('{redemptionsRefused ? (') >= 0);
  assert.ok(page.indexOf('{redemptionsRefused ? (') < page.indexOf('No referrals yet'), 'the refusal is decided first');
});

test('A2-H10: Put this away is drawn only for someone its writer lets put the event away', () => {
  const page = src('app/dashboard/[eventId]/details/page.tsx');
  assert.match(page, /mayPutAwayEvent\(supabase, eventId, user\.id\)/);
  assert.ok(page.indexOf('{mayPutAway ? (') >= 0 && page.indexOf('{mayPutAway ? (') < page.indexOf('<PutAwayCard'));
  assert.match(src('app/dashboard/[eventId]/archive-actions.ts'), /const mayPutAway = await mayPutAwayEvent\(supabase, eventId, user\.id\);/, 'one answer for both');
  // Owner (brief Add 39): only the couple — no coordinator, no helper.
  const rule = src('lib/event-put-away.ts');
  assert.match(rule, /\.eq\('member_type', 'couple'\)/);
  assert.doesNotMatch(rule, /coordinator|event_moderators/);
});

test('A2-H12: locking a date goes through the date’s one writer and never throws at the page', () => {
  const s = src('app/dashboard/[eventId]/date-selection/actions.ts');
  const body = s.slice(s.indexOf('export async function lockEventDate'), s.indexOf('export async function setMeaningfulDates'));
  assert.match(body, /const applied = await updateEventDate\(dateFd\);/);
  assert.doesNotMatch(body, /\bthrow new Error\(/, 'every refusal is returned beside the date');
  assert.match(body, /if \(countErr\) return \{ ok: false/, 'a refused booked-supplier count refuses');
  assert.doesNotMatch(body, /\.update\(\{[^}]*event_date:/, 'the date column is written by updateEventDate only');
});

test('A2-E4 / A2-D2: one still-to-seat count — not declined and in no chair', () => {
  const people = [
    { rsvp_status: 'attending', seated_table_id: null },
    { rsvp_status: 'pending', seated_table_id: null },
    { rsvp_status: 'maybe', seated_table_id: null },
    { rsvp_status: 'declined', seated_table_id: null },
    { rsvp_status: 'attending', seated_table_id: 't1' },
  ];
  assert.equal(countStillToSeat(people), 3, 'pending and maybe hold seats; a declined guest never does');
  const chart = unseatedCount(
    [{ table_id: 't1' }] as never,
    [{ guest_id: 'g5', table_id: 't1' }] as never,
    people.map((p, i) => ({ guest_id: `g${i + 1}`, rsvp_status: p.rsvp_status })) as never,
  );
  assert.equal(chart, 3, 'the entrance chart gives the same number');
  const editor = src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(editor, /const unseatedCount = countStillToSeat\(guests\);/);
  assert.match(editor, /const unseatedComing = countStillToSeat\(guests\);/);
  assert.match(editor, /effectiveCapacity\(t\.capacity, t\.removed_seats\), 0\);\n\s*const unseatedCount/);
  const page = src('app/dashboard/[eventId]/seating/page.tsx');
  assert.match(page, /const toSeatCount = countStillToSeat\(countedSeatingGuests\);/);
  assert.match(page, /const nonDeclinedCount = headcountForBasis\(guestStats, 'invited'\);/);
  assert.doesNotMatch(page, /rsvp_status === 'attending'\)/);
  for (const f of ['app/dashboard/[eventId]/seating/chart/page.tsx', 'app/dashboard/[eventId]/seating/print/route.ts']) {
    assert.match(src(f), /readNoSeatGuestIds\(supabase, eventId\)/, `${f} drops the guests the seat plan offers no seat`);
  }
  const checkin = src('app/dashboard/[eventId]/guests/checkin/page.tsx');
  assert.match(checkin, /const expected = headcountForBasis\(computeGuestStats\(/);
});

test('A2-F7: the order slip names no pay rail of its own and no gone step', () => {
  const s = src('app/receipts/order/[orderId]/page.tsx');
  assert.doesNotMatch(s, /label: 'Pay to'/);
  assert.doesNotMatch(s, /log the payment below/);
});

test('A2-I15: a walk’s columns never call a sponsor ninong or ninang from the side', () => {
  const s = src('app/dashboard/[eventId]/sponsors/page.tsx');
  assert.doesNotMatch(s, /triggerLabel="Add ninong"|triggerLabel="Add ninang"/);
  assert.doesNotMatch(s, /SPONSOR_SIDE_LABEL\.(groom|bride)\} · nin(ong|ang)/);
});

test('A2-I11: a replaced paperwork scan is deleted through the pinned cleanup path, in this event’s folder only', () => {
  const s = src('app/dashboard/[eventId]/paperwork/actions.ts');
  assert.match(s, /select\('status, document_r2_key'\)/);
  assert.match(s, /cleanupDelete\(previousRef, paperworkScope\(eventId\)\)/);
});
