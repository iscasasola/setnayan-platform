/**
 * The five lock-handshake notification types are wired END TO END.
 *
 * The two exhaustive `Record<NotificationType, …>` maps are already enforced by
 * the compiler — a missing key is a typecheck failure. This suite exists for the
 * part the compiler CANNOT see: membership of `EMAIL_ENABLED_TYPES`, which is a
 * runtime Set. A new type is in-app-only by default, and for a request carrying
 * a 7-day fuse that is a silent product bug: the supplier who never opens the
 * dashboard is exactly the one the window will run out on. For the day-5 nudge
 * it defeats the entire purpose the owner ordered it for.
 *
 * The label/tone assertions are here so a failure NAMES the type rather than
 * pointing at an object literal.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE,
  type NotificationType,
} from './notifications';

const HERE = dirname(fileURLToPath(import.meta.url));

const LOCK_TYPES = [
  'lock_request_received',
  'lock_request_nudge',
  'lock_request_agreed',
  'lock_request_declined',
  'lock_request_expired',
] as const satisfies ReadonlyArray<NotificationType>;

test('every lock-handshake type has a human label and a tone', () => {
  for (const t of LOCK_TYPES) {
    assert.ok(NOTIFICATION_TYPE_LABEL[t], `${t} has no label`);
    assert.ok(NOTIFICATION_TYPE_TONE[t], `${t} has no tone`);
    assert.doesNotMatch(
      NOTIFICATION_TYPE_LABEL[t],
      /lock_request|undefined/,
      `${t}'s label leaks the internal name to a person`,
    );
  }
});

test('the agreement is the only good-news tone in the family', () => {
  // A no, a timeout and an unanswered ask all need the couple to act → amber.
  assert.match(NOTIFICATION_TYPE_TONE.lock_request_agreed, /success/);
  for (const t of ['lock_request_received', 'lock_request_nudge',
                   'lock_request_declined', 'lock_request_expired'] as const) {
    assert.match(NOTIFICATION_TYPE_TONE[t], /warn/, `${t} should read as needing attention`);
  }
});

test('ALL FIVE are email-enabled — the runtime Set the compiler cannot check', () => {
  // EMAIL_ENABLED_TYPES is module-private, so read the source. A regex over the
  // whole file would match the docblock; scope to the Set literal so a comment
  // naming a type can never satisfy this.
  const src = readFileSync(resolve(HERE, 'notification-emit.ts'), 'utf8');
  const start = src.indexOf('EMAIL_ENABLED_TYPES');
  assert.ok(start > -1, 'EMAIL_ENABLED_TYPES not found — did it get renamed?');
  const open = src.indexOf('new Set([', start);
  const close = src.indexOf('])', open);
  assert.ok(open > -1 && close > open, 'could not locate the Set literal');
  const body = src
    .slice(open, close)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  for (const t of LOCK_TYPES) {
    // MUTATION: drop any one of these from the Set ⇒ red, naming the type.
    assert.ok(
      new RegExp(`'${t}'`).test(body),
      `${t} is not in EMAIL_ENABLED_TYPES — it would be in-app only, which for a ` +
        `7-day fuse reaches exactly the people who are already looking`,
    );
  }
});

test('none of them joins the push list', () => {
  const src = readFileSync(resolve(HERE, 'notification-emit.ts'), 'utf8');
  const start = src.indexOf('PUSH_ENABLED_TYPES');
  const open = src.indexOf('new Set([', start);
  const close = src.indexOf('])', open);
  const body = src
    .slice(open, close)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const t of LOCK_TYPES) {
    assert.ok(!new RegExp(`'${t}'`).test(body), `${t} must not push — a 7-day fuse is not that urgent`);
  }
});
