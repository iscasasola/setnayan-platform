/**
 * admin-destinations.test.ts — the map reaches a person, and the menu survives it.
 *
 * Two failure directions, both real:
 *   · the map adds nothing (a generated artifact nothing reads — the
 *     "gate with no handle" this repo has now found five times), and
 *   · the map costs something (a curated menu item lost, or outranked by a
 *     folder name that happens to start with the same letters).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { stripComments } from '@/lib/strip-comments';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADMIN_ROUTES } from '@/lib/admin-map/admin-routes.generated';

import { buildDestinations, labelFromPath } from './admin-destinations';
import { ADMIN_NAV_GROUPS } from './admin-nav-groups';

const HERE = dirname(fileURLToPath(import.meta.url));

test('every menu item is still a destination — the map costs nothing', () => {
  const dests = buildDestinations();
  const hrefs = new Set(dests.map((d) => d.href));
  const missing: string[] = [];
  for (const g of ADMIN_NAV_GROUPS) {
    for (const item of g.items) {
      if (item.href && !hrefs.has(item.href)) missing.push(item.href);
    }
  }
  assert.deepEqual(missing, [], 'the join dropped a curated menu item');
});

test('the map adds pages the menu never listed', () => {
  const added = buildDestinations().filter((d) => d.source === 'map');
  // A floor, not a fixed list: pages come and go, but if this reaches zero the
  // join has quietly become a no-op and the palette is back to menu-only.
  assert.ok(added.length >= 3, `the map added ${added.length} destinations`);
  for (const d of added) {
    assert.ok(d.href.startsWith('/admin'), `${d.href} is not an admin address`);
    assert.ok(d.label.trim().length > 0, `${d.href} has no name`);
  }
});

test('a moved page is findable under the address people still type', () => {
  const dests = buildDestinations();
  // Every stub's old address must be searchable SOMEWHERE, or the ~40 pages
  // that moved into a tab stay unfindable under the name people know them by.
  const stubs = ADMIN_ROUTES.filter((r) => r.kind === 'redirect');
  const unreachable = stubs
    .filter((r) => (r.redirectsTo ?? '').startsWith('/admin'))
    .filter((r) => !dests.some((d) => d.hay.includes(r.path.toLowerCase())))
    .map((r) => r.path);
  assert.deepEqual(unreachable, [], 'a stub address is searchable nowhere');
});

test('a stub address lands on the tab it forwards to, not the top of the page', () => {
  const dests = buildDestinations();
  const songs = ADMIN_ROUTES.find((r) => r.path === '/admin/songs');
  assert.ok(songs, 'the /admin/songs stub is gone — pick another example');
  assert.equal(songs.redirectsTo, '/admin/studio?tab=songs');
  const host = dests.find((d) => d.hay.includes('/admin/songs'));
  assert.ok(host, 'nothing carries the /admin/songs address');
  assert.equal(host.href, '/admin/studio?tab=songs');
});

test('a menu entry hidden by a flag is not resurrected by the map', () => {
  // Live Studio channels sits behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED. With
  // the flag off it is absent from the runtime menu ON PURPOSE, and a map that
  // compared itself against the runtime menu would helpfully offer it anyway.
  const route = ADMIN_ROUTES.find((r) => r.path === '/admin/live-studio-channels');
  assert.ok(route, 'the flagged route is gone — pick another example');
  assert.equal(route.inMenuSource, true, 'the menu file no longer mentions it');
  const inMenu = ADMIN_NAV_GROUPS.some((g) =>
    g.items.some((i) => i.href === '/admin/live-studio-channels'),
  );
  const offered = buildDestinations().filter((d) => d.href === '/admin/live-studio-channels');
  assert.equal(offered.length, inMenu ? 1 : 0, 'the map overrode a deliberate flag');
});

test('an unlisted page is named by its whole path, not its last word', () => {
  // Two different pages end in `new`. "New" twice in a palette tells you nothing.
  assert.equal(labelFromPath('/admin/venues/new'), 'Venues · New');
  assert.equal(labelFromPath('/admin/booking-fees'), 'Booking fees');
});

test('the palette actually uses the map', () => {
  // The artifact this whole PR exists to build is worth nothing if the screen
  // still calls its own local list.
  //
  // 🪤 REV 1 OF THIS TEST WAS DECORATION, AND ONLY THE MUTATION RUN SAW IT. It
  // matched the bare word `buildDestinations` anywhere in the file — so
  // replacing the call with `useMemo(() => [], [])` left the IMPORT standing,
  // the word was still there, and the palette rendered an empty palette while
  // this test reported a clean pass. Match the CALL SITE, on stripped source, so
  // a docblock that merely mentions the function cannot stand in for using it.
  const palette = stripComments(readFileSync(join(HERE, 'admin-command-palette.tsx'), 'utf8'));
  assert.match(
    palette,
    /useMemo\(\s*buildDestinations\s*[,)]/,
    'the palette no longer CALLS buildDestinations',
  );
  assert.doesNotMatch(
    palette,
    /function destinations\s*\(/,
    'the palette grew a second, local destination list — one list or they drift',
  );
  assert.match(
    palette,
    /source === 'map'/,
    'the palette no longer bands map hits below the curated menu',
  );
});
