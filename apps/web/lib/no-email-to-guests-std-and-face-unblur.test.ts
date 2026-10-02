/**
 * NO EMAIL TO GUESTS — the save-the-date fan-out and the face-unblur notice.
 *
 * Owner 2026-10-02 (DECISION_LOG "FIVE AUDIT QUESTIONS ANSWERED" #1, on top of
 * 2026-09-29 "No email. Either use the qr and link only"): the save-the-date
 * email fan-out and the face-unblur notice to a guest are STOPPED. Couples and
 * suppliers keep their emails. "Replace means remove": the send code and the
 * email templates are deleted, not switched off.
 *
 * Sabotage notes (each verified red once):
 *   · re-add `import { fanOutSaveTheDateEmails }` to launchSaveTheDate → RED
 *   · restore lib/save-the-date-emails.ts → RED
 *   · re-export buildSaveTheDateGuestEmail from the core → RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the save-the-date / invitation GUEST fan-out module no longer exists', () => {
  assert.equal(
    existsSync(join(WEB, 'lib/save-the-date-emails.ts')),
    false,
    'lib/save-the-date-emails.ts is back — it mails every guest on launch',
  );
});

test('the guest email templates are deleted from the pure core', async () => {
  const mod = (await import('./save-the-date-emails-core')) as Record<string, unknown>;
  for (const name of ['buildSaveTheDateGuestEmail', 'buildInvitationGuestEmail', 'STD_SUPPORT_EMAIL']) {
    assert.equal(name in mod, false, `${name} is exported again — a guest email can be built`);
  }
  // …while the helpers the (switched-off) reminder sender still shares remain.
  for (const name of ['isSendableEmail', 'resolveCoupleName', 'stdGuestGreetingName', 'formatWeddingDate']) {
    assert.equal(typeof mod[name], 'function', `${name} was removed but guest-reminder-emails still uses it`);
  }
  const core = readCode('lib/save-the-date-emails-core.ts');
  assert.ok(core.length > 300, 'the core stripped to nothing — this guard would be vacuous');
  assert.doesNotMatch(core, /renderBrandedEmail|List-Unsubscribe/, 'the core still shapes an email');
});

test('no caller launches a guest email: not the launch button, not the scheduled launch', () => {
  const callers: Array<[string, string]> = [
    ['app/dashboard/[eventId]/studio/save-the-date/actions.ts', 'launchSaveTheDate'],
    ['app/[slug]/page.tsx', 'isScheduledLaunchDue'],
  ];
  for (const [rel, anchor] of callers) {
    const src = readCode(rel);
    assert.ok(src.includes(anchor), `${rel}: anchor ${anchor} not found — the guard is pointed at nothing`);
    assert.doesNotMatch(src, /fanOutSaveTheDateEmails|fanOutInvitationEmails|save-the-date-emails['"]/, `${rel} still fans out a guest email`);
  }
  // The launch still PUBLISHES — only the mail went.
  assert.match(readCode('app/dashboard/[eventId]/studio/save-the-date/actions.ts'), /publishSaveTheDate\(supabase, eventId\)/);
  assert.match(readCode('app/[slug]/page.tsx'), /publishSaveTheDate\(admin, event\.event_id\)/);
});

test('the guest card save sends no face-unblur email', () => {
  const src = readCode('app/dashboard/[eventId]/guests/[guestId]/actions.ts');
  assert.ok(src.includes('export async function updateGuest'), 'updateGuest not found');
  assert.doesNotMatch(src, /no longer blurred|blurWasOn/, 'the face-unblur notice is back');
  assert.doesNotMatch(src, /sendEmail\(\{[\s\S]{0,200}subject: 'Your face/, 'a face notice is emailed');
});
