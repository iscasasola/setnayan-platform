/**
 * 📸 THE PHOTO RULE (owner 2026-11-03, DECISION_LOG "THE PHOTO RULE"): originals are kept until 3 months after the
 * event's LAST day; reminders IN THE APP at day 60 / 80 / 89; after the window a HOST's Download serves the original
 * from their Google Drive when it holds a confirmed copy, else 720p; guests always 720p.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORIGINALS_REMINDER_DAYS,
  ORIGINAL_FROM_DRIVE_LABEL,
  addDays,
  dueOriginalsReminder,
  originalsKeptUntil,
  originalsReminderBody,
  originalsReminderTitle,
} from './papic-originals-reminder-core';
import { DEFAULT_FULL_RES_RETENTION_DAYS, FULL_RES_POST_EVENT_GRACE_DAYS } from './papic-fullres-drop-core';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
/** Noon Manila on a calendar day, as epoch ms. */
const noonManila = (day: string) => Date.parse(`${day}T12:00:00+08:00`);

test('the clock is 3 months after the LAST day and nothing else', () => {
  assert.equal(DEFAULT_FULL_RES_RETENTION_DAYS, 0, 'a first-capture clock is back');
  assert.equal(FULL_RES_POST_EVENT_GRACE_DAYS, 92, 'never shorter than any three calendar months');
  assert.equal(originalsKeptUntil('2027-02-14'), addDays('2027-02-14', 92));
});

test('reminders are day 60 · 80 · 89 — and each fires on its own day, counted from the LAST day', () => {
  assert.deepEqual([...ORIGINALS_REMINDER_DAYS], [60, 80, 89]);
  const last = '2027-02-14';
  assert.equal(dueOriginalsReminder(last, null, noonManila(addDays(last, 59))), null, 'nothing before day 60');
  for (const stage of [60, 80, 89] as const) {
    const due = dueOriginalsReminder(last, null, noonManila(addDays(last, stage)));
    assert.equal(due?.stage, stage, `day ${stage}`);
    assert.equal(due?.stageStartIso, `${addDays(last, stage)}T00:00:00+08:00`);
  }
  // Between stages the latest reached stage is the one due (a missed run sends one notice, not a backlog).
  assert.equal(dueOriginalsReminder(last, null, noonManila(addDays(last, 85)))?.stage, 80);
  assert.equal(dueOriginalsReminder(last, null, noonManila(addDays(last, 91)))?.stage, 89);
  // Once the drop's clock has run out there is nothing true left to say.
  assert.equal(dueOriginalsReminder(last, null, noonManila(addDays(last, 92))), null);
});

test('a multi-day event counts from its END date, never its first day', () => {
  const due = dueOriginalsReminder('2027-02-12', '2027-02-14', noonManila(addDays('2027-02-14', 60)));
  assert.equal(due?.stage, 60);
  // Counted from the first day it would already be day 62 → still 60, but day 80 from the start is only day 78.
  assert.equal(dueOriginalsReminder('2027-02-12', '2027-02-14', noonManila(addDays('2027-02-12', 80)))?.stage, 60);
});

test('the words: the deadline in the title, the owner’s two choices in the body', () => {
  const due = dueOriginalsReminder('2027-02-14', null, noonManila(addDays('2027-02-14', 60)))!;
  assert.match(originalsReminderTitle(due), /^Original photos kept until \w{3} \d{1,2}, 2027$/);
  // Kept until the day BEFORE the drop's clock runs out (14 Feb + 92 = 17 May → 16 May).
  assert.match(originalsReminderTitle(due), /May 16, 2027/);
  const body = originalsReminderBody('Maria & Jose');
  assert.match(body, /Copy to Google Drive \(free\) or Download all/);
  assert.match(body, /720p/);
  assert.equal(ORIGINAL_FROM_DRIVE_LABEL, 'Original quality, from your Google Drive');
});

test('IN-APP ONLY — the reminder is not on the email allowlist, and it rides the daily runner', () => {
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('EMAIL_ENABLED_TYPES'), emit.indexOf('MARKETING_GATED_EMAIL_TYPES'));
  assert.doesNotMatch(allow, /'papic_originals_reminder'/, 'papic_originals_reminder is emailed — owner: no new emails');
  assert.match(read('lib/papic-originals-reminder.ts'), /type: 'papic_originals_reminder'/);
  assert.match(read('lib/daily-email-jobs.ts'), /runClaimedJob\('papic-originals-reminders'/);
  assert.match(read('lib/periodic-job-registry.ts'), /key: 'papic-originals-reminders'/);
  const mig = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations', '20271304032942_notification_type_papic_originals_reminder.sql'),
    'utf8',
  );
  assert.match(mig, /ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'papic_originals_reminder'/);
});

test('after the window a HOST’s Download asks their Drive first; the route stays host-only', () => {
  const route = read('app/dashboard/[eventId]/studio/papic/save-photo/route.ts');
  assert.match(route, /member_type !== 'couple'/, 'the save route is no longer host-only — guests must get 720p');
  const driveAt = route.indexOf('fetchOriginalFromHostDrive(eventId, orig)');
  assert.ok(driveAt > 0, 'the Drive original is not asked for');
  assert.ok(driveAt < route.indexOf('getR2Client()'), 'the Drive original must be tried before the 720p copy');
  assert.match(route, /if \(dropped && orig\)/, 'Drive is asked only once our original is gone');
  // The Drive copy must be the one the drop itself trusted.
  assert.match(read('lib/papic-original-from-drive.ts'), /isDriveCopyConfirmed\(/);
});

test('no screen still promises "6 months" for the originals', () => {
  for (const p of [
    'app/dashboard/[eventId]/memories/_components/memories-settings.tsx',
    'lib/memories-viewer.ts',
    'app/dashboard/[eventId]/studio/photo-delivery/_components/photo-delivery-panel.tsx',
    'app/dashboard/[eventId]/studio/photo-delivery/page.tsx',
    'app/(shell)/privacy/page.tsx',
  ]) {
    const src = read(p).replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|^\s*\/\/.*$/gm, ' ');
    assert.doesNotMatch(src, /after 6 months|for 6 months|6 months<\/strong> from|6 months<\/span> after/, `${p} still says 6 months`);
  }
});
