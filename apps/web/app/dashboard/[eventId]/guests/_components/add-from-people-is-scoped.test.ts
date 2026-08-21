/**
 * add-from-people-is-scoped.test.ts — THE PICKER MAY ONLY OFFER PEOPLE THE HOST
 * ALREADY HAS, AND MAY NOT HAND THE BROWSER ANYTHING EXTRA ON THE WAY.
 *
 * The merge rules are unit-tested in `lib/people-you-can-invite-core.test.ts`.
 * These are the four things that live in queries and wiring, where there is
 * nothing pure to call — so they are source scans, comment-stripped.
 *
 * ── 🚨 WHY THE FIRST ONE EXISTS, IN FULL ──────────────────────────────────
 * `guests` carries `couple_writes_guest`:
 *
 *     (event_id IN (SELECT current_couple_event_ids())) OR is_admin()
 *
 * Production's admin is the OWNER'S OWN ACCOUNT. A read that leaned on that
 * policy would have handed him every guest of every event in the database — in
 * a picker whose entire job is to offer names to add to a wedding, with his own
 * events' rows for them to hide among. It would not have errored and it would
 * not have looked wrong. Same shape as My Shop reading every other shop's
 * correction requests (2026-08-12), and the reason `your-people.ts` scopes
 * itself by hand.
 *
 * So the event source derives its ids from a `user_id = me` read FIRST and
 * fences the guest query with `.in('event_id', those)`. RLS is defence in
 * depth. It is never the fence.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROOT = process.cwd();
const read = (...p: string[]) => stripComments(readFileSync(join(ROOT, ...p), 'utf8'));

const LIB = ['lib', 'people-you-can-invite.ts'] as const;
const ACTIONS = ['app', 'dashboard', '[eventId]', 'guests', 'people-add-actions.ts'] as const;
const CAPTURE = [
  'app', 'dashboard', '[eventId]', 'guests', '_components', 'capture-bar.tsx',
] as const;

test('the candidate read fences itself by the events the host organises', () => {
  const src = read(...LIB);
  assert.match(
    src,
    /member_type'?\s*,\s*'couple'/,
    'The candidate list no longer derives the host’s own events from an ' +
      'event_members read. Without that list there is nothing to fence with.',
  );
  assert.match(
    src,
    /\.in\('event_id',\s*myEventIds\)/,
    'The other-events guest query lost its explicit `.in(event_id, myEventIds)` ' +
      'fence. `couple_writes_guest` is `… OR is_admin()`, and production’s ' +
      'admin is the owner’s own account — leaning on RLS offers him every ' +
      'guest in the database and looks completely fine.',
  );
});

test('no auth uuid and no person_id ever leaves this module', () => {
  const src = read(...LIB);
  assert.ok(
    !/person_id/.test(src),
    'The candidate list names `person_id`. A host may say "this name, at this ' +
      'address"; the insert trigger decides which person node that is. Handing ' +
      'the browser one invites a couple to bind a stranger’s identity to their ' +
      'event.',
  );
  assert.ok(
    !/user_id:/.test(src) && !/claimed_by_user_id/.test(src),
    'An auth uuid is being shaped into the returned rows.',
  );
});

test('the sheet’s payload carries no email at all', () => {
  /*
    The client has no use for one: the add path re-reads it server-side from
    the same function. An address that never reaches a browser cannot leak
    from one.
  */
  const src = read(...ACTIONS);
  const start = src.indexOf('export async function listPeopleYouCanInvite');
  assert.ok(start > -1, 'The sheet’s read action is gone.');
  const body = src.slice(start);
  assert.ok(
    !/email/.test(body),
    'The picker’s read action names `email`. It returns display rows only — ' +
      'key, names, where from, already-here.',
  );
});

test('the write path looks picks up by KEY, never trusting a posted name', () => {
  const src = read(...ACTIONS);
  assert.match(
    src,
    /getPeopleYouCanInvite\(eventId,\s*user\.id\)/,
    'The add action stopped rebuilding the candidate list server-side. Without ' +
      'that, a forged key or a hand-posted name adds somebody the host was ' +
      'never offered — and it re-applies the couple-scoped fence on the write.',
  );
  assert.match(
    src,
    /byKey\.get\(/,
    'Picks are no longer resolved through the server’s own map.',
  );
  assert.ok(
    !/first_name:\s*pick\./.test(src) && !/email:\s*pick\./.test(src),
    'A name or an address is being taken from the posted pick instead of from ' +
      'the server’s own row. Only the missing last name may come from the client.',
  );
});

test('the overflow row IMPORTS the opener rather than retyping its event name', () => {
  /*
    Both sheets open on a CustomEvent whose name is a private constant in the
    sheet's own file. A menu row that typed the string itself would keep
    compiling, keep rendering, and quietly stop opening anything the first time
    that constant moved — a menu item that does nothing, which is the hardest
    kind of broken to notice.
  */
  const src = read(...CAPTURE);
  assert.match(
    src,
    /import \{ OpenAddFromPeopleButton \} from '\.\/add-from-people-sheet'/,
    'The capture bar no longer imports the opener component.',
  );
  assert.ok(
    !/setnayan:add-from-people-open/.test(src),
    'The capture bar hand-dispatches the sheet’s private open event. Import ' +
      'the opener instead, so the two cannot drift apart silently.',
  );
});
