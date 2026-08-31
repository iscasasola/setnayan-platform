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
