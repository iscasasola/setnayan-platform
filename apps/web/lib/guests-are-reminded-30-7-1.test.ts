/**
 * THE GUEST REMINDER EMAILS ARE WIRED, LOCKED, SWITCHABLE AND REGISTERED.
 *
 * The sender (`lib/guest-reminder-emails.ts`) is `server-only`, so this half
 * reads its SOURCE the way `nothing-was-refreshing-the-google-grants.test.ts`
 * reads the OAuth sweep — and executes what it can (the registry, the
 * sanitizer). The pure decisions live in `guest-reminder-emails-core.test.ts`.
 *
 * What this pins, each of which shipped wrong at least once elsewhere in this
 * repo:
 *   · the job is in `PERIODIC_JOBS` AND called through `runClaimedJob` with the
 *     registry's own gap — a key with no call site is a job nobody runs;
 *   · the lock is INSERTED BEFORE the send — the order is the idempotency;
 *   · the couple's switch is read from the live config before any guest is
 *     touched, and the Maker's RSVP page binds ONE switch to that key;
 *   · nobody is emailed without a key (the mail must link THEIR page), and the
 *     link is spelt by the ONE speller (`buildInvitationUrl`);
 *   · the migration's PRIMARY KEY is (guest, milestone, event date), RLS is on
 *     and anon is revoked;
 *   · no SMS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { GUEST_REMINDER_GAP_MS, findPeriodicJob } from './periodic-job-registry';
import { GUEST_REMINDERS_TIP } from './rsvp-ask';
import { TOURS, TOUR_KEYS } from './tours';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const ROOT = join(WEB, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SENDER = read('lib/guest-reminder-emails.ts');
const JOBS = read('lib/daily-email-jobs.ts');
const SETTINGS = read('app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx');
const LAUNCH = read('app/dashboard/[eventId]/launch/page.tsx');

test('ANCHOR — the files this guard reads exist and carry the symbols it looks for', () => {
  assert.match(SENDER, /export async function runGuestReminderEmails/);
  assert.match(JOBS, /export async function runDailyEmailJobs/);
  assert.match(SETTINGS, /export function MakerRsvpSettings/);
});

test('the sender is a REGISTERED job, every six hours, and it reports a count', () => {
  const job = findPeriodicJob('guest-reminder-emails');
  assert.ok(job, 'guest-reminder-emails is missing from PERIODIC_JOBS');
  assert.equal(job.gapMs, GUEST_REMINDER_GAP_MS);
  assert.equal(GUEST_REMINDER_GAP_MS, 6 * 60 * 60 * 1000);
  assert.equal(job.reportsCount, true);
  assert.equal(job.kind, 'operational');
  assert.match(job.what, /30 · 7 · 1/);
});

test('the job is CALLED through runClaimedJob with the registry’s own gap — one cadence, not two', () => {
  assert.match(JOBS, /runClaimedJob\(\s*'guest-reminder-emails'\s*,\s*GUEST_REMINDER_GAP_MS\s*,/);
  assert.match(JOBS, /import \{ GUEST_REMINDER_GAP_MS \} from '@\/lib\/periodic-job-registry'/);
  assert.match(JOBS, /runGuestReminderEmails\(\)/);
  assert.doesNotMatch(SENDER, /6 \* 60 \* 60 \* 1000/, 'the sender must not restate the cadence');
});

test('the sender imports the pure core rather than re-deciding anything', () => {
  for (const sym of ['dueMilestone', 'reminderEventDates', 'replyByLine', 'todayInZone', 'untickedItems', 'buildGuestReminderEmail']) {
    assert.ok(SENDER.includes(sym), `sender does not use ${sym}`);
  }
  assert.match(SENDER, /from '@\/lib\/guest-reminder-emails-core'/);
});

test('THE LOCK IS INSERTED BEFORE THE SEND, and released only when the send was refused', () => {
  const insertAt = SENDER.indexOf(".from('guest_reminder_email_log')\n    .insert(");
  const sendAt = SENDER.indexOf('await sendEmail({');
  assert.ok(insertAt > 0, 'no insert into guest_reminder_email_log');
  assert.ok(sendAt > insertAt, 'sendEmail must come AFTER the lock insert');
  assert.match(SENDER, /lockErr\.code !== '23505'/, 'a unique violation is the lock working, not a failure');
  const releaseAt = SENDER.indexOf(".from('guest_reminder_email_log')\n    .delete()");
  assert.ok(releaseAt > sendAt, 'the lock is released after a refused send');
  assert.match(SENDER, /if \(res\.ok\) \{/);
});

test('the couple’s switch is read from the LIVE config before any guest of that event is read', () => {
  const switchAt = SENDER.indexOf('readGuestReminders(ev.rsvp_ask_config)');
  const guestsAt = SENDER.indexOf(".from('guests')");
  assert.ok(switchAt > 0, 'the sender does not read the switch');
  assert.ok(guestsAt > switchAt, 'guests are read before the switch is checked');
  assert.match(SENDER, /if \(!readGuestReminders\(ev\.rsvp_ask_config\)\) return null;/);
});

test('no Resend key → return BEFORE any lock is claimed', () => {
  const gate = SENDER.indexOf('await isEmailConfigured()');
  const lock = SENDER.indexOf("from('guest_reminder_email_log')");
  assert.ok(gate > 0 && gate < lock);
});

test('who is never emailed: no key · no email · declined · passed away · deleted', () => {
  assert.match(SENDER, /\.not\('qr_token', 'is', null\)/);
  assert.match(SENDER, /\.not\('email', 'is', null\)/);
  assert.match(SENDER, /\.neq\('rsvp_status', 'declined'\)/);
  assert.match(SENDER, /\.eq\(PASSED_AWAY, false\)/);
  assert.match(SENDER, /\.is\('deleted_at', null\)/);
  assert.match(SENDER, /isSendableEmail\(g\.email\)/);
});

test('the link is the guest’s OWN page, spelt by the ONE speller', () => {
  assert.match(SENDER, /buildInvitationUrl\(\{ appUrl: APP_URL, slug: ev\.slug as string, qrToken: g\.qr_token as string, ownerSlug \}\)/);
  assert.doesNotMatch(SENDER, /\?invite=/, 'never re-type the invite url');
});

test('directions reach the email only for a guest who has replied — the page’s own venue rule', () => {
  assert.match(SENDER, /venueAddress: replied \? venueAddress : null/);
  assert.match(SENDER, /venueLatitude: replied \? venueLat : null/);
  assert.match(SENDER, /hasReplied\(/);
});

test('the day is counted in the EVENT’S calendar — its timezone, then the venue’s, then Manila', () => {
  assert.match(SENDER, /eventTimezoneFromCoords\(lat, lng\)/);
  assert.match(SENDER, /todayInZone\(tz, now\)/);
  assert.match(SENDER, /ev\.timezone/);
});

test('every Supabase call in the sender reads its error (the unread-error guard has no baseline line for it)', () => {
  const baseline = readFileSync(join(WEB, 'lib/supabase-unread-error.baseline.txt'), 'utf8');
  assert.doesNotMatch(baseline, /guest-reminder-emails\.ts/, 'a new file must not be added to the debt baseline');
});

test('no SMS — email only, via the one sendEmail', () => {
  assert.doesNotMatch(SENDER, /\b(sendSms|sendSMS|sendTextMessage|smsClient|SmsProvider)\b/);
  assert.match(SENDER, /import \{ isEmailConfigured, sendEmail \} from '@\/lib\/email'/);
  assert.match(SENDER, /kind: 'guest-reminder'/, 'the delivery log names the sender');
});

test('the Maker’s RSVP page binds ONE switch to the key the sender reads', () => {
  assert.match(SETTINGS, /data-rsvp-setting="guest-reminders"/);
  assert.match(SETTINGS, /save\(\{ guestReminders: v \}\)/);
  assert.match(SETTINGS, /readGuestReminders\(local\)/);
  assert.equal((SETTINGS.match(/guestReminders: v/g) ?? []).length, 1, 'exactly one switch writes the key');
  // Owner copy rules: the guest's page is never a "website" — in the COPY the
  // couple reads (the section and its tip), not in an import path.
  const start = SETTINGS.indexOf('data-rsvp-setting="guest-reminders"');
  const end = SETTINGS.indexOf('data-rsvp-setting="requests"');
  assert.ok(start > 0 && end > start, 'the reminders section sits before Requests');
  assert.doesNotMatch(SETTINGS.slice(start, end), /\bwebsite\b|\bsite\b|\bvendor/i);
  assert.doesNotMatch(GUEST_REMINDERS_TIP, /\bwebsite\b|\bsite\b|\bvendor|\bSMS\b/i);
});

test('the reminder switch gets its first-visit tour, mounted on the RSVP page and never on the Maker’s first visit', () => {
  assert.ok(TOUR_KEYS.includes('customer_guest_reminders_v1'));
  assert.equal(TOURS.customer_guest_reminders_v1.slides.length, 2);
  assert.match(LAUNCH, /\{!firstVisit \? <MiniTour tourKey="customer_guest_reminders_v1" storeShell=\{storeShell\} \/> : null\}/);
  const tourAt = LAUNCH.indexOf('tourKey="customer_guest_reminders_v1"');
  const settingsAt = LAUNCH.indexOf('<MakerRsvpSettings');
  assert.ok(tourAt > 0 && settingsAt > tourAt, 'the tour sits inside the RSVP page’s controls');
});

test('the migration: PK (guest, milestone, event date) · CHECK 30/7/1 · RLS on · revoked from anon AND authenticated · no signed-in policy (service role only)', () => {
  const dir = join(ROOT, 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_guest_reminder_email_log.sql'));
  assert.ok(file, 'migration missing');
  const sql = readFileSync(join(dir, file), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.guest_reminder_email_log/);
  assert.match(sql, /PRIMARY KEY \(guest_id, milestone_days, event_date\)/);
  assert.match(sql, /CHECK \(milestone_days IN \(30, 7, 1\)\)/);
  assert.match(sql, /ALTER TABLE public\.guest_reminder_email_log ENABLE ROW LEVEL SECURITY/);
  // Server-only ledger (exposure freeze, 2026-09-28): grants off for BOTH roles,
  // and no policy for a signed-in role — the reminder job writes with the service role.
  assert.match(sql, /REVOKE ALL ON public\.guest_reminder_email_log FROM anon, authenticated/);
  assert.doesNotMatch(sql, /CREATE POLICY/);
  assert.match(sql, /REFERENCES public\.guests\(guest_id\) ON DELETE CASCADE/);
});
