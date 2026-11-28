/**
 * a-chat-reminder-stays-in-the-app.test.ts — ⏰ A "REMIND ME" COMES BACK IN THE APP, TO ITS OWNER, AND ONLY IF THEY CAN
 * STILL READ THE MESSAGE (Unichat H1; approved prototype v3, DECISION_LOG 2026-11-20).
 *
 * The standing rule (owner 2026-10-11, "i thought we can manage without emails?"): no new emails without his word —
 * `the-email-allowlist-is-frozen.test.ts`. And the 19 Nov Unichat ruling: "the app sends none by itself (no new
 * emails)". This fails if:
 *   • `chat_reminder` reaches EMAIL_ENABLED_TYPES (or the marketing-gated set);
 *   • it stops being a real kind (label · push level · its own enum migration — an INSERT would be refused in silence);
 *   • the delivery stops reading the message UNDER THE PERSON'S OWN RLS before it claims, or claims before it reads
 *     (a refused read would then eat the reminder — a failure that looks like "nothing was due");
 *   • the delivery tells a person about a message it could not read for them;
 *   • the signed-in shells stop calling it (a reminder nobody delivers looks exactly like one that was never set).
 *
 * SABOTAGE (each seen red, restored): add 'chat_reminder' to EMAIL_ENABLED_TYPES · weaken `if (!m || m.unsent_at)
 * return false` to skip only unsent · remove the call from lib/dashboard-shell.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { NOTIFICATION_TYPE_LABEL } from './notifications';
import { PUSH_LEVEL } from './push-levels';

const WEB = process.cwd();
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));
const EMIT = src('lib', 'notification-emit.ts');
const DELIVER = src('lib', 'chat-reminders.server.ts');

function members(name: string): string[] {
  const start = EMIT.indexOf(`const ${name}`);
  assert.ok(start > -1, `${name} moved — this guard is blind`);
  const open = EMIT.indexOf('new Set([', start);
  const close = EMIT.indexOf(']);', open);
  assert.ok(open > start && close > open, `could not bound ${name}`);
  return [...EMIT.slice(open, close).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!);
}

test('chat_reminder is NOT on the email allowlist, nor the marketing-gated one', () => {
  assert.ok(members('EMAIL_ENABLED_TYPES').length > 10, 'the email allowlist read came back too short — guard is blind');
  assert.ok(!members('EMAIL_ENABLED_TYPES').includes('chat_reminder'), 'a chat reminder now EMAILS');
  assert.ok(!members('MARKETING_GATED_EMAIL_TYPES').includes('chat_reminder'), 'chat_reminder is on an email list');
});

test('it is a real notification kind: labelled, a push level, an enum value in its own migration', () => {
  assert.ok(NOTIFICATION_TYPE_LABEL.chat_reminder, 'no tray label');
  assert.ok(PUSH_LEVEL.chat_reminder, 'no push level');
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const adds = readdirSync(dir).filter((f) => /ADD VALUE IF NOT EXISTS 'chat_reminder'/.test(readFileSync(join(dir, f), 'utf8')));
  assert.equal(adds.length, 1, 'the enum value needs exactly one migration');
  // …and that migration does nothing else: a new enum value cannot be USED in the transaction that adds it.
  const body = readFileSync(join(dir, adds[0]!), 'utf8').replace(/^--.*$/gm, '');
  assert.doesNotMatch(body, /CREATE |INSERT |UPDATE /i);
});

test('the delivery reads the message under the person’s own session BEFORE it claims, and tells only what it read', () => {
  const read = DELIVER.indexOf("supabase.from('chat_messages')");
  const claim = DELIVER.indexOf("rpc('claim_my_due_chat_reminders')");
  const emit = DELIVER.indexOf('deps.notify(');
  assert.ok(read > -1 && claim > -1 && emit > -1, 'the delivery moved — this guard is blind');
  assert.ok(read < claim, 'the claim runs before the message read: a refused read would eat the reminder');
  assert.ok(claim < emit);
  // The message read is the PERSON's client (their RLS), never the service role — and the real notifier is the default.
  assert.doesNotMatch(DELIVER, /admin\s*\.from\('chat_messages'\)/, 'the service role reads the message — RLS no longer decides');
  assert.match(DELIVER, /const REAL_DEPS: ReminderDeps = \{ notify: emitNotification,/, 'the default notifier is no longer the real one');
  // The claim takes every due row, so the due read is never capped (#8071 review — the 21st reminder was lost).
  assert.doesNotMatch(DELIVER.slice(0, read), /\.limit\(/, 'the due read is capped again — the claim would eat the rest');
  // A failed read stops before the claim.
  const between = DELIVER.slice(read, claim);
  assert.match(between, /if \(read\.error\) \{[\s\S]*?return 0;/, 'a refused message read no longer stops the delivery');
  // No readable message → nothing is said.
  // (`return false` since the notices go out together, speed audit L1 — the reminder is skipped either way.)
  assert.match(DELIVER.slice(claim, emit), /if \(!m \|\| m\.unsent_at\) (continue|return false);/, 'a message the person cannot read is announced anyway');
  assert.match(DELIVER, /type: 'chat_reminder'/);
  assert.match(DELIVER, /userId,\s*\n\s*type: 'chat_reminder'/, 'the notice goes to someone other than the person who set it');
});

test('both signed-in shells deliver what is due, before they count the bell', () => {
  // Either the old chain (deliver, THEN count) or the one-round helper (count beside the delivery, asked again after
  // any notice) — both put today's due reminders in the bell. `lib/the-bell-counts-beside-the-reminders.test.ts` holds
  // the helper's own order.
  for (const file of [
    ['lib', 'dashboard-shell.ts'],
    ['app', 'vendor-dashboard', 'layout.tsx'],
  ]) {
    const shell = src(...file);
    assert.match(
      shell,
      /deliverDueChatReminders\(supabase, [a-zA-Z.]+\)\s*\.then\(\(\) => countUnread\(|unreadCountWithDueReminders\(supabase, [a-zA-Z.]+\)/,
      `${file.join('/')} no longer delivers due chat reminders before the bell count`,
    );
  }
});
