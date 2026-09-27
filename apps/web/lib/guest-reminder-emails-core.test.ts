/**
 * The guest reminder emails' pure half — 30 · 7 · 1 days before the event
 * (owner 2026-09-26). Every decision the sender makes that can be wrong runs
 * here: WHICH day is a milestone (in the event's own calendar, never UTC),
 * that a late-created event does not back-send, WHICH items are listed (only
 * the unticked ones), that an unreplied guest is asked to reply FIRST, and
 * that the couple's switch reads ON when absent and OFF only when set so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MILESTONE_CATCH_UP_DAYS,
  REMINDER_MILESTONES,
  buildGuestReminderEmail,
  dueMilestone,
  guestReminderUnsubscribeHeaders,
  pendingLine,
  reminderEventDates,
  reminderHeadline,
  replyByLine,
  shiftIsoDay,
  todayInZone,
  untickedItems,
} from './guest-reminder-emails-core';
import { buildChecklist } from './guest-checklist';
import { readGuestReminders, sanitizeRsvpAskConfig } from './rsvp-ask';

const EVENT = '2026-12-18';
const due = (today: string) => dueMilestone({ eventDate: EVENT, today });

test('the three milestones are the owner’s three, and only those', () => {
  assert.deepEqual([...REMINDER_MILESTONES], [30, 7, 1]);
});

test('exactly 30 · 7 · 1 days out is a milestone; the day itself and the days after are not', () => {
  assert.equal(due('2026-11-18'), 30);
  assert.equal(due('2026-12-11'), 7);
  assert.equal(due('2026-12-17'), 1);
  assert.equal(due('2026-12-18'), null, 'day 0 is the event — no reminder');
  assert.equal(due('2026-12-19'), null, 'the day after — nothing');
});

test('a quiet site may skip a day: 30 and 7 stay due for a short catch-up, the day-before never', () => {
  assert.equal(MILESTONE_CATCH_UP_DAYS, 2);
  assert.equal(due('2026-11-19'), 30, '29 days out still counts as the 30-day reminder');
  assert.equal(due('2026-11-20'), 30, '28 days out — the last catch-up day');
  assert.equal(due('2026-11-21'), null, '27 days out — the window has closed');
  assert.equal(due('2026-12-13'), 7, '5 days out — the last catch-up day for the week reminder');
  assert.equal(due('2026-12-14'), null, '4 days out — between milestones');
  // "Tomorrow" sent on the day would be false, so the day-before has no catch-up.
  assert.equal(due('2026-12-16'), null, '2 days out is not the day-before');
});

test('A LATE-CREATED EVENT DOES NOT BACK-SEND — 20 days out owes no 30-day reminder', () => {
  assert.equal(due('2026-11-28'), null);
  // …and picks up at the next milestone like any other event.
  assert.equal(due('2026-12-11'), 7);
});

test('no event date → never a milestone (events without a date are never emailed)', () => {
  assert.equal(dueMilestone({ eventDate: null, today: '2026-11-18' }), null);
  assert.equal(dueMilestone({ eventDate: '', today: '2026-11-18' }), null);
  assert.equal(dueMilestone({ eventDate: 'soon', today: '2026-11-18' }), null);
});

test('THE EVENT’S CALENDAR, NOT THE SERVER’S: 8pm UTC on the 16th is already the 17th in Manila', () => {
  const now = new Date('2026-12-16T20:00:00Z');
  assert.equal(todayInZone('Asia/Manila', now), '2026-12-17');
  assert.equal(todayInZone('UTC', now), '2026-12-16');
  // So the day-before reminder for an 18 Dec wedding is due in Manila and
  // would NOT be in UTC — the class of bug lib/venue-disclosure.ts already met.
  assert.equal(dueMilestone({ eventDate: EVENT, today: todayInZone('Asia/Manila', now) }), 1);
  assert.equal(dueMilestone({ eventDate: EVENT, today: todayInZone('UTC', now) }), null);
});

test('an unknown or empty zone falls back to Manila rather than throwing', () => {
  const now = new Date('2026-12-16T20:00:00Z');
  assert.equal(todayInZone('Not/AZone', now), '2026-12-17');
  assert.equal(todayInZone(null, now), '2026-12-17');
  assert.equal(todayInZone('', now), '2026-12-17');
});

test('shiftIsoDay is calendar arithmetic across a month end', () => {
  assert.equal(shiftIsoDay('2026-11-28', 3), '2026-12-01');
  assert.equal(shiftIsoDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftIsoDay('junk', 1), 'junk');
});

test('the dates the sender asks for are exactly the seven that could owe a reminder today', () => {
  assert.deepEqual(reminderEventDates('2026-11-18'), [
    '2026-12-16',
    '2026-12-17',
    '2026-12-18', // 28 · 29 · 30 days
    '2026-11-23',
    '2026-11-24',
    '2026-11-25', // 5 · 6 · 7 days
    '2026-11-19', // tomorrow
  ]);
  // Every date it returns is one dueMilestone would accept, and vice versa
  // across a 40-day sweep — the query and the decision cannot disagree.
  const today = '2026-11-18';
  const asked = new Set(reminderEventDates(today));
  for (let d = -2; d <= 40; d += 1) {
    const eventDate = shiftIsoDay(today, d);
    const owed = dueMilestone({ eventDate, today }) != null;
    assert.equal(asked.has(eventDate), owed, `${eventDate} (${d} days out)`);
  }
});

const ITEMS = buildChecklist({
  wear: 'Filipiniana formal',
  wearNote: null,
  motif: ['#7A2E3B', '#C5A059'],
  arriveBy: '2:30 PM',
  venueName: 'San Agustin Church',
  mapsHref: 'https://maps.example/x',
  tableLabel: 'Table 4',
  passHref: '/api/guest/qr',
});

test('ONLY THE UNTICKED ITEMS are listed — a ticked one never comes back', () => {
  assert.deepEqual(
    ITEMS.map((i) => i.key),
    ['wear', 'motif', 'arrive', 'table', 'pass'],
  );
  assert.deepEqual(
    untickedItems(ITEMS, ['wear', 'pass']).map((i) => i.key),
    ['motif', 'arrive', 'table'],
  );
  assert.deepEqual(untickedItems(ITEMS, ['wear', 'motif', 'arrive', 'table', 'pass']), []);
  assert.deepEqual(untickedItems(ITEMS, []).length, 5);
});

test('an unticked line carries the fact; the motif line sends them to the swatches, never hex codes', () => {
  assert.equal(pendingLine(ITEMS[0]!), 'What to wear — Filipiniana formal');
  assert.equal(pendingLine(ITEMS[1]!), 'Motif colours — 2 colours, see them on your page');
  assert.doesNotMatch(pendingLine(ITEMS[1]!), /#[0-9A-Fa-f]{6}/);
  assert.equal(pendingLine(ITEMS[2]!), 'Arrive by 2:30 PM — San Agustin Church');
  assert.equal(pendingLine(ITEMS[4]!), 'Your QR pass saved');
});

test('"Reply by" goes to an UNREPLIED guest while the date is still ahead — and to nobody else', () => {
  const replyBy = { date: '2026-11-18' };
  const today = '2026-11-01';
  assert.equal(
    replyByLine({ rsvpStatus: 'pending', replyBy, today, listClosed: false }),
    'Reply by Wednesday, November 18, 2026',
  );
  assert.equal(replyByLine({ rsvpStatus: null, replyBy, today, listClosed: false }), 'Reply by Wednesday, November 18, 2026');
  for (const s of ['attending', 'declined', 'maybe']) {
    assert.equal(replyByLine({ rsvpStatus: s, replyBy, today, listClosed: false }), null, s);
  }
  // The guest list is final — a reply can no longer change, so do not ask for one.
  assert.equal(replyByLine({ rsvpStatus: 'pending', replyBy, today, listClosed: true }), null);
  // The reply-by date has passed.
  assert.equal(replyByLine({ rsvpStatus: 'pending', replyBy, today: '2026-11-19', listClosed: false }), null);
  // No date at all (no event date yet).
  assert.equal(replyByLine({ rsvpStatus: 'pending', replyBy: null, today, listClosed: false }), null);
});

test('the headline names the MILESTONE, so a catch-up day still reads right', () => {
  assert.equal(reminderHeadline(30, 30), '30 days to go');
  assert.equal(reminderHeadline(30, 29), '29 days to go');
  assert.equal(reminderHeadline(7, 7), 'One week to go');
  assert.equal(reminderHeadline(7, 6), '6 days to go');
  assert.equal(reminderHeadline(1, 1), 'Tomorrow');
});

const GUEST = { guest_id: 'g1', first_name: 'Ana', last_name: 'Reyes', display_name: null, email: 'ana@example.com' };
const PAGE = 'https://www.setnayan.com/maria-jose?invite=abc123';

test('the email: reply-by FIRST, then only what is still to do, then the guest’s OWN link', () => {
  const mail = buildGuestReminderEmail({
    guest: GUEST,
    coupleName: 'Maria & Jose',
    eventDateIso: EVENT,
    daysLeft: 7,
    milestone: 7,
    pending: untickedItems(ITEMS, ['wear', 'pass']),
    replyBy: 'Reply by Wednesday, November 18, 2026',
    pageUrl: PAGE,
  });
  assert.equal(mail.subject, 'One week to go — Maria & Jose');
  assert.match(mail.text, /^Hi Ana,/);
  const reply = mail.text.indexOf('Reply by Wednesday, November 18, 2026');
  const list = mail.text.indexOf('Still to do on your checklist:');
  assert.ok(reply > 0 && list > reply, 'the reply ask comes before the list');
  assert.match(mail.text, /• Motif colours — 2 colours, see them on your page/);
  assert.match(mail.text, /• Arrive by 2:30 PM — San Agustin Church/);
  assert.match(mail.text, /• Your table — Table 4/);
  assert.doesNotMatch(mail.text, /What to wear/, 'ticked — not listed');
  assert.doesNotMatch(mail.text, /QR pass/, 'ticked — not listed');
  assert.ok(mail.text.includes(PAGE), 'links their own page');
  assert.ok(mail.html.includes(`href="${PAGE}"`), 'the button opens their own page');
  assert.match(mail.html, /One week to go — Maria &amp; Jose/);
  // The unsubscribe pair every guest mail carries.
  assert.deepEqual(mail.headers, guestReminderUnsubscribeHeaders());
  assert.match(mail.headers['List-Unsubscribe'] ?? '', /^<mailto:.+\?subject=unsubscribe>$/);
  assert.equal(mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  // A guest is told the TRUE reason they got this — never "you started a Papic gallery".
  assert.match(mail.text, /added you to their guest list on Setnayan/);
  assert.match(mail.html, /added you to their guest list on Setnayan/);
  assert.doesNotMatch(mail.html, /Papic gallery/);
  // Copy rules: the guest's page is never called a website or a site.
  assert.doesNotMatch(mail.text + mail.html, /\bwebsite\b|\bsite\b/i);
});

test('the day-before email says tomorrow, and a fully ticked list says so instead of listing nothing', () => {
  const mail = buildGuestReminderEmail({
    guest: { ...GUEST, first_name: null, display_name: 'Tita Baby Reyes' },
    coupleName: 'Maria & Jose',
    eventDateIso: EVENT,
    daysLeft: 1,
    milestone: 1,
    pending: [],
    replyBy: null,
    pageUrl: PAGE,
  });
  assert.equal(mail.subject, 'Tomorrow — Maria & Jose');
  assert.match(mail.text, /^Hi Tita,/);
  assert.match(mail.text, /is tomorrow, Friday, December 18, 2026\./);
  assert.match(mail.text, /Your checklist is all ticked/);
  assert.doesNotMatch(mail.text, /Reply by/);
  assert.doesNotMatch(mail.text, /Still to do/);
});

test('THE COUPLE’S SWITCH: absent is ON, only an explicit false is OFF, junk is dropped', () => {
  assert.equal(readGuestReminders(null), true);
  assert.equal(readGuestReminders({}), true);
  assert.equal(readGuestReminders({ meal: false }), true);
  assert.equal(readGuestReminders({ guestReminders: true }), true);
  assert.equal(readGuestReminders({ guestReminders: false }), false);
  assert.equal(readGuestReminders({ guestReminders: 'no' }), true, 'a non-boolean is dropped, so ON');
  // The sanitizer KEEPS the key — a Maker save of the other switches cannot lose it.
  assert.deepEqual(sanitizeRsvpAskConfig({ guestReminders: false, whoCanRsvp: 'anyone' }), {
    guestReminders: false,
    whoCanRsvp: 'anyone',
  });
  assert.deepEqual(sanitizeRsvpAskConfig({ guestReminders: 'yes' }), {});
});
