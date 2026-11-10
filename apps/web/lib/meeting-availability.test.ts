/**
 * meeting-availability.test.ts — 📆 BOTH SIDES' AVAILABILITY FOR A MEETING (Build 3 · Lane D; prototype v3.1 README
 * § "Both sides' availability (meetings)"; DECISION_LOG 📆 2026-11-09).
 *
 * Holds:
 *   1. A CLOSED DAY CAN NEVER BE CHOSEN — an all-day block or the lock's refusal closes the day for the other side with
 *      WHO only; the sheet's own gate (`dateSheetCanSet`) never lights on it;
 *   2. A PART OF A DAY REFUSES ONLY ITS HOURS — a Saturday-afternoon block leaves the morning free;
 *   3. WHO IS BUSY — the other side "is not available" and never says what; YOUR OWN clash names itself, first;
 *      a meeting with this supplier on this event is both sides' own;
 *   4. SET ONLY ON A TIME FREE FOR EVERYONE — through the sheet's one gate, over the folded slots;
 *   5. A FAILED READ IS NEVER "FREE" — it leaves "Free for …" and is named in the ⓘ; an empty read is free;
 *   6. NO SCHEDULE — a supplier with no calendar, and anyone else included, "hasn't added their schedule";
 *   7. THE READ — proves the viewer on the caller's own session BEFORE the admin client reads anything, honours
 *      repeats, reads the lock's refusal through `readCalendarTruth`, and adds no table.
 *
 * Sabotage (2026-11-10): `meetingBusyAt` returning the first range instead of yours first → 3 red; the fold pushing a
 * failed side into `free` → 5 red; the proof moved after the reads → 7 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { dateSheetCanSet, refusalLine } from '@/lib/date-sheet';
import {
  foldMeetingAvailability,
  manilaDayAndTime,
  meetingAboutWords,
  meetingBusyAt,
  meetingRefusal,
  meetingSlots,
  meetingWindowDays,
  MEETING_WINDOW_MAX_DAYS,
  type MeetingAvailabilityInput,
} from '@/lib/meeting-availability';

const WEB = join(__dirname, '..');

const base = (over: Partial<MeetingAvailabilityInput> = {}): MeetingAvailabilityInput => ({
  viewer: 'host',
  supplierName: 'Lumina',
  hostName: 'Ana & Ben',
  from: '2026-11-09',
  to: '2026-11-27',
  blocks: [
    { startDate: '2026-11-20', endDate: '2026-11-20' },
    { startDate: '2026-11-14', endDate: '2026-11-14', repeat: 'weekly', dayPart: 'afternoon' },
  ],
  calendar: { set: true, refused: ['2026-11-21', '2027-02-01'] },
  supplierMeetings: [{ day: '2026-11-12', start: '10:00', minutes: 60, label: 'the site visit with Cora & Dan', withThisSupplier: false }],
  eventMeetings: [
    { day: '2026-11-12', start: '15:00', minutes: null, label: 'the florist meeting with Bloom', withThisSupplier: false },
    { day: '2026-11-13', start: '11:00', minutes: 30, label: 'the food tasting', withThisSupplier: true },
  ],
  ...over,
});

test('1 · a closed day can never be chosen, and says only WHO', () => {
  const av = foldMeetingAvailability(base());
  const refuse = meetingRefusal(av);
  assert.equal(refuse('2026-11-20'), 'Lumina is not available this date', 'an all-day block does not close the day');
  assert.equal(refuse('2026-11-21'), 'Lumina is not available this date', "the lock's refusal (booked) does not close the day");
  assert.equal(refuse('2026-11-12'), null, 'a day with only some busy hours is closed');
  assert.equal(refuse('2026-11-14'), null, 'an afternoon block closed the whole Saturday');
  assert.equal(av.closed['2027-02-01'], undefined, 'a refusal outside the window leaked in');
  assert.equal(refusalLine('2026-11-20', refuse('2026-11-20')!), 'Fri 20 Nov — Lumina is not available this date');
  assert.equal(dateSheetCanSet({ day: '2026-11-20', refuse }), false, 'Set lights on a closed day');
  assert.equal(dateSheetCanSet({ day: '2026-11-20', time: '09:00', refuse, slots: meetingSlots(av, ['09:00']) }), false);
});

test('2 · a part of a day refuses only its hours (weekly Saturday afternoon)', () => {
  const av = foldMeetingAvailability(base());
  /* Nov 14 is the block's first Saturday (Nov 21 is closed whole by the lock, so the repeat is asked below, wider). */
  for (const sat of ['2026-11-14']) {
    assert.equal(meetingBusyAt(av, sat, '09:00', 30), null, `${sat} morning is refused`);
    assert.deepEqual(meetingBusyAt(av, sat, '13:00', 30), { who: 'Lumina' }, `${sat} afternoon is free`);
  }
  const wide = foldMeetingAvailability(base({ from: '2026-11-01', to: '2026-12-31', calendar: { set: true, refused: [] } }));
  assert.equal(meetingBusyAt(wide, '2026-11-07', '13:00', 30), null, 'a weekly repeat covered a Saturday before its first day');
  assert.deepEqual(meetingBusyAt(wide, '2026-12-05', '13:00', 30), { who: 'Lumina' }, 'a weekly repeat stopped after its first week');
  assert.equal(meetingBusyAt(wide, '2026-12-04', '13:00', 30), null, 'a weekly repeat covered a Friday');
  assert.equal(meetingBusyAt(av, '2026-11-14', '11:30', 30), null, 'a meeting ending at noon meets the afternoon');
  assert.deepEqual(meetingBusyAt(av, '2026-11-14', '11:30', 60), { who: 'Lumina' }, 'a meeting running into the afternoon is free');
});

test("3 · who is busy: the other side never says what; your own clash names itself, first", () => {
  const av = foldMeetingAvailability(base());
  assert.deepEqual(meetingBusyAt(av, '2026-11-12', '10:30', 30), { who: 'Lumina' }, "the supplier's other meeting");
  assert.deepEqual(meetingBusyAt(av, '2026-11-12', '15:30', 30), { who: 'You', what: 'the florist meeting with Bloom' }, 'a stored meeting with no length is not an hour');
  assert.equal(meetingBusyAt(av, '2026-11-12', '16:00', 30), null, 'an hour-long meeting ran past its hour');
  assert.deepEqual(meetingBusyAt(av, '2026-11-13', '11:00', 30), { who: 'You', what: 'the food tasting' }, 'a meeting with this supplier is not both sides own');
  /* Overlap: yours wins over theirs. */
  const both = foldMeetingAvailability(
    base({ eventMeetings: [{ day: '2026-11-12', start: '10:00', minutes: 60, label: 'the dress fitting', withThisSupplier: false }] }),
  );
  assert.deepEqual(meetingBusyAt(both, '2026-11-12', '10:00', 30), { who: 'You', what: 'the dress fitting' });
  /* 🔒 The other side's reason never reaches the answer — nothing but WHO for anything that is not yours. */
  const json = JSON.stringify(av);
  assert.doesNotMatch(json, /site visit|Cora/, "another couple's meeting leaked to the host");
  for (const r of [...av.busy.map((b) => b.busy), ...Object.values(av.closed)]) if (r.who !== 'You') assert.equal(r.what, undefined, `${r.who} said what`);

  /* The supplier's view: the sides swap; the couple's other meetings say only "Ana & Ben is not available". */
  const sup = foldMeetingAvailability(base({ viewer: 'supplier' }));
  assert.deepEqual(meetingBusyAt(sup, '2026-11-12', '15:00', 30), { who: 'Ana & Ben' });
  assert.doesNotMatch(JSON.stringify(sup), /florist|Bloom/, "the couple's meeting with another supplier leaked to the supplier");
  assert.deepEqual(meetingBusyAt(sup, '2026-11-12', '10:00', 30), { who: 'You', what: 'the site visit with Cora & Dan' });
  assert.equal(meetingRefusal(sup)('2026-11-20'), 'You are not available this date');
  assert.deepEqual(sup.free, ['Ana & Ben', 'You']);
});

test('4 · Set only on a time free for everyone', () => {
  const av = foldMeetingAvailability(base());
  const slots = meetingSlots(av, ['09:00', '10:00', '13:00', '15:00'], 30);
  const refuse = meetingRefusal(av);
  const can = (day: string, time: string | null) => dateSheetCanSet({ day, time, min: '2026-11-09', max: '2026-11-27', refuse, slots });
  assert.equal(can('2026-11-12', '09:00'), true);
  assert.equal(can('2026-11-12', '10:00'), false, "Set lit on the supplier's busy time");
  assert.equal(can('2026-11-12', '15:00'), false, 'Set lit on your own clash');
  assert.equal(can('2026-11-12', null), false, 'Set lit with no time');
  assert.equal(can('2026-11-12', '09:15'), false, 'Set lit on a time off the list');
  assert.equal(can('2026-11-28', '09:00'), false, 'Set lit past the last day');
  assert.deepEqual(slots.free, ['Lumina', 'You']);
});

test('5 · a failed read is never "free"; an empty read is', () => {
  const failed = foldMeetingAvailability(base({ supplierMeetings: null }));
  assert.deepEqual(failed.free, ['You'], 'a failed supplier read reads as free');
  assert.deepEqual(failed.unread, ['Lumina']);
  assert.equal(meetingAboutWords(failed), "Lumina's schedule could not be read — check with them");
  const ownFailed = foldMeetingAvailability(base({ eventMeetings: null }));
  assert.deepEqual(ownFailed.unread, ['You']);
  assert.equal(meetingAboutWords(ownFailed), 'Your schedule could not be read — check it yourself');
  const empty = foldMeetingAvailability(base({ blocks: [], calendar: { set: true, refused: [] }, supplierMeetings: [], eventMeetings: [] }));
  assert.deepEqual(empty.free, ['Lumina', 'You']);
  assert.deepEqual(empty.unread, []);
  assert.equal(meetingAboutWords(empty), '');
});

test('6 · no schedule: a supplier with no calendar, and anyone else included', () => {
  const none = foldMeetingAvailability(base({ blocks: [], calendar: { set: false, refused: [] }, alsoAsked: ['Tita Lu', ' '] }));
  assert.deepEqual(none.missing, ['Lumina', 'Tita Lu']);
  assert.deepEqual(none.free, ['You']);
  assert.equal(meetingAboutWords(none), "Lumina and Tita Lu haven't added their schedule — check with them");
  /* A shop with no pool but a block it typed HAS said something — it is read, not "missing". */
  const typed = foldMeetingAvailability(base({ calendar: { set: false, refused: [] } }));
  assert.deepEqual(typed.missing, []);
  assert.deepEqual(typed.free, ['Lumina', 'You']);
});

test('the window and the clock: Manila days, a bounded window', () => {
  assert.deepEqual(manilaDayAndTime('2026-11-12T07:00:00Z'), { day: '2026-11-12', start: '15:00' });
  assert.deepEqual(manilaDayAndTime('2026-11-12T17:30:00Z'), { day: '2026-11-13', start: '01:30' }, 'the day is the server zone');
  assert.equal(manilaDayAndTime('not a time'), null);
  assert.deepEqual(meetingWindowDays('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.equal(meetingWindowDays('2026-01-01', '2030-01-01').length, MEETING_WINDOW_MAX_DAYS);
  assert.deepEqual(meetingWindowDays('2026-11-10', '2026-11-09'), []);
});

test('7 · the read proves the viewer first, honours repeats, asks the lock, and adds no table', () => {
  const src = stripComments(readFileSync(join(WEB, 'lib/meeting-availability.server.ts'), 'utf8'));
  const body = src.slice(src.indexOf('export async function readMeetingAvailability'), src.indexOf('export async function proveMeetingViewer'));
  const proofAt = body.indexOf('proveMeetingViewer(');
  const readAt = body.search(/readBlocks\(|readCalendarTruth\(|readMeetings\(/);
  assert.ok(proofAt > 0 && readAt > proofAt, 'the admin reads start before the viewer is proven');
  assert.match(body, /if \(!\(await proveMeetingViewer\([^)]*\)\)\) return null;/, 'an unproven viewer is not refused');
  assert.match(src, /getHostUserId\(eventId\)/, 'a host is not proven by the house host gate');
  assert.match(src, /from\('vendor_profiles_self'\)/, "a supplier is not proven by their own shop's view");
  assert.match(src, /from\('chat_threads'\)/, 'the two sides are not proven to share a thread');
  assert.match(src, /NOT_AVAILABLE_COLUMNS/, 'the blocks read drops repeats and hours');
  assert.match(src, /notAvailableWindowFilter\(/, 'the blocks read misses a repeat that began before the window');
  assert.match(src, /readCalendarTruth\(/, "the supplier's booked days are not the lock's own refusal");
  assert.match(src, /\.in\('status', \['proposed', 'confirmed'\]\)/, 'a cancelled or finished meeting still makes someone busy');
  /* No migration came with this read (it reuses blocks, the lock and the meetings table). */
  const mine = readdirSync(join(WEB, '..', '..', 'supabase', 'migrations')).filter((f) => /meeting_availability|both_sides/i.test(f));
  assert.deepEqual(mine, [], 'a migration was added for the meeting read');
});
