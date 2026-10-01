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
 * The other-events source is gone altogether now (owner 2026-09-30: connected
 * people only), so the first test pins that no such read comes back.
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

test('the picker never offers a guest of another event — connected people only', () => {
  /*
    Owner, 2026-09-30: *"when adding people. i should only see the people that
    are connected to me. not the guest from events. only connected people,
    samahan … and my beloved."* The one `guests` read allowed here is this
    event's own list, for "already here" — fenced to THIS event by `.eq`.
  */
  const src = read(...LIB);
  const reads = src.match(/from\('guests'\)[\s\S]{0,300}?;/g) ?? [];
  assert.equal(reads.length, 1, 'A second guests read is back in the picker — it offered other events’ guests.');
  assert.match(reads[0]!, /\.eq\('event_id',\s*eventId\)/, 'The one guests read must be THIS event’s own list.');
  assert.doesNotMatch(src, /source:\s*'event'/, 'An `event` candidate is being pushed again.');
  assert.match(src, /source:\s*'people'/);
  assert.match(src, /source:\s*'samahan'/);
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

test('every opening of the sheet re-reads, so a failure cannot latch', () => {
  /*
    The sheet is mounted ONCE for the life of the page, with no `key`, and its
    fetch is guarded on `rows === null`. Without a reset on open, that guard
    means "already fetched EVER" rather than "already fetched for THIS opening",
    and two things break:

     · A FAILED READ LATCHES FOREVER. The catch writes `rows = []`, which is not
       null, so nothing refetches — and the panel keeps saying *"close this and
       try again"*, instructing the one action that cannot work. Only a full
       navigation recovers, which the sentence never mentions.

     · "ALREADY HERE" GOES STALE. A successful add closes the sheet; reopening
       showed the people just added with a live checkbox. Tick one and the
       server — which rebuilds the list honestly — refuses it. The screen
       offered a row and then told the host off for taking it.
  */
  const src = read(
    'app', 'dashboard', '[eventId]', 'guests', '_components', 'add-from-people-sheet.tsx',
  );
  const start = src.indexOf('const onOpen = ()');
  assert.ok(start > -1, 'The sheet’s open handler is gone or renamed.');
  /*
    🪤 BOUNDED BY THE NEXT STATEMENT, NOT BY A CHARACTER COUNT. `stripComments`
    replaces a comment with SPACES so byte offsets stay true — so a fixed
    900-char window is consumed by the handler's own explanation and the guard
    goes red against code that is correct. Slice to where the handler is
    actually used instead.
  */
  const end = src.indexOf('window.addEventListener(OPEN_EVENT', start);
  assert.ok(end > start, 'The open handler is no longer wired to the open event.');
  const body = src.slice(start, end);
  for (const reset of ['setRows(null)', 'setReadFailed(false)', 'setPartial(false)']) {
    assert.ok(
      body.includes(reset),
      `Opening the sheet no longer clears \`${reset}\`. The fetch is guarded on ` +
        '`rows === null`, so a stale success or a latched failure survives every ' +
        'reopen for the life of the page.',
    );
  }
});

test('the phone has a door to the picker at all', () => {
  /*
    🔴 IT DID NOT, AND THE DOOR VANISHED THE FIRST TIME IT WAS USED. The picker
    shipped with two mounts: the capture bar's overflow — which sits inside
    `hidden … lg:block`, so below 1024 it does not exist — and the zero state,
    which stops rendering the moment the event has ONE guest. Add a guest by any
    route, including the picker's own first use, and a phone had no control that
    could open the sheet. The sheet stayed mounted and listening the whole time:
    a gate with no handle, in the same costume this repo has now met six times.

    A phone is also where the feature is worth the most — retyping a name we
    already hold costs more on a thumb keyboard than anywhere else.
  */
  /*
    ⤷ 2026-09-30 (Fix E — "the guestlist is not same … like the desktop"): the
    phone-only head is gone. The ONE roster head renders at every width, so the
    capture bar's own opener IS the phone's door — provided that head is not
    hidden on a phone again. Both halves are asserted: the opener, and the head.
  */
  const page = read('app', 'dashboard', '[eventId]', 'guests', 'page.tsx');
  const headAt = page.indexOf('data-roster-head=""');
  assert.notEqual(headAt, -1, 'The roster head lost its anchor — this guard is blind.');
  const headTag = page.slice(page.lastIndexOf('<div', headAt), headAt);
  assert.doesNotMatch(
    headTag.replace(/\b(?:sm|md|lg|xl|2xl):[\w-]+/g, ''),
    /\bhidden\b/,
    'The roster head is hidden on a phone again — and with it the only door to the picker.',
  );
  const src = read(
    'app', 'dashboard', '[eventId]', 'guests', '_components', 'capture-bar.tsx',
  );
  assert.match(
    src,
    /import \{ OpenAddFromPeopleButton \} from '\.\/add-from-people-sheet'/,
    'The phone roster lost its import of the picker opener.',
  );
  assert.match(
    src,
    /<OpenAddFromPeopleButton/,
    'The phone roster imports the opener but never renders it — which is the ' +
      'same as not having it.',
  );
  assert.ok(
    !/setnayan:add-from-people-open/.test(src),
    'The phone roster hand-dispatches the sheet’s private open event. Import ' +
      'the opener instead, so the two cannot drift apart silently.',
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
