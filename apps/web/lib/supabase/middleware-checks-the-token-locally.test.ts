/**
 * The sign-in check in front of every page verifies the token HERE, not by
 * asking the auth server.
 *
 * WHY (owner, 2026-09-29, "change it"): `updateSession()` used
 * `supabase.auth.getUser()`, a network round trip to Supabase on EVERY request,
 * public pages included, for an answer the middleware uses only for `?demo=1`
 * and one signed-in redirect. `getClaims()` verifies the token's ES256
 * signature on this server against the project's cached public key, and only
 * touches the network to refresh an expired session (or, for a legacy
 * HS-signed token, to fall back to getUser on its own).
 *
 * ⚖ The accepted trade is that a sign-out-everywhere, a ban or a deleted
 * account reaches THESE TWO USES only when the token expires (up to an hour).
 * It reaches nothing else: every protected surface still checks server-side.
 *
 * How it regresses: somebody "fixes" a sign-in edge case by putting getUser()
 * back, it works, and every page on the site quietly gains a round trip again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../strip-comments';

const HERE = join(process.cwd(), 'lib', 'supabase');
/** Comments explain the trap; a guard must read the CODE, not the warning. */
const code = () => stripComments(readFileSync(join(HERE, 'middleware.ts'), 'utf8'));

test('the middleware reads the token claims', () => {
  assert.match(code(), /supabase\.auth\.getClaims\(\)/, 'updateSession no longer calls getClaims()');
});

test('the middleware does not ask the auth server who is signed in', () => {
  assert.doesNotMatch(
    code(),
    /\.auth\.getUser\(/,
    'auth.getUser() is back in the middleware: that is a network round trip in front of ' +
      'EVERY page. Use getClaims(), and do per-surface checks server-side on the page.',
  );
});

test('the middleware hands back only the id, never a full User it did not fetch', () => {
  assert.doesNotMatch(
    code(),
    /import type \{ User \} from '@supabase\/supabase-js'/,
    'A supabase `User` type here promises fields (last_sign_in_at, identities…) a token does not carry.',
  );
  assert.match(code(), /export type SessionUser = \{ id: string \}/);
});
