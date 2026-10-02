/**
 * ✉ AN UNFINISHED NO-ACCOUNT DRAFT IS REMINDED BEFORE IT IS DELETED (owner
 * 2026-10-02, tracker d11: keep the 30-day delete, add a reminder email a few
 * days before). Three days; once per draft; a draft with no email is skipped
 * and logged, never counted as reminded.
 *
 * SABOTAGE (run 2026-10-02): removing the `runAnonDraftReminders()` call from
 * `maybeRunAnonDraftSweep` turns test 4 red ("the daily run deletes without
 * reminding").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ANON_DRAFT_REMINDER_DAYS_BEFORE,
  ANON_DRAFT_TTL_DAYS,
  draftDeletesOn,
  draftReminderAddress,
  draftReminderDue,
  draftReminderEmail,
} from './anon-draft-reminder';
import { stripComments } from './strip-comments';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-02T04:00:00Z');
const born = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

test('1 · 30 days to delete, the reminder in the last 3', () => {
  assert.equal(ANON_DRAFT_TTL_DAYS, 30);
  assert.equal(ANON_DRAFT_REMINDER_DAYS_BEFORE, 3);
  assert.equal(draftReminderDue(born(26.9), NOW), false, 'too early');
  assert.equal(draftReminderDue(born(27), NOW), true);
  assert.equal(draftReminderDue(born(29.9), NOW), true);
  assert.equal(draftReminderDue(born(30), NOW), false, 'already due for deletion — too late to "remind"');
  assert.equal(draftReminderDue('not a date', NOW), false);
  assert.equal(draftReminderDue(null, NOW), false);
});

test('2 · only a REAL address — the placeholder is no email', () => {
  assert.equal(draftReminderAddress(null, 'anon+123@anon.setnayan.local'), null, 'a placeholder is not an address');
  assert.equal(draftReminderAddress('', undefined), null);
  assert.equal(draftReminderAddress('anon+1@anon.setnayan.local', 'maria@example.com'), 'maria@example.com');
  assert.equal(draftReminderAddress('jose@example.com', 'maria@example.com'), 'jose@example.com');
});

test('3 · the email names the delete date and the one thing to do', () => {
  const created = born(27);
  const { subject, text } = draftReminderEmail({ createdAtIso: created, appUrl: 'https://setnayan.com' });
  assert.match(subject, /deleted/);
  const when = draftDeletesOn(created).toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
  assert.ok(text.includes(when), 'the date is missing');
  assert.ok(text.includes('https://setnayan.com/signup'));
  assert.ok(!/vendor/i.test(text));
});

test('4 · the daily run reminds BEFORE it deletes, once per draft, and logs a draft with no email', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, 'anon-draft-sweep.ts'), 'utf8'));
  const job = src.slice(src.indexOf('export async function maybeRunAnonDraftSweep'));
  const remindAt = job.indexOf('runAnonDraftReminders()');
  const sweepAt = job.indexOf('runAnonDraftSweep()');
  assert.ok(remindAt !== -1, 'the daily run deletes without reminding');
  assert.ok(remindAt < sweepAt, 'the reminder runs after the delete');
  const fn = src.slice(src.indexOf('export async function runAnonDraftReminders'), src.indexOf('export async function maybeRunAnonDraftSweep'));
  assert.match(fn, /if \(meta\[DRAFT_REMINDER_SENT_KEY\]\) continue;/, 'a draft can be reminded twice');
  assert.match(fn, /\[DRAFT_REMINDER_SENT_KEY\]: new Date\(nowMs\)\.toISOString\(\)/, 'the send is not recorded');
  assert.match(fn, /holds no email — reminder skipped/, 'a draft with no email is skipped silently');
  // The mark is written only AFTER a send that worked.
  assert.ok(fn.indexOf('if (!res.ok)') < fn.indexOf('updateUserById'), 'a failed send is marked as sent');
  // The delete keeps the same TTL as the reminder (one number).
  assert.match(src, /from '@\/lib\/anon-draft-reminder'/);
  assert.ok(!/const ANON_DRAFT_TTL_DAYS\s*=/.test(src), 'a second TTL number');
});
