/**
 * part-finalization-notifications.test.ts — THE NOTIFICATION AND THE ALLOWLIST
 * ARE TWO HALVES OF ONE MECHANISM.
 *
 * 🔴 THE FAILURE THIS FILE EXISTS TO PREVENT, MEASURED ON THIS REPO'S OWN
 * HISTORY. Six `lock_request_*` types were emitted, were on the email
 * allowlist, and reached NOBODY — because they had also been pasted into
 * `MARKETING_GATED_EMAIL_TYPES`, whose only effect is to suppress unless
 * `users.marketing_opt_in = TRUE`, a column that is `NOT NULL DEFAULT FALSE`
 * with zero opted in. A supplier with a two-day fuse was never emailed; the
 * couple waiting on the answer never heard either.
 *
 * 🔑 AND THE TEST OF THE DAY COULD NOT SEE IT: it asserted membership of the
 * EMAIL set and never looked at the gated one, so both halves agreed with each
 * other and CI stayed green. Two lists, one checked.
 *
 * So this file checks THREE things at once for all five MB12 types — the
 * emitted type exists, it is on the email allowlist, and it is NOT in the
 * suppression set — and it checks the emit SITES, because a type that is
 * perfectly configured and never emitted is indistinguishable from one that is
 * emitted and configured wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPE_TONE, type NotificationType } from './notifications';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const EMIT_SRC = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');

/** All five, and the surface each one is fired from. */
const MB12_TYPES = [
  'part_finalization_requested',
  'part_finalization_agreed',
  'part_finalization_declined',
  'part_reopen_requested',
  'part_reopen_answered',
] as const;

const COUPLE_ACTIONS = join(
  WEB,
  'app',
  'dashboard',
  '[eventId]',
  'studio',
  'mood-board',
  'finalization-actions.ts',
);
const VENDOR_ACTIONS = join(
  WEB,
  'app',
  'vendor-dashboard',
  'clients',
  '[eventId]',
  'finalization-actions.ts',
);

/** Members of one Set literal in notification-emit.ts, comments stripped —
 *  a comment that DISCUSSES a type does not enable it. */
function setMembers(name: string): string[] {
  const at = EMIT_SRC.indexOf(`const ${name}`);
  assert.ok(at >= 0, `${name} not found — did the set move or get renamed?`);
  const body = EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const members = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!).filter(Boolean);
  // Floor: an empty parse reports a perfectly clean sweep.
  assert.ok(members.length >= 3, `${name} parse floor: found ${members.length}`);
  return members;
}

test('all five MB12 types are on the EMAIL allowlist', () => {
  const email = setMembers('EMAIL_ENABLED_TYPES');
  for (const t of MB12_TYPES) {
    assert.ok(
      email.includes(t),
      `${t} is emitted but not email-enabled — a supplier with 48 hours who never opens the ` +
        'dashboard is exactly who it exists for, so an in-app badge reaches precisely the ' +
        'people who do not need it',
    );
  }
});

test('and none of them is in the set that would silently suppress every one of them', () => {
  const gated = EMIT_SRC.slice(
    EMIT_SRC.indexOf('const MARKETING_GATED_EMAIL_TYPES'),
    EMIT_SRC.indexOf(']);', EMIT_SRC.indexOf('const MARKETING_GATED_EMAIL_TYPES')),
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const members = [...gated.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  for (const t of MB12_TYPES) {
    assert.ok(
      !members.includes(t),
      `${t} is marketing-gated. marketing_opt_in is NOT NULL DEFAULT FALSE, so that suppresses ` +
        'the email for every user — the exact mistake that silenced all six lock_request_* types',
    );
  }
  // Vacuity: the slice really is the gated set, which really does hold the one
  // genuinely engagement-shaped type.
  assert.ok(members.includes('new_chapter_from_followed'), 'the sliced set is not the gated one');
});

test('none of them buzzes a phone — a 48-hour design question is not a 2am push', () => {
  const push = setMembers('PUSH_ENABLED_TYPES');
  for (const t of MB12_TYPES) assert.ok(!push.includes(t), `${t} is on the push list`);
});

test('every type has tray copy and a badge — a type with no label renders as its raw key', () => {
  for (const t of MB12_TYPES) {
    const label = NOTIFICATION_TYPE_LABEL[t as NotificationType];
    assert.ok(label && label.trim().length > 0, `${t} has no label`);
    assert.ok(!label.includes('_'), `${t}'s label is the raw key`);
    assert.ok(NOTIFICATION_TYPE_TONE[t as NotificationType], `${t} has no badge colour`);
  }
});

test('every type is actually EMITTED — a perfectly configured type nobody sends reaches nobody', () => {
  // 🔑 THE HALF THE ALLOWLIST TEST CANNOT SEE. Membership proves the channel is
  // open; only the call site proves anything travels down it.
  const couple = readFileSync(COUPLE_ACTIONS, 'utf8');
  const vendor = readFileSync(VENDOR_ACTIONS, 'utf8');
  const both = `${couple}\n${vendor}`;
  for (const t of MB12_TYPES) {
    assert.ok(both.includes(`'${t}'`), `${t} is configured everywhere and emitted nowhere`);
  }
  // The direction matters too: the supplier hears the ASKS, the couple hears
  // the ANSWERS. Crossing them would send a couple their own question.
  assert.ok(couple.includes("'part_finalization_requested'"), 'the ask must come from the couple’s action');
  assert.ok(couple.includes("'part_reopen_requested'"), 'the re-open ask must come from the couple’s action');
  assert.ok(vendor.includes("'part_finalization_agreed'"), 'the yes must come from the supplier’s action');
  assert.ok(vendor.includes("'part_finalization_declined'"), 'the no must come from the supplier’s action');
  assert.ok(vendor.includes("'part_reopen_answered'"), 'the re-open answer must come from the supplier’s action');
});

test('a notification failure never rolls back the act it follows', () => {
  // Every emit in both files sits inside a try/catch that console.errors. The
  // ask is already recorded and the agreement already committed by the RPC; a
  // Resend hiccup must not undo either. (The daily digest is the net
  // underneath, not a substitute — which is why the allowlist assertions above
  // are the load-bearing ones.)
  for (const path of [COUPLE_ACTIONS, VENDOR_ACTIONS]) {
    const src = readFileSync(path, 'utf8');
    assert.ok(src.includes('catch'), `${path} emits with no failure handling`);
    assert.ok(src.includes('console.error'), `${path} swallows an emit failure silently`);
  }
});
