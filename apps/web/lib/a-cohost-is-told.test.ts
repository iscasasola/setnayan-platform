/**
 * a-cohost-is-told.test.ts — BEING MADE A CO-HOST REACHES THE PERSON, FROM
 * EVERY DOOR, AND THE EMAIL DOOR IS THE HIRED PLANNER'S ONLY.
 *
 * Owner 2026-09-28: co-hosts come FROM THE GUEST LIST ("accepted guests can be
 * assigned as host"); "When they joined and is assigned to be a host they will
 * get a notification (You are now a host for (user name)'s (event name)
 * (event type) event. you have access to the following. ... (CONFIRM)"; "they
 * do not need to resign in. it should auto refresh".
 *
 * 🔑 THE NOTICE IS WRITTEN BY THE DATABASE (`activate_guest_seats`, migration
 * 20271251336140) at the moment the seat goes live — the co-host's Access pick,
 * the guest's YES, or their account link, whichever is last. So this file
 * checks the four halves that make it reach a person: the ENUM value, the tray
 * copy, the SQL that inserts it, and the BELL that refreshes an open page when
 * it lands. And it pins that it is NOT on the email allowlist: a row inserted by
 * SQL never passes emitNotification, so listing it would claim an email that is
 * never sent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPE_TONE } from './notifications';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const REPO = join(WEB, '..', '..');
const TYPE = 'cohost_added';
const MIGRATIONS = join(REPO, 'supabase', 'migrations');

const EMIT_SRC = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');
const ACTIONS = stripComments(
  readFileSync(join(WEB, 'app/dashboard/[eventId]/hosts/actions.ts'), 'utf8'),
);
const BELL = stripComments(readFileSync(join(WEB, 'app/_components/unread-bell-badge.tsx'), 'utf8'));
const migration = (re: RegExp) =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .some((s) => re.test(s));

function setMembers(name: string): string[] {
  const at = EMIT_SRC.indexOf(`const ${name}`);
  assert.ok(at >= 0, `${name} not found — did the set move or get renamed?`);
  const body = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  assert.ok(members.length >= 3, `${name} parse floor: found ${members.length}`);
  return members;
}

test('the enum value exists in a migration — a TS-only type is refused at INSERT', () => {
  assert.ok(
    migration(/ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'cohost_added'/),
    `no migration adds '${TYPE}' to public.notification_type`,
  );
});

test('the database writes the notice when a seat goes live, in the owner’s words', () => {
  assert.ok(migration(/'cohost_added',\s*\n\s*left\(format\('You are now a %s for %s%s event\.'/),
    'activate_guest_seats no longer writes "You are now a … for …\'s … event."');
  assert.ok(migration(/You have access to the following:/), 'the access list is gone from the notice');
});

test('it has tray copy and a tone', () => {
  assert.ok(NOTIFICATION_TYPE_LABEL[TYPE]?.length);
  assert.ok(NOTIFICATION_TYPE_TONE[TYPE]?.length);
});

test('it is NOT on the email allowlist — nothing would ever send it', () => {
  assert.ok(!setMembers('EMAIL_ENABLED_TYPES').includes(TYPE));
});

test('the bell refreshes an open page when it arrives — no sign-in, no reload', () => {
  assert.match(BELL, /'cohost_added'/, 'UnreadBellBadge no longer reacts to cohost_added');
  assert.match(BELL, /router\.refresh\(\)/, 'UnreadBellBadge no longer refreshes on arrival');
});

test('the email invite is the hired planner’s only; co-hosts come from the guest list', () => {
  assert.match(
    ACTIONS,
    /if \(role !== 'wedding_planner_external'\) \{\s*throw new Error\('Co-hosts are chosen from your guest list\.'\)/,
    'inviteHost accepts a non-planner role again — co-hosts would bypass the guest list',
  );
});

test('only a co-host invites, revokes or removes — never a planner or a limited helper', () => {
  const fn = (name: string) => {
    const at = ACTIONS.indexOf(`export async function ${name}(`);
    assert.ok(at >= 0, `${name} not found`);
    return ACTIONS.slice(at, ACTIONS.indexOf('\nexport async function', at + 1));
  };
  for (const name of ['inviteHost', 'revokeHostInvite', 'removeHost']) {
    assert.match(fn(name), /await requireCoupleMembership\(eventId\)/, `${name} is not co-host-gated`);
  }
  assert.doesNotMatch(ACTIONS, /function requireHostMembership\(/, 'the any-seat gate is back');
});

test('removing a co-host reads the database’s answer — a celebrant refusal is never a success banner', () => {
  const at = ACTIONS.indexOf('export async function removeHost(');
  const body = ACTIONS.slice(at, ACTIONS.indexOf('\nexport async function', at + 1));
  assert.match(body, /const \{ error: removeError \}/, 'removeHost ignores the update result again');
  assert.match(body, /celebrant_cohost_locked/, 'the celebrant refusal is not translated');
});
