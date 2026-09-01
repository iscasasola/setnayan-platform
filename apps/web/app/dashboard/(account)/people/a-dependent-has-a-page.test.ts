/**
 * GUARD — a dependent has a PAGE, it is reachable, and the page tells the truth
 * about what it could not read.
 *
 * Measured on origin/main 2026-08-30: there was NO route to a dependent anywhere
 * under `apps/web/app`. An alaga was a row in a list. That is why a business had
 * no timeline — and why a CHILD had none either, for exactly the same reason. The
 * route below is the answer to both, so losing it silently loses both.
 *
 * ⚠ THE FILE IS READ FROM DISK RATHER THAN IMPORTED. `page.tsx` is an async
 * Server Component that calls `notFound()` and constructs a Supabase client at
 * module scope of its own imports; importing it under `tsx --test` proves
 * nothing about routing and would only assert that Next's helpers throw.
 *
 * ⚠ AND THE TEST FILE IS NOT INSIDE THE BRACKETED DIRECTORY. A `tsx --test`
 * glob containing `[dependentId]` matches NOTHING and prints "# tests 0", which
 * exits 0 and reads exactly like a pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROUTE = join(process.cwd(), 'app/dashboard/(account)/people/[dependentId]/page.tsx');
const LIST = join(
  process.cwd(),
  'app/dashboard/(account)/people/_components/dependents-section.tsx',
);

test('the route exists', () => {
  assert.ok(existsSync(ROUTE), 'apps/web/app/dashboard/(account)/people/[dependentId]/page.tsx');
});

test('the People list links to it — a page nothing reaches is not a page', () => {
  const list = readFileSync(LIST, 'utf8');
  assert.match(list, /href=\{`\/dashboard\/people\/\$\{d\.dependent_id\}`\}/);
});

test('the page is gated exactly like the People surface it belongs to', () => {
  const src = readFileSync(ROUTE, 'utf8');
  assert.match(src, /dependentPeopleEnabled\(\)/);
  assert.match(src, /isDataPrivacyControlActive\('dependent_minor_profiles'\)/);
  // notFound(), not a redirect: with the surface off this address should not exist.
  assert.match(src, /if \(!dependentPeopleEnabled\(\)\) notFound\(\);/);
});

/**
 * 🔴 THE MEASUREMENT MUST REACH THE RENDER. Every optional read here can be
 * refused, and PostgREST answers a refusal with `[]` — byte-identical to a
 * genuinely new record. The page therefore has to DRAW the `unmeasured` list; a
 * log line never changed a pixel, and this repo has shipped "No guests yet" to a
 * couple with 180 names for precisely this reason.
 */
test('a refused read reaches the screen, not just the log', () => {
  const src = readFileSync(ROUTE, 'utf8');
  assert.match(src, /unmeasured\.length > 0/, 'the refusal must be rendered, not only logged');
  assert.match(src, /UNMEASURED_COPY\[source\]/);
  // …and every read that can be refused actually feeds it.
  assert.match(src, /eventsError \? null :/);
  assert.match(src, /gpError \? null :/);
  assert.match(src, /shopExpected: !!dependent\.vendor_profile_id/);
});

/**
 * The page holds no service-role rights. It renders a whole person's history —
 * the last place in the app that should be able to read past RLS.
 */
test('the page constructs no admin client', () => {
  const src = readFileSync(ROUTE, 'utf8');
  assert.equal(/createAdminClient/.test(src), false);
});

/**
 * 🔴 THE READ THAT WOULD HAVE FAILED FOREVER AND LOOKED FINE.
 *
 * `authenticated` holds INSERT and UPDATE on `events.honoree_dependent_id` and
 * NO SELECT (20271025120000 denied it on purpose — the column says "this account
 * plans events for that dependent" and is kept off the guest surface). Postgres
 * needs SELECT on every column named in a WHERE, so a bare
 * `.from('events').eq('honoree_dependent_id', …)` under the user's client errors
 * for every user, forever.
 *
 * 🔑 AND THE HONEST-READ PLUMBING WOULD HAVE HIDDEN IT. That error becomes "we
 * couldn't load the events" — true, permanent, and indistinguishable from a
 * transient hiccup. The first draft of the page shipped exactly that query.
 *
 * `events_host` is the couple/moderator-scoped view that still projects the
 * honoree columns, and it carries its own caller-scoping WHERE. It is the door
 * `life-event-guard.ts` already uses, for this exact reason.
 */
test('the events read goes through events_host, never through events', () => {
  const src = readFileSync(ROUTE, 'utf8');
  // ⚠ AGAINST CODE, NOT PROSE. The comment above that read spells out the very
  // query it forbids, in order to explain why. A guard reading the raw file
  // reports a violation written by the guard's own subject — this file failed
  // exactly that way once, and so did the open-shop guard.
  //
  // ⚠ AND THROUGH THE REPO'S ONE STRIPPER. A hand-rolled two-liner is a blocking
  // guard for a reason: stripping block comments first lets a `//` line holding
  // a block opener swallow everything to the next real close, which makes a
  // guard pass while checking a blank.
  const code = stripComments(src);
  assert.ok(
    code.includes("from('events_host')"),
    'comment-stripping ate the code it was asked to check',
  );
  assert.match(
    src,
    /\.from\('events_host'\)\s*\n\s*\.select\([^)]*\)\s*\n\s*\.eq\('honoree_dependent_id'/,
    'the honoree read must use events_host — authenticated has no SELECT on events.honoree_dependent_id',
  );
  assert.equal(
    /\.from\('events'\)/.test(code),
    false,
    'a bare events read here is a query that can never succeed',
  );
});
