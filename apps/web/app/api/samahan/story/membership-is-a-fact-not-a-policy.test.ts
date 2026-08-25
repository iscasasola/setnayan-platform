/**
 * membership-is-a-fact-not-a-policy.test.ts — who may put a clip into a samahan.
 *
 * 🚨 WHAT WAS WRONG, AND IT SHIPPED WITH A COMMENT SAYING IT WAS RIGHT. The
 * story route gated on whether the caller could READ the community row:
 *
 *     // RLS hides the community row from non-members, so an empty read IS the
 *     // refusal.
 *
 * The policy it leaned on is
 *
 *     USING (community_id IN (SELECT public.current_community_ids())
 *            OR public.is_admin())
 *
 * — widened so Setnayan staff can support a group. **RLS IS A FLOOR, NOT A
 * SCOPE.** A policy with a second disjunct does not scope the narrower caller,
 * so a Setnayan admin who was never in a private barkada could post a
 * three-second clip into it, and (since 2026-08-25) ring every member with a
 * notice saying they "added to" that samahan. Production's admin is the owner's
 * own account, so this was reachable, not theoretical.
 *
 * Usapan never had the hole: a message is written through the caller's OWN
 * session and its INSERT policy demands real membership. A story is written with
 * the service-role client, so the app-side gate IS the only gate — which is
 * exactly when leaning on a read policy stops being defence in depth and becomes
 * the whole fence.
 *
 * The fix asks a FACT — is there a membership row for this caller — with the
 * admin client, precisely so that no policy can widen the answer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = stripComments(readFileSync(join(HERE, 'route.ts'), 'utf8'));

test('posting a story asks for a membership row, not for a readable community', () => {
  const gate = code.slice(0, code.indexOf("bad(403, 'not_a_member')"));
  assert.match(gate, /\.from\('community_members'\)/, 'the gate no longer reads the roster');
  assert.match(gate, /\.eq\('user_id', user\.id\)/, 'the gate does not scope to THIS caller');
  assert.match(
    code,
    /if \(communityErr \|\| !membership/,
    'a refused read or a missing membership row must both refuse',
  );
});

test('the community read alone can never be the gate again', () => {
  // The old shape: select from communities, then refuse only when the row is
  // missing or archived. If that is all the gate does, an admin walks in.
  const gate = code.slice(0, code.indexOf("bad(403, 'not_a_member')"));
  assert.ok(
    gate.includes("from('community_members')"),
    'the refusal is decided without ever asking whether this person is a member',
  );
});

test('the gate cannot be widened by a session policy — it reads as the service role', () => {
  // Deliberate: the admin client is used to ASK a question, never to widen who
  // may ask it. The caller is still authenticated above (getCurrentUser), and
  // the membership row is filtered to their own uid.
  assert.match(code, /const gate = createAdminClient\(\);/);
  assert.match(code, /const user = await getCurrentUser\(\);/);
  assert.ok(
    !/from\('communities'\)[\s\S]{0,200}createClient\(\)/.test(code),
    'the user-scoped client is back in the membership gate',
  );
});
