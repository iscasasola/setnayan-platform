/**
 * colour-change-notifications.test.ts — THE NOTIFICATION *IS* THE OVERSIGHT.
 *
 * 🔑 THIS ONE MATTERS MORE THAN ITS MB12 SIBLING, AND HERE IS WHY.
 * Every other handshake in this product has a screen the person is already
 * waiting in front of: a supplier with a 48-hour fuse, a couple waiting on an
 * answer. MB16 deliberately has NO PER-CHANGE APPROVAL — the owner's ruling is
 * that the couple grants standing access once and the holder then edits freely.
 * So `colour_changed_in_lane` is the ONLY thing that tells a couple somebody
 * else moved their colours. Drop it, or send it down a channel that is switched
 * off, and the feature becomes "people can change your wedding and you find out
 * on the day".
 *
 * 🔴 THE FAILURE, MEASURED ON THIS REPO'S OWN HISTORY. Six `lock_request_*`
 * types were emitted, were on the email allowlist, and reached NOBODY —
 * because they had also been pasted into `MARKETING_GATED_EMAIL_TYPES`, whose
 * only effect is to suppress unless `users.marketing_opt_in = TRUE`, a column
 * that is NOT NULL DEFAULT FALSE with zero users opted in. And the test of the
 * day could not see it: it asserted membership of the EMAIL set and never
 * looked at the gated one. Two lists, one checked.
 *
 * So this checks FOUR things at once: the type exists with tray copy, it is on
 * the email allowlist, it is NOT in the suppression set, and it is actually
 * EMITTED — because a perfectly configured type nobody sends is
 * indistinguishable from one that is sent and configured wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE,
  type NotificationType,
} from './notifications';
// 🔑 THE ONE STRIPPER. A two-replace regex opens a comment on any `/*` inside a
// string and blanks real code to the next close — so the set it parses could be
// missing members nobody can see. See lib/strip-comments.ts.
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const EMIT_SRC = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');
const ACTIONS_PATH = join(WEB, 'app', 'dashboard', '[eventId]', 'colour-access-actions.ts');
const ACTIONS = readFileSync(ACTIONS_PATH, 'utf8');

const TYPE = 'colour_changed_in_lane';

/** Members of one Set literal in notification-emit.ts, comments stripped —
 *  a comment that DISCUSSES a type does not enable it. */
function setMembers(name: string): string[] {
  const at = EMIT_SRC.indexOf(`const ${name}`);
  assert.ok(at >= 0, `${name} not found — did the set move or get renamed?`);
  const body = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!).filter(Boolean);
  // Floor: an empty parse reports a perfectly clean sweep.
  assert.ok(members.length >= 3, `${name} parse floor: found ${members.length}`);
  return members;
}

test('the type is on the EMAIL allowlist — an in-app badge cannot reach a couple who is out', () => {
  assert.ok(
    setMembers('EMAIL_ENABLED_TYPES').includes(TYPE),
    `${TYPE} is emitted but not email-enabled. There is no per-change approval in this ` +
      'mechanism, so this notice is the whole of the couple’s oversight — an in-app-only ' +
      'badge reaches precisely the couples who are already looking.',
  );
});

test('and it is NOT in the set that would silently suppress it for every user', () => {
  const at = EMIT_SRC.indexOf('const MARKETING_GATED_EMAIL_TYPES');
  const gated = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...gated.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  assert.ok(
    !members.includes(TYPE),
    `${TYPE} is marketing-gated. marketing_opt_in is NOT NULL DEFAULT FALSE, so that ` +
      'suppresses the email for every user — the exact mistake that silenced all six ' +
      'lock_request_* types.',
  );
  // Vacuity: the slice really is the gated set, which really does hold the one
  // genuinely engagement-shaped type.
  assert.ok(members.includes('new_chapter_from_followed'), 'the sliced set is not the gated one');
});

test('it does not buzz a phone — a colour is not a 2am push', () => {
  assert.ok(!setMembers('PUSH_ENABLED_TYPES').includes(TYPE));
});

test('it has tray copy and a badge — a type with no label renders as its raw key', () => {
  const label = NOTIFICATION_TYPE_LABEL[TYPE as NotificationType];
  assert.ok(label && label.trim().length > 0, 'no label');
  assert.ok(!label.includes('_'), 'the label is the raw key');
  assert.ok(NOTIFICATION_TYPE_TONE[TYPE as NotificationType], 'no badge colour');
});

test('it is ENABLED IN THE DATABASE — the enum and the union are two halves', () => {
  // A TS-only member typechecks and then the INSERT is refused; emitNotification
  // console.errors it by design so the action still completes, and the only
  // symptom is a couple who is never told.
  const migration = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations',
      '20271204557031_notification_type_colour_changed_in_lane.sql'),
    'utf8',
  );
  assert.ok(
    migration.includes(`ADD VALUE IF NOT EXISTS '${TYPE}'`),
    'the enum value migration does not add this label',
  );
  // Its own file, no transaction — Postgres forbids USING a new enum value in
  // the transaction that adds it.
  assert.ok(!/^\s*BEGIN;/m.test(migration), 'the enum migration is wrapped in a transaction');
});

test('it is actually EMITTED — a configured type nobody sends reaches nobody', () => {
  // 🔑 THE HALF THE ALLOWLIST TEST CANNOT SEE. Membership proves the channel is
  // open; only the call site proves anything travels down it.
  const src = stripComments(ACTIONS);
  assert.ok(src.includes(`'${TYPE}'`), `${TYPE} is configured everywhere and emitted nowhere`);
  assert.ok(src.includes('emitNotification'), 'the actions file emits nothing at all');
});

test('the emit is wired to applyColourChange, and to nothing else', () => {
  // Direction matters: the COUPLE hears about a change somebody else made. An
  // emit hung off the grant or the reject would tell them about their own act.
  const src = stripComments(ACTIONS);
  const apply = src.slice(src.indexOf('export async function applyColourChange'));
  assert.ok(
    apply.includes('notifyCoupleOfColourChange'),
    'applyColourChange does not notify — the only oversight in the mechanism is missing',
  );
  const notify = src.slice(src.indexOf('async function notifyCoupleOfColourChange'));
  assert.ok(
    /member_type[^\n]*'couple'/.test(notify),
    'the notice is not aimed at the couple',
  );
});

test('the notice can only be sent on a change that ACTUALLY LANDED', () => {
  // 🔴 apply_colour_change returns `frozen` when MB12's freeze reverted the
  // write inside the same statement. Notifying then would tell the couple a
  // colour changed when nothing did — and hand them a Reject button for it.
  const src = stripComments(ACTIONS);
  const apply = src.slice(
    src.indexOf('export async function applyColourChange'),
    src.indexOf('export async function rejectColourChange'),
  );
  assert.ok(apply.length > 400, `apply slice floor: ${apply.length} chars`);
  assert.ok(apply.includes("'frozen'"), 'applyColourChange does not handle the frozen answer');
  assert.ok(
    apply.indexOf("return { status: 'frozen' }") < apply.indexOf('notifyCoupleOfColourChange'),
    'the frozen answer is not returned BEFORE the notify — a couple would be told about ' +
      'a change that never happened',
  );
});

test('a notification failure never rolls back the change it follows', () => {
  // The change is already committed by the RPC; a Resend hiccup must not undo
  // it. (The daily digest is the net underneath, not a substitute — which is
  // why the allowlist assertion above is the load-bearing one.)
  assert.ok(ACTIONS.includes('catch'), 'the emit has no failure handling');
  assert.ok(ACTIONS.includes('console.error'), 'an emit failure is swallowed silently');
});
