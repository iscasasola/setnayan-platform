/**
 * A REMOVED CO-HOST IS NEVER LISTED AS IN THE CHAT — the app half of 20271352461498 (owner 19 Nov: "yes fix the
 * co-host leak today"). The SQL half is tests/db/a-removed-cohost-reads-no-chat.db.test.ts.
 *
 * `readThreadHostPeople` decides who is told about a message in a supplier conversation. It used to list every live
 * `chat_thread_members` seat, so a co-host removed from the event — whose seat outlived their membership — was still
 * told. The rule is now `threadHostPeopleFrom`: a seat counts only while its person is a host ('couple') of the event.
 *
 * Run (from apps/web): tsx --test lib/a-removed-cohost-is-never-listed.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { threadHostPeopleFrom } from './chat-shop-people';
import { stripComments } from './strip-comments';

const here = dirname(fileURLToPath(import.meta.url));

test('a seat whose person is no longer a host of the event is not listed', () => {
  const out = threadHostPeopleFrom({
    seats: [
      { user_id: 'creator', left_at: null },
      { user_id: 'current-cohost', left_at: null },
      { user_id: 'removed-cohost', left_at: null }, // the leak: a live seat, no 'couple' row any more
      { user_id: 'left-host', left_at: '2026-11-19T00:00:00Z' },
    ],
    eventPeople: [
      { user_id: 'creator', member_type: 'couple' },
      { user_id: 'current-cohost', member_type: 'couple' },
      { user_id: 'left-host', member_type: 'couple' },
      { user_id: 'coord', member_type: 'coordinator' },
    ],
  });
  assert.deepEqual(out.members.sort(), ['creator', 'current-cohost']);
  assert.deepEqual(out.coordinators, ['coord']);
});

test('a co-host demoted to guest is not a host, and a coordinator is never listed twice', () => {
  const out = threadHostPeopleFrom({
    seats: [{ user_id: 'demoted', left_at: null }, { user_id: 'both', left_at: null }],
    eventPeople: [
      { user_id: 'demoted', member_type: 'guest' },
      { user_id: 'both', member_type: 'couple' },
      { user_id: 'coord', member_type: 'coordinator' },
    ],
  });
  assert.deepEqual(out.members, ['both']);
  assert.deepEqual(out.coordinators, ['coord']);
});

test('when the event\'s people could not be read, nobody is listed — narrower than the database, never wider', () => {
  const out = threadHostPeopleFrom({ seats: [{ user_id: 'creator', left_at: null }], eventPeople: [] });
  assert.deepEqual(out, { members: [], coordinators: [], eventHosts: [] });
});

test('readThreadHostPeople reads the event\'s hosts and hands both reads to the rule', () => {
  const src = stripComments(readFileSync(join(here, 'chat-shop-people.server.ts'), 'utf8'));
  const at = src.indexOf('export async function readThreadHostPeople');
  assert.ok(at > 0, 'readThreadHostPeople exists');
  const body = src.slice(at);
  assert.match(body, /from\('event_members'\)[\s\S]*?\.in\('member_type', \['couple', 'coordinator'\]\)/,
    'it reads the event\'s couple rows, not only its coordinators');
  assert.match(body, /const people = threadHostPeopleFrom\(\{[\s\S]*?return \{ \.\.\.people, measured: /, 'the list comes from the one rule');
  assert.doesNotMatch(body, /members\.add\(/, 'no second, wider rule inline');
});
