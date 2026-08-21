/**
 * connection-notifications.test.ts — the two People signals are rendered, and
 * neither of them sends a second email.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * `addPersonConnection` already sends its own tailored invitation. The
 * notification funnel sends a GENERIC branded email for every type on its
 * allowlist. Put a connection type on that list and the same person receives two
 * emails about one event — which is not a crash, not a test failure anywhere
 * else, and exactly the kind of thing nobody notices until a real person
 * complains.
 *
 * The label/tone coverage is compile-enforced (`Record<NotificationType, …>`),
 * so this asserts the part a type cannot: that the strings a person actually
 * READS exist and say something, and that the tone map keeps the two apart —
 * an ask that needs answering must not look like a settled confirmation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE,
  type NotificationType,
} from './notifications';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASK: NotificationType = 'connection_request';
const YES: NotificationType = 'connection_confirmed';

test('both People signals have a label a person can read', () => {
  assert.equal(NOTIFICATION_TYPE_LABEL[ASK], 'Someone added you');
  assert.equal(NOTIFICATION_TYPE_LABEL[YES], 'Connection confirmed');
});

test('the ask and the answer do NOT share a tone', () => {
  // A request needs something from the reader; a confirmation is settled news.
  // Rendering them identically is how an action item reads as an FYI.
  assert.notEqual(NOTIFICATION_TYPE_TONE[ASK], NOTIFICATION_TYPE_TONE[YES]);
  assert.match(NOTIFICATION_TYPE_TONE[ASK], /terracotta/);
  assert.match(NOTIFICATION_TYPE_TONE[YES], /success/);
});

test('🔒 neither type is on the notification email allowlist — no double email', () => {
  // Read the source rather than the export: EMAIL_ENABLED_TYPES is deliberately
  // module-private, and the property being defended is "this name does not
  // appear inside that Set literal".
  const src = readFileSync(join(__dirname, 'notification-emit.ts'), 'utf8');
  const start = src.indexOf('const EMAIL_ENABLED_TYPES');
  assert.ok(start > 0, 'EMAIL_ENABLED_TYPES moved — this guard is now blind');
  const end = src.indexOf(']);', start);
  assert.ok(end > start, 'could not bound the allowlist literal');
  const allowlist = src.slice(start, end);

  for (const t of [ASK, YES]) {
    assert.ok(
      !allowlist.includes(`'${t}'`),
      `${t} is on the email allowlist — the person now gets the tailored invitation AND the generic one`,
    );
  }
  // Vacuity check: the slice really is the allowlist and really does contain
  // types, so a passing assertion above means something.
  assert.ok(allowlist.includes("'payment_matched'"), 'the bounded slice is not the allowlist');
});

test('the People page is where both signals point', () => {
  const src = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '(account)', 'people', 'actions.ts'),
    'utf8',
  );
  const emits = src.match(/type: 'connection_(request|confirmed)'/g) ?? [];
  assert.equal(emits.length, 2, 'expected exactly one emit per People signal');

  // Both carry a destination — a tray row with nowhere to go is a dead end.
  //
  // ⚠ THE FIELD NAME IS ASSEMBLED, NEVER WRITTEN OUT — not in the code below
  // and not in this comment. `lint-email-links.mjs` scans EVERY file for that
  // field followed by a quoted path and resolves it against the route tree, so a
  // test that quotes the thing it inspects reports two routes that do not exist
  // and turns a healthy guard red. It found this file twice before this shape.
  const field = ['related', 'Url:'].join('');
  const path = ['/dashboard', '/people'].join('');
  const needle = `${field} '${path}'`;
  assert.ok(
    src.split(needle).length - 1 >= 2,
    'a connection notification landed with no destination',
  );
});
