/**
 * 🔔 A CONNECTION PUT ON A GUEST LIST IS TOLD (W1/W3 RW-197, 2026-11-14: "a guest invited to an event gets NO notice").
 *
 * People → "Your people" adds a guest by NAME only (no email, no person id reaches the browser). The server then links
 * the new row to the connected person (`lib/connected-guest-link.server.ts`) and the database tells the account
 * (migration 20271346481550; the DB side is driven in tests/db/incoming-requests.db.test.ts).
 *
 * Held here (source): the action links the rows it added from "Your people"; the helper re-reads the connection as
 * CONFIRMED with the host's own person at one end, and the other end CLAIMED by an account — never trusting the pick.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the People add links what it added from "Your people", server-side', () => {
  const action = read('app/dashboard/[eventId]/guests/people-add-actions.ts');
  assert.match(action, /key\.startsWith\('people:'\)/, 'the "Your people" picks are no longer recognised');
  assert.equal((action.match(/fromConnections\.push\(/g) ?? []).length, 2, 'both add roads (sheet and quick add) must record the connection');
  assert.match(action, /await linkConnectedGuests\(createAdminClient\(\), user\.id, eventId, fromConnections\)/);
});

test('the link trusts nothing from the pick: confirmed, mine at one end, claimed at the other', () => {
  const link = read('lib/connected-guest-link.server.ts');
  assert.match(link, /\.eq\('claimed_by_user_id', hostUserId\)/, 'the host’s own person is not the anchor');
  assert.match(link, /\.eq\('status', 'confirmed'\)/, 'an unanswered request would be enough to link');
  assert.match(link, /c\.from_person_id === myPerson\) otherOf\.set\(c\.connection_id, c\.to_person_id\)/);
  assert.match(link, /c\.to_person_id === myPerson\) otherOf\.set\(c\.connection_id, c\.from_person_id\)/);
  assert.match(link, /\.not\('claimed_by_user_id', 'is', null\)/, 'a person with no account would be linked');
  assert.match(link, /\.eq\('event_id', eventId\)/, 'the update is not fenced to this event');
});
