/**
 * ⏰ UNICHAT PART H1 — "Remind me": what each choice means (approved Unichat prototype v3, DECISION_LOG 2026-11-20).
 * Later today = 3 hours on · tomorrow / a date = 9:00 AM Manila. The server's clock decides
 * (`lib/chat-message-actions.ts`); the menu prints the same function's answer before a choice is pressed.
 *
 * Run from apps/web: tsx --test lib/chat-reminders.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REMINDER_PICK_A_DATE,
  isReminderChoice,
  manilaDayKey,
  reminderDateBounds,
  reminderPreview,
  reminderWhen,
} from './chat-reminders';

// 20 Nov 2026, 3:30 PM in Manila (07:30 UTC).
const NOW = Date.parse('2026-11-20T07:30:00Z');

test('later today is three hours on', () => {
  const w = reminderWhen('later', NOW);
  assert.deepEqual(w, { ok: true, at: Date.parse('2026-11-20T10:30:00Z') });
});

test('tomorrow is 9:00 AM Manila on the next MANILA day — also just after Manila’s midnight', () => {
  assert.deepEqual(reminderWhen('tomorrow', NOW), { ok: true, at: Date.parse('2026-11-21T01:00:00Z') });
  // 00:30 on 21 Nov in Manila is still 20 Nov in UTC: tomorrow is the 22nd, not the 21st.
  const justAfterMidnight = Date.parse('2026-11-20T16:30:00Z');
  assert.equal(manilaDayKey(justAfterMidnight), '2026-11-21');
  assert.deepEqual(reminderWhen('tomorrow', justAfterMidnight), { ok: true, at: Date.parse('2026-11-22T01:00:00Z') });
});

test('a date is that day at 9:00 AM Manila — from tomorrow, within a year, and a real day', () => {
  assert.deepEqual(reminderWhen('date', NOW, '2026-12-18'), { ok: true, at: Date.parse('2026-12-18T01:00:00Z') });
  const { min, max } = reminderDateBounds(NOW);
  assert.equal(min, '2026-11-21');
  assert.equal(max, '2027-11-20');
  assert.equal(reminderWhen('date', NOW, min).ok, true);
  assert.equal(reminderWhen('date', NOW, max).ok, true);
  for (const bad of ['2026-11-20', '2026-11-19', '2027-11-21', '2026-02-31', '18/12/2026', '', null, undefined]) {
    assert.deepEqual(reminderWhen('date', NOW, bad), { ok: false, message: REMINDER_PICK_A_DATE }, String(bad));
  }
});

test('every reminder is in the future', () => {
  for (const c of ['later', 'tomorrow'] as const) {
    const w = reminderWhen(c, NOW);
    assert.ok(w.ok && w.at > NOW);
  }
});

test('only the three choices are choices', () => {
  assert.equal(isReminderChoice('later'), true);
  assert.equal(isReminderChoice('tomorrow'), true);
  assert.equal(isReminderChoice('date'), true);
  assert.equal(isReminderChoice('next week'), false);
  assert.equal(isReminderChoice(null), false);
});

test('the notice says what the message was — never an empty line', () => {
  assert.equal(reminderPreview({ body: '  Send the guest count by Friday ' }), 'Send the guest count by Friday');
  assert.equal(reminderPreview({ body: 'x'.repeat(200) }).length, 140);
  assert.equal(reminderPreview({ body: '', attachment_mime: 'audio/webm', voice_seconds: 7, attachment_name: 'Voice note.webm' }), 'A voice note');
  assert.equal(reminderPreview({ body: '', attachment_mime: 'image/jpeg', attachment_name: 'venue.jpg' }), 'A file · venue.jpg');
  assert.equal(reminderPreview({ body: null }), 'A message in this chat');
});
