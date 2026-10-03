/**
 * a-schedule-request-reaches-the-coordinator.test.ts — A SUPPLIER'S SCHEDULE
 * REQUEST REACHES EVERYONE WHO CAN SAY YES, AND NOBODY WHO CANNOT.
 *
 * Owner, 2026-10-03 (DECISION_LOG "SUPPLIERS WRITE THEIR OWN PART OF THE
 * SCHEDULE"): a supplier's add / edit / delete is a request "the couple (or the
 * coordinator, The Day = Edit) is notified [of] and APPROVES or DECLINES".
 *
 * 🔴 WHAT WAS BROKEN. `suggestScheduleChange` fanned out over `event_members`
 * rows of type 'couple' — and stopped. A coordinator holding The Day = Edit can
 * approve the request (the suggestion UPDATE policy admits
 * `moderator_area_level(…,'schedule') = 'edit'`) and was never told it existed.
 * And the type it used, `schedule_suggestion`, is NOT on the email allowlist,
 * so even the couple heard only if they were already in the app.
 *
 * 🔑 THE NOTIFICATION, THE ALLOWLIST AND THE ENUM ARE ONE MECHANISM. This file
 * checks all three halves plus the picker itself; the DB half (the enum value
 * and the real columns the loader reads) is
 * tests/db/a-supplier-asks-only-about-its-own-items.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPE_TONE } from './notifications';
import { NOTIFICATION_EMAIL_REASONS } from './notification-email-reason';
import {
  scheduleRequestRecipients,
  scheduleRequestTitle,
  type ScheduleRequestSeat,
} from './schedule-request-recipients';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const REPO = join(WEB, '..', '..');
const TYPE = 'schedule_change_requested';

const EMIT_SRC = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');
function setMembers(name: string, floor: number): string[] {
  const at = EMIT_SRC.indexOf(`const ${name}`);
  assert.ok(at >= 0, `${name} not found — did the set move or get renamed?`);
  const body = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  assert.ok(members.length >= floor, `${name} parse floor: found ${members.length}`);
  return members;
}

const seat = (
  user_id: string,
  schedule: 'edit' | 'view' | null,
  extra: Partial<ScheduleRequestSeat> = {},
): ScheduleRequestSeat => ({
  user_id,
  accepted_at: '2026-09-01T00:00:00Z',
  removed_at: null,
  permissions_json: {
    edit_all: false,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: { schedule },
  },
  ...extra,
});

const OPEN_WINDOW = { eventDate: '2026-12-12', eventEndDate: null, precision: 'day' };
const NOW = new Date('2026-10-04T00:00:00Z');

// ─── 1 · who is told ───────────────────────────────────────────────────────

test('the couple AND a coordinator holding The Day = Edit are told', () => {
  const got = scheduleRequestRecipients({
    coupleUserIds: ['couple-a', 'couple-b'],
    seats: [seat('coord', 'edit')],
    window: OPEN_WINDOW,
    now: NOW,
  });
  assert.deepEqual(got, ['couple-a', 'couple-b', 'coord']);
});

test('nobody who cannot approve is told — View, Off, unaccepted, removed, expired', () => {
  const got = scheduleRequestRecipients({
    coupleUserIds: ['couple'],
    seats: [
      seat('view', 'view'),
      seat('off', null),
      seat('invited', 'edit', { accepted_at: null }),
      seat('removed', 'edit', { removed_at: '2026-09-20T00:00:00Z' }),
      seat('no-user', 'edit', { user_id: null }),
    ],
    window: OPEN_WINDOW,
    now: NOW,
  });
  assert.deepEqual(got, ['couple']);

  // The window closes 7 days after the event (owner 2026-09-14) — a
  // coordinator past it cannot approve, so is not told.
  const late = scheduleRequestRecipients({
    coupleUserIds: ['couple'],
    seats: [seat('coord', 'edit')],
    window: { eventDate: '2026-09-01', eventEndDate: null, precision: 'day' },
    now: NOW,
  });
  assert.deepEqual(late, ['couple']);
});

test('a host seat with no areas map (the couple’s own partner rows) follows the legacy rule', () => {
  // `resolveAreaLevel` — the one mirror of `moderator_area_level` — gives
  // edit_all rows 'edit'. A partner backfilled as a moderator is ALSO a couple
  // member: told once, not twice.
  const got = scheduleRequestRecipients({
    coupleUserIds: ['partner'],
    seats: [
      { user_id: 'partner', accepted_at: '2026-01-01', removed_at: null, permissions_json: { edit_all: true, checkout: false, invite_hosts: true, remove_hosts: false } },
      { user_id: 'tita', accepted_at: '2026-01-01', removed_at: null, permissions_json: { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false } },
    ],
    window: OPEN_WINDOW,
    now: NOW,
  });
  assert.deepEqual(got, ['partner'], 'edit_all partner once; a view-only legacy row not at all');
});

test('the title names the supplier, the ask and the moment', () => {
  const t = (kind: 'new' | 'adjust' | 'remove', proposesChange = true) =>
    scheduleRequestTitle({ supplierName: 'Lumen Lights', kind, itemLabel: 'First dance', proposesChange });
  assert.equal(t('new'), 'Lumen Lights asked to add “First dance” to the schedule');
  assert.equal(t('remove'), 'Lumen Lights asked to remove “First dance” from the schedule');
  assert.equal(t('adjust'), 'Lumen Lights asked to change “First dance”');
  assert.equal(t('adjust', false), 'Lumen Lights suggested a change to “First dance”');
});

// ─── 2 · the three halves of the mechanism ─────────────────────────────────

test('the type is on the EMAIL allowlist and NOT in the marketing-gated set', () => {
  assert.ok(setMembers('EMAIL_ENABLED_TYPES', 20).includes(TYPE), 'a tray badge reaches nobody away from the console');
  assert.ok(
    !setMembers('MARKETING_GATED_EMAIL_TYPES', 1).includes(TYPE),
    'the gated set suppresses unless marketing_opt_in — it would silence this for everybody',
  );
  assert.ok(NOTIFICATION_EMAIL_REASONS[TYPE], 'an allowlisted type carries its own reason line');
  assert.ok(NOTIFICATION_TYPE_LABEL[TYPE] && NOTIFICATION_TYPE_TONE[TYPE]);
});

test('the enum value is added by a migration of its own', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const hits = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => new RegExp(`ADD VALUE IF NOT EXISTS '${TYPE}'`).test(readFileSync(join(dir, f), 'utf8')));
  assert.equal(hits.length, 1, `expected one migration adding '${TYPE}', found ${hits.length}`);
});

test('the supplier’s request goes through the one notifier, with the new type', () => {
  const action = stripComments(
    readFileSync(join(WEB, 'app', 'vendor-dashboard', 'clients', '[eventId]', 'actions.ts'), 'utf8'),
  );
  const fn = action.slice(
    action.indexOf('export async function suggestScheduleChange'),
    action.indexOf('export async function', action.indexOf('export async function suggestScheduleChange') + 10),
  );
  assert.ok(fn.length > 500, 'could not slice suggestScheduleChange');
  assert.ok(fn.includes('notifyScheduleRequest('), 'the request no longer reaches the approvers');
  assert.ok(
    !/member_type['"]?\s*,\s*['"]couple/.test(fn) && !fn.includes("'schedule_suggestion'"),
    'a second, couple-only fan-out is back inside the action',
  );

  const notifier = stripComments(readFileSync(join(HERE, 'schedule-request-notify.server.ts'), 'utf8'));
  assert.ok(notifier.includes(`type: '${TYPE}'`));
  assert.ok(notifier.includes('emitNotification('), 'one mechanism — emitNotification — never a second');
  assert.ok(notifier.includes('scheduleRequestRecipients('), 'the picker this file executes is the one used');
});
