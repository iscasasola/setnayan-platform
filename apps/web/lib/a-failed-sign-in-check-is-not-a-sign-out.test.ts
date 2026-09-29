/**
 * a-failed-sign-in-check-is-not-a-sign-out.test.ts — owner, live, 2026-09-29:
 * *"when i used the upload media on the background, i went back to login"*.
 *
 * The Maker's draft save (`hubDraftAction` → `getHostUserId`) redirected a
 * signed-in couple to `/login` whenever `supabase.auth.getUser()` returned no
 * user — including when the auth CHECK failed. Held here against the REAL
 * `@supabase/ssr` client, pointed at a local auth server that answers each way.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServerClient } from '@supabase/ssr';
import { authReadFailed } from './auth-read';
import { stripComments } from './strip-comments';

type Answer = 'drop' | 503 | 429 | 'gone';

/** getUser() through the shipped client, with a live session cookie, against an auth server that answers `answer`. */
async function getUserWhenAuthAnswers(answer: Answer) {
  const server = http.createServer((_req, res) => {
    if (answer === 'drop') return void res.destroy();
    if (answer === 'gone') {
      res.writeHead(403, { 'content-type': 'application/json' });
      return void res.end(JSON.stringify({ code: 403, error_code: 'session_not_found', msg: 'Session does not exist' }));
    }
    res.writeHead(answer, { 'content-type': 'application/json' });
    res.end('{"message":"not now"}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3000;
  const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', exp, session_id: 's1' })}.sig`;
  const session = { access_token: jwt, refresh_token: 'r1', expires_at: exp, expires_in: 3000, token_type: 'bearer', user: { id: 'u1' } };
  const cleared: string[] = [];
  const supabase = createServerClient(`http://127.0.0.1:${port}`, 'anon', {
    cookies: {
      getAll: () => [{ name: 'sb-127-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}` }],
      setAll: (c: { name: string; value: string }[]) => c.forEach((x) => (!x.value ? cleared.push(x.name) : undefined)),
    },
  });
  try {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error, cleared };
  } finally {
    server.close();
  }
}

test('a failed CHECK (dropped connection, 503, 429) is a failed check — the couple is still signed in', async () => {
  for (const answer of ['drop', 503, 429] as const) {
    const r = await getUserWhenAuthAnswers(answer);
    assert.equal(r.user, null, `${answer}: getUser reports no user`);
    assert.deepEqual(r.cleared, [], `${answer}: the session cookie is untouched`);
    assert.equal(authReadFailed(r.error), true, `${answer}: must NOT read as signed out`);
  }
});

test('a session Supabase no longer honours IS signed out', async () => {
  const r = await getUserWhenAuthAnswers('gone');
  assert.equal(r.user, null);
  assert.equal(authReadFailed(r.error), false, 'a dead session goes to sign-in');
  assert.equal(authReadFailed(null), false, 'no cookie at all goes to sign-in');
});

test('the host gate every Maker save passes through asks before sending anyone to /login', () => {
  const gate = stripComments(readFileSync(join(import.meta.dirname, 'host-gate.ts'), 'utf8'));
  const core = gate.slice(gate.indexOf('export async function getHostUserId'), gate.indexOf('export async function requireHostMembership('));
  assert.match(core, /data: \{ user \},\s*error,\s*\} = await supabase\.auth\.getUser\(\);/);
  const failAt = core.indexOf('if (authReadFailed(error)) throw new Error(AUTH_READ_FAILED_MESSAGE);');
  const loginAt = core.indexOf("redirect('/login')");
  assert.ok(failAt > 0 && loginAt > failAt, 'a failed check throws BEFORE the sign-in redirect');
  const draft = stripComments(readFileSync(join(import.meta.dirname, '../app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8'));
  assert.match(draft, /await requireHostMembershipOrThrow\(eventId, FORBIDDEN\);/, 'the Maker draft save uses that gate');
});
