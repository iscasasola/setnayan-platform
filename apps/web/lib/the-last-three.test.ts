/**
 * the-last-three.test.ts — the tail of the 2026-08-19 sweep.
 *
 * 1 · THE PUBLIC SHOP PAGE SOLD A PACKAGE IT COULD NOT READ. A refused items
 *     read emptied the package instead of failing it, so the shop appeared to
 *     be selling something that included nothing — on a public page, to
 *     somebody deciding what to buy. The file already carried a 🚨 warning
 *     saying exactly this, and only LOGGED. A comment describing a failure mode
 *     is not a guard against it.
 *     ⚖ Now it returns [] — the section is gated on `length > 0`, so an empty
 *     list OMITS it. Between "we are showing you nothing" and "we are showing
 *     you the wrong thing", only the second is a lie.
 *
 * 2 · A SAMAHAN SAID "0 members" TO ONE OF ITS MEMBERS. `count ?? 0` with the
 *     error unbound. The reader is by definition a member, so it is a number
 *     they can personally disprove. The flag is ADDITIVE — `member_count` is a
 *     plain number read by nine surfaces, and widening it would ripple through
 *     all of them for one headline.
 *
 * 3 · THE LIBRARY TOLD A HOST THEY HOST NOTHING. A refused membership read
 *     empties `events`, and every album lens is derived from it. That file's own
 *     comment says saying this to a host "would be a lie" — it anticipated the
 *     wrong-lens case and not the refused read.
 *
 * 🪤 THE TYPE CHANGE IN (3) BROKE SIX DEGRADED FALLBACKS IN LAYOUTS — files not
 * named in any finding. Caught by comparing the TOTAL typecheck count against
 * the known baseline, after an earlier fix today was shipped broken by grepping
 * the output for only the files I had touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('a refused package read fails the fetch instead of emptying the package', () => {
  const src = read('app/v/[slug]/page.tsx');
  // ⚠ `stripComments` replaces comments with SPACES to preserve source
  // positions, so a long explanatory comment leaves a wide gap between the log
  // call and the `return`. A tight window fails on the padding, not the code —
  // hence the generous bound, and hence checking the gap contains no OTHER
  // logQueryError (which is what would make this match the wrong pair).
  const guarded = (site: string) => {
    const i = src.indexOf(`logQueryError('PublicVendorPage.${site}'`);
    assert.notEqual(i, -1, `${site} must still be logged`);
    const after = src.slice(i, i + 1200);
    assert.match(after, /return \[\];/, `${site}: a refused read must fail the fetch, not empty it`);
    assert.equal(
      (after.slice(0, after.indexOf('return [];')).match(/logQueryError\(/g) ?? []).length,
      1,
      `${site}: the return must belong to THIS guard, not a later one`,
    );
  };
  guarded('items');
  guarded('packageItemOptions');
});

test('the Samahan member count reports whether it was counted', () => {
  const lib = read('lib/communities.ts');
  assert.match(lib, /error: countError/, 'the count error must be bound');
  assert.match(lib, /member_count_measured: !countError/);
  const page = read('app/dashboard/(account)/samahan/[communityId]/page.tsx');
  assert.match(page, /member_count_measured === false/, 'and the headline must check it');
});

test('the library never tells a host they host nothing it did not read', () => {
  const sw = read('app/_components/account-switcher/get-switcher-data.ts');
  assert.match(sw, /eventsMeasured: !membershipRes\.error/);
  const data = read('app/dashboard/(account)/library/_data/photos-albums.ts');
  assert.match(data, /albumsMeasured: eventsMeasured/, 'the flag must reach the tab');
  const tab = read('app/dashboard/(account)/library/_components/photos-tab.tsx');
  assert.match(tab, /albums\.length === 0 && !albumsMeasured/, 'and gate BEFORE the lens copy');
  assert.match(tab, /We couldn’t load your albums/);
});

test('every degraded switcher fallback says it measured nothing', () => {
  // Six of these live in layouts — files no finding named. A type change breaks
  // its CONSUMERS, which is why the total error count is the thing to compare.
  const files = [
    'app/_components/frontdoor/signed-in-cluster.tsx',
    'app/admin/layout.tsx',
    'app/dashboard/(account)/layout.tsx',
    'app/dashboard/(launcher)/layout.tsx',
    'app/dashboard/[eventId]/layout.tsx',
    'app/vendor-dashboard/layout.tsx',
  ];
  for (const f of files) {
    assert.match(read(f), /eventsMeasured: false/, `${f} builds a degraded switcher and must mark it`);
  }
  assert.equal(files.length, 6, 'non-vacuity: all six are checked');
});

test('the genuine empty states survive for people who really have none', () => {
  const tab = read('app/dashboard/(account)/library/_components/photos-tab.tsx');
  assert.match(tab, /You’re not hosting an event yet/, 'still correct for a real non-host');
});
