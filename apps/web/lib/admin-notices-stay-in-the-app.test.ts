/**
 * 📥 ADMIN GETS ONE EMAIL A DAY — THE MORNING DIGEST; EVERY OTHER ADMIN NOTICE STAYS IN THE APP (owner 2026-11-15:
 * "i see the emails but i dont want to flood my mail. i want everything organized here." … "on the app" — then
 * "morning digest is fine. 1 email a day. not every notification").
 *
 * An admin recipient of a per-event admin notice gets NO `sendEmail` call: the bell row and the phone push carry it.
 * The morning digest still sends. Emails to couples, guests and suppliers are unchanged — the gate is the notice's
 * audience, never its kind or the person.
 *
 * SABOTAGE: drop `!isAdminNotice(args)` from the email gate → RED; send an admin fan-out through `emitNotification`
 * again → RED (it names the file); gate the digest off → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import { isAdminNotice } from './admin/admin-notices-stay-in-the-app';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('the rule: a per-event notice for the admins is never emailed', () => {
  assert.equal(isAdminNotice({ adminNotice: true }), true);
  assert.equal(isAdminNotice({ email: { audience: 'admin' } }), true, 'the admin email parts mark an admin notice');
  assert.equal(isAdminNotice({}), false, 'a couple’s, guest’s or supplier’s notice is withheld');
  assert.equal(isAdminNotice({ adminNotice: false, email: {} }), false);
});

test('an admin notice never reaches sendEmail — the bell and the push still carry it', () => {
  const src = read('lib/notification-emit.ts');
  assert.match(src, /emitAdminNotice\(args: Omit<EmitNotificationArgs, 'adminNotice'>\)[\s\S]{0,120}emitNotification\(\{ \.\.\.args, adminNotice: true \}\)/);
  const gate = src.indexOf('if (EMAIL_ENABLED_TYPES.has(type) && !isAdminNotice(args)) {');
  assert.ok(gate > 0, 'the email gate no longer withholds an admin notice');
  const sends = [...src.matchAll(/\bsendEmail\(\{/g)].map((m) => m.index!);
  assert.equal(sends.length, 1, 'a second email path in emitNotification — it must sit behind the same gate');
  const push = src.indexOf('isAnyPushConfigured() && pushDecision(type');
  assert.ok(sends[0]! > gate && sends[0]! < push, 'the one sendEmail is outside the admin-notice gate');
  assert.ok(push > gate, 'the push must still run for an admin notice (push is unchanged)');
});

test('every admin fan-out sends through emitAdminNotice', () => {
  // An admin fan-out = a read of the admin set off `users`, then a notice to each of them.
  const ADMIN_READ = /\.or\('[^']*is_internal\.eq\.true[^']*'\)|\.from\('users'\)\.select\('user_id'\)\.eq\('account_type', 'admin'\)/g;
  const bad: string[] = [];
  let fanouts = 0;
  for (const file of [...walk(join(WEB, 'lib')), ...walk(join(WEB, 'app'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(ADMIN_READ)) {
      const after = src.slice(m.index! + m[0].length);
      const next = after.match(/\bemit(?:AdminNotice|Notification)\(/);
      if (!next) continue; // an admin read that notifies nobody (a count, a list, the referral owner)
      fanouts += 1;
      if (next[0] !== 'emitAdminNotice(') bad.push(relative(WEB, file));
    }
  }
  assert.deepEqual(bad, [], `admin fan-outs that would email the admins:\n${bad.join('\n')}`);
  assert.ok(fanouts >= 8, `the walker found only ${fanouts} admin fan-outs — did the admin read change shape?`);
});

test('the morning digest is the admin’s one email a day — it still sends, with its switch', () => {
  const flush = read('lib/admin/digest-flush.ts');
  assert.match(flush, /await sendEmail\(\{ to, subject, text, html, kind: DIGEST_EMAIL_KIND \}\)/, 'the morning digest stopped emailing');
  assert.doesNotMatch(flush, /isAdminNotice|emitAdminNotice/, 'the digest is gated like a per-event notice');
  assert.match(read('app/admin/settings/_components/morning-digest-card.tsx'), /action=\{saveAdminDigest\}/, 'the digest switch is gone');
});
