/**
 * THE FIVE SUPPLIER DOORS DON'T QUIETLY TURN INTO SOMETHING ELSE.
 *
 * Supplier-invite audit, 2026-11-04 (owner ruling 2026-11-02 "THE MINIMUM TO
 * LET SUPPLIERS IN"). Each case below is a supplier who would have landed
 * somewhere that looks normal but is wrong:
 *
 *   1. `/signup` decides couple-or-supplier from `?as=` alone. Every refusal
 *      in `signUp` (unticked box, short or breached password, Supabase error)
 *      used to redirect with only `error` + `next`, so a supplier who mistyped
 *      once came back to the COUPLE sign-up and their retry made a couple
 *      account. Every retry now goes through `signupRetryPath`, which keeps
 *      `as=vendor`.
 *   2. The dashboard's "create your own" link (for a team member with no shop
 *      of their own) pointed at `/signup?as=vendor`. That page sends a
 *      signed-in visitor straight back to `/vendor-dashboard`, so the link went
 *      nowhere. It now points at `/open-shop`.
 *   3. `/open-shop` (the page and `becomeVendor`) read the supplier's own shop
 *      and dropped the read's `error`. A refused read then looked like "no
 *      shop": the page re-opened the wizard, and the action tried to insert a
 *      second shop and showed Postgres's raw duplicate-key text.
 *   4. The inspiration box (`/vendor-dashboard/moodboard-library`) dropped its
 *      uploads read's `error`, so a refused read told a supplier with a shelf
 *      of photos "No uploads yet". It now throws to the dashboard error screen.
 *
 * Source-reading guard, the repo's usual shape. Every count has a floor, so a
 * guard that finds nothing goes red instead of green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
/** Code only: drop comment lines so a docblock quoting the old shape can't trip a guard. */
const code = (src: string) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(l))
    .join('\n');

test('every /signup retry in signUp goes through signupRetryPath', () => {
  // The helper itself is the one place allowed to spell the path.
  const src = code(read('app/signup/actions.ts')).replace(/function signupRetryPath\([\s\S]*?\n\}/, '');
  const raw = src.match(/[`'"]\/signup\?error=/g) ?? [];
  assert.deepEqual(raw, [], 'a /signup?error= redirect is built by hand — it will drop as=vendor');
  const sites = src.match(/redirect\(\s*signupRetryPath\(/g) ?? [];
  // 8 refusals when this was written; floor it so a vanished helper can't pass.
  assert.ok(sites.length >= 8, `expected >= 8 signupRetryPath redirects, found ${sites.length}`);
  for (const m of src.matchAll(/signupRetryPath\(([^)]*)\)/g)) {
    if (m[0].startsWith('signupRetryPath(error: string')) continue;
    assert.match(m[1] ?? '', /,\s*accountType\s*$/, `signupRetryPath call without accountType: ${m[0]}`);
  }
});

test('signupRetryPath keeps as=vendor for a supplier', () => {
  const src = read('app/signup/actions.ts');
  const body = src.match(/function signupRetryPath\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(body, 'signupRetryPath is gone');
  assert.match(body, /accountType === 'vendor' \? '&as=vendor'/, 'the supplier marker is not added');
  assert.match(body, /\$\{as\}`/, 'the marker is computed but never appended');
});

test('the team-member "create your own" link opens the shop wizard, not /signup', () => {
  const src = code(read('app/vendor-dashboard/page.tsx'));
  assert.doesNotMatch(src, /href="\/signup\?as=vendor"/, '/signup bounces a signed-in reader back here');
  const i = src.indexOf('create your own');
  assert.ok(i > 0, '"create your own" link not found — re-anchor this guard');
  const before = src.slice(Math.max(0, i - 400), i);
  assert.match(before, /href="\/open-shop"/, '"create your own" does not point at /open-shop');
});

test("/open-shop's own-shop reads keep their error", () => {
  const page = code(read('app/open-shop/page.tsx'));
  assert.match(page, /const \{ data: owned, error: ownedError \} = user \?/, 'page read drops its error');
  assert.match(page, /if \(ownedError\) \{\s*throw/, 'page read error is kept but never acted on');

  const action = code(read('app/open-shop/actions.ts'));
  assert.match(action, /const \{ data: ownedRows, error: ownedError \} = await admin/, 'action read drops its error');
  assert.match(action, /if \(ownedError\) \{\s*redirect\(\s*'\/open-shop\?error='/, 'action read error is kept but never acted on');
});

test('the inspiration box never shows a refused read as "No uploads yet"', () => {
  const page = code(read('app/vendor-dashboard/moodboard-library/page.tsx'));
  assert.match(page, /const \{ data: rows, error: rowsError \} = await admin\s*\.from\('moodboard_library_assets'\)/, 'uploads read drops its error');
  assert.match(page, /if \(rowsError\) \{\s*throw/, 'uploads read error is kept but never acted on');
});
