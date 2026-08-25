/**
 * admin-map-is-generated.test.ts — the map cannot go stale by hand.
 *
 * 🔑 THE WHOLE VALUE OF A GENERATED MAP IS THIS TEST. Without it the committed
 * file is just another hand-maintained list that happens to have been correct
 * once — and this repo has now paid three times for exactly that: two nav
 * vocabularies that drifted until a surface became unreachable, a hand-listed
 * door guard that was "a list of the doors somebody thought of", and an
 * `llms.txt` that drifted for three weeks with green CI because the guard
 * compared two hand-typed things.
 *
 * So: re-scan the real tree, and refuse any difference. Adding an admin page
 * without running `pnpm --filter @setnayan/web admin:map` fails here, by name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanAdminRoutes } from './scan-admin-routes';
import { ADMIN_ROUTES } from './admin-routes.generated';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const ADMIN = join(WEB, 'app/admin');

test('the committed map matches the route tree exactly', () => {
  const live = scanAdminRoutes(ADMIN);
  const committed = [...ADMIN_ROUTES];

  const livePaths = live.map((r) => r.path);
  const committedPaths = committed.map((r) => r.path);

  const added = livePaths.filter((p) => !committedPaths.includes(p));
  const gone = committedPaths.filter((p) => !livePaths.includes(p));
  assert.deepEqual(
    { added, gone },
    { added: [], gone: [] },
    'admin routes changed — run: pnpm --filter @setnayan/web admin:map',
  );

  // Not just the set: a page turning into a redirect stub (or forwarding
  // somewhere new) changes where a person lands, and must show in the diff.
  assert.deepEqual(live, committed, 'run: pnpm --filter @setnayan/web admin:map');
});

test('the map is not empty and not a handful — the floor', () => {
  // An anti-empty-sweep floor. A scanner that silently matched nothing would
  // otherwise pass every other assertion in this file.
  assert.ok(ADMIN_ROUTES.length >= 80, `only ${ADMIN_ROUTES.length} admin routes scanned`);
  const stubs = ADMIN_ROUTES.filter((r) => r.kind === 'redirect');
  const pages = ADMIN_ROUTES.filter((r) => r.kind === 'page');
  assert.ok(stubs.length >= 25, `only ${stubs.length} redirect stubs — the scan narrowed`);
  assert.ok(pages.length >= 40, `only ${pages.length} real pages — the scan narrowed`);
});

test('every stub forwards somewhere that exists', () => {
  // A stub pointing at a deleted page is a dead end the palette would offer
  // with a straight face. `/login` is legitimate and outside the map.
  const paths = new Set(ADMIN_ROUTES.map((r) => r.path));
  const broken = ADMIN_ROUTES.filter((r) => r.kind === 'redirect')
    .map((r) => ({ from: r.path, to: r.redirectsTo ?? '' }))
    .filter(({ to }) => to.startsWith('/admin') && !paths.has(to.split('?')[0] ?? to));
  assert.deepEqual(broken, [], 'a redirect stub forwards to a route that does not exist');
});

test('no template routes and no route groups leak into the map', () => {
  // `/admin/users/[userId]` is not a place you can be sent; `(group)` is not
  // part of any URL. Either one in the map produces a link that 404s.
  const bad = ADMIN_ROUTES.filter((r) => /[[\]()]/.test(r.path)).map((r) => r.path);
  assert.deepEqual(bad, []);
});

test('most stubs keep the tab they forward to', () => {
  // The tab is the whole point of a stub: /admin/songs → /admin/studio?tab=songs.
  // Dropping it lands you at the top of a 13-tab page. Four stubs genuinely
  // forward to a bare page (addons · marketing · queues · refinements), so this
  // is a floor on the rest, not a demand that every stub carry one.
  const stubs = ADMIN_ROUTES.filter((r) => r.kind === 'redirect');
  const withTab = stubs.filter((r) => (r.redirectsTo ?? '').includes('?tab='));
  assert.ok(
    withTab.length >= stubs.length - 6,
    `${stubs.length - withTab.length} stubs lost their tab (expected at most 6)`,
  );
});
