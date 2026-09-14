/**
 * the-supplier-is-told-the-photo-came-down.test.ts — THE NOTIFICATION AND THE
 * EMAIL ALLOWLIST ARE TWO HALVES OF ONE MECHANISM, AND HAVING ONE IS
 * INDISTINGUISHABLE FROM HAVING NEITHER.
 *
 * 🔴 THE FAILURE THIS EXISTS TO PREVENT, MEASURED ON THIS REPO'S OWN HISTORY.
 * Six `lock_request_*` types were emitted, were on the email allowlist, and
 * reached NOBODY — they had also been pasted into `MARKETING_GATED_EMAIL_TYPES`,
 * whose only effect is to suppress unless `users.marketing_opt_in = TRUE`, a
 * column that is `NOT NULL DEFAULT FALSE` with zero users opted in. The test of
 * the day asserted membership of the EMAIL set and never looked at the gated
 * one, so both halves agreed with each other and CI stayed green.
 *
 * ⚖ AND THIS PARTICULAR NOTICE IS ABOUT AN ABSENCE. TD-1 makes a guest's
 * takedown reach the supplier's own copy (owner, 2026-09-14: "no. we will
 * honour the guest."), which means a tile simply VANISHES from the supplier's
 * workspace. If the notice does not arrive, the supplier's only evidence that
 * anything happened is a photograph that is no longer there — the exact
 * renders-identically-to-nothing shape the whole takedown lane exists to end,
 * pointed at the other party. A supplier working a wedding floor is the
 * definition of somebody not looking at the console, so in-app-only reaches
 * precisely the people it cannot help.
 *
 * Four things are checked at once, because any one of them alone passes while
 * the mechanism is dead: the type is email-enabled · it is NOT suppressed · it
 * has tray copy · and it is actually EMITTED from the moderator's own action.
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
// 🔑 THE ONE STRIPPER — a two-replace regex opens a comment on any `/*` inside a
// string and blanks real code to the next close. See lib/strip-comments.ts.
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const EMIT_SRC = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');

const TYPE = 'guest_takedown_honored';
/** Where the notice is built and sent. */
const NOTIFIER = join(HERE, 'tell-the-supplier-it-came-down.ts');
/** The moderator's own action — the one place a takedown is resolved. */
const MODERATOR_ACTION = join(WEB, 'app', 'admin', 'user-reports', 'actions.ts');

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

test('the supplier’s takedown notice is on the EMAIL allowlist', () => {
  assert.ok(
    setMembers('EMAIL_ENABLED_TYPES').includes(TYPE),
    `${TYPE} is emitted but not email-enabled. The supplier loses a photograph ` +
      `out of their own workspace and the only thing telling them is a tray ` +
      `badge they are not looking at — on a wedding floor, that is nobody.`,
  );
});

test('and it is NOT in the set that would silently suppress every send', () => {
  const at = EMIT_SRC.indexOf('const MARKETING_GATED_EMAIL_TYPES');
  const gated = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...gated.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  assert.ok(
    !members.includes(TYPE),
    `${TYPE} is marketing-gated. marketing_opt_in is NOT NULL DEFAULT FALSE, so ` +
      `that suppresses the email for EVERY user — the exact mistake that ` +
      `silenced all six lock_request_* types.`,
  );
  // Vacuity: the slice really is the gated set, which really does hold the one
  // genuinely engagement-shaped type.
  assert.ok(members.includes('new_chapter_from_followed'), 'the sliced set is not the gated one');
});

test('it does not buzz a phone — the photo is already down', () => {
  assert.ok(!setMembers('PUSH_ENABLED_TYPES').includes(TYPE), `${TYPE} is on the push list`);
});

test('it has tray copy and a badge — a type with no label renders as its raw key', () => {
  const label = NOTIFICATION_TYPE_LABEL[TYPE as NotificationType];
  assert.ok(label && label.trim().length > 0, `${TYPE} has no label`);
  assert.ok(!label.includes('_'), `${TYPE}'s label is the raw key`);
  assert.ok(NOTIFICATION_TYPE_TONE[TYPE as NotificationType], `${TYPE} has no badge colour`);
});

test('it is actually EMITTED, from the action that resolves the takedown', () => {
  /*
    🔑 THE HALF THE ALLOWLIST TESTS CANNOT SEE. Membership proves the channel is
    open; only the call site proves anything travels down it. Both ends are
    pinned: the notifier must send THIS type, and the moderator's action must
    reach the notifier — a perfectly built notice nobody calls is silence with
    extra steps.
  */
  const notifier = readFileSync(NOTIFIER, 'utf8');
  assert.ok(notifier.includes(`'${TYPE}'`), `${NOTIFIER} never sends ${TYPE}`);
  assert.match(
    notifier,
    /emitNotification\(/,
    'the notifier no longer goes through emitNotification, so the email half is bypassed',
  );

  const action = stripComments(readFileSync(MODERATOR_ACTION, 'utf8'));
  assert.match(
    action,
    /tellTheSupplierItCameDown\s*\(/,
    'the moderator resolves a takedown and never tells the supplier — the ' +
      'photograph vanishes out of their workspace with no error and nothing to read',
  );
  assert.match(
    action,
    /isSupplierOwned\s*\(/,
    'the action no longer asks whether the hidden row was a supplier’s, so it ' +
      'either tells nobody or tells a supplier about a couple’s own photograph',
  );
});

test('a failed notice never reads as a failed takedown', () => {
  // The photograph is already hidden by the time the notice is attempted. Every
  // arm of the notifier swallows and logs; the daily digest is the net
  // underneath, not a substitute — which is why the allowlist assertions above
  // are the load-bearing ones.
  const src = readFileSync(NOTIFIER, 'utf8');
  assert.ok(src.includes('catch'), 'the notifier has no failure handling');
  assert.ok(src.includes('console.error'), 'the notifier swallows a failure silently');
});
