/**
 * a-host-added-is-told.test.ts — BEING MADE A HOST HAS TO REACH THE PERSON.
 *
 * Owner, 2026-09-28, about his own bride: *"it should show on her setnayan
 * account and not just email"* · *"creating someone a host needs no approval
 * from their side"* · *"they do not need to resign in. it should auto refresh"*.
 *
 * 🔴 WHAT WAS BROKEN. `inviteHost` sent nothing. It handed the inviter a link to
 * copy ("Email send via Resend ships in V1.1"), so the bride's June invite
 * expired unseen and nothing on her account ever said it existed.
 *
 * 🔑 FOUR HALVES OF ONE MECHANISM, and any one missing is silence: the Postgres
 * ENUM value (a TS-only member typechecks and the INSERT is refused in silence),
 * the email allowlist (NOT the marketing-gated set, which suppresses unless
 * marketing_opt_in — the mistake that once silenced six transactional types),
 * the EMIT in `inviteHost`, keyed on the row the database ACCEPTED rather than a
 * re-derivation, and the BELL's refresh on arrival — which is what puts the
 * event on a screen that is already open.
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
const TYPE = 'host_added';

const EMIT_SRC = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');
const ACTIONS = stripComments(
  readFileSync(join(WEB, 'app/dashboard/[eventId]/hosts/actions.ts'), 'utf8'),
);
const BELL = stripComments(readFileSync(join(WEB, 'app/_components/unread-bell-badge.tsx'), 'utf8'));

function setMembers(name: string): string[] {
  const at = EMIT_SRC.indexOf(`const ${name}`);
  assert.ok(at >= 0, `${name} not found — did the set move or get renamed?`);
  const body = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  assert.ok(members.length >= 1, `${name} parse floor: found ${members.length}`);
  return members;
}

test('the enum value exists in a migration — a TS-only type is refused at INSERT', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const hit = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .some((f) =>
      /ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'host_added'/.test(
        readFileSync(join(dir, f), 'utf8'),
      ),
    );
  assert.ok(hit, `no migration adds '${TYPE}' to public.notification_type`);
});

test('it has tray copy and a tone', () => {
  assert.ok(NOTIFICATION_TYPE_LABEL[TYPE]?.length);
  assert.ok(NOTIFICATION_TYPE_TONE[TYPE]?.length);
});

test('it is emailed, and never marketing-gated', () => {
  assert.ok(setMembers('EMAIL_ENABLED_TYPES').includes(TYPE), 'not on the email allowlist');
  assert.ok(
    !setMembers('MARKETING_GATED_EMAIL_TYPES').includes(TYPE),
    'in the marketing-gated set — it would reach nobody (marketing_opt_in is NOT NULL DEFAULT FALSE)',
  );
});

test('inviteHost emits it, keyed on the seat the DATABASE accepted', () => {
  assert.match(
    ACTIONS,
    /select\('moderator_id, user_id, accepted_at'\)/,
    'the insert must read back accepted_at + user_id — the trigger decides, the action reports',
  );
  assert.match(ACTIONS, /type:\s*'host_added'/, 'inviteHost no longer emits host_added');
  assert.match(ACTIONS, /userId:\s*inserted\.user_id/, 'the notice must go to the person added');
  assert.doesNotMatch(
    ACTIONS,
    /Email send via Resend ships in V1\.1/,
    'the "copy this link and send it yourself" note is back',
  );
});

test('the bell refreshes the open page when it arrives — no sign-in, no reload', () => {
  assert.match(BELL, /'host_added'/, 'UnreadBellBadge no longer reacts to host_added');
  assert.match(BELL, /router\.refresh\(\)/, 'UnreadBellBadge no longer refreshes on arrival');
});
