/**
 * every-admin-page-has-a-tab.test.ts — no admin page without a home tab.
 *
 * The five-tab admin (DECISION_LOG 2026-10-28 "ADMIN DESIGN APPROVED — FIVE
 * TABS, EACH ONE PAGE") only holds together if every admin page has exactly one
 * tab. A page nobody mapped is reachable only by knowing its URL — the same as
 * unreachable — and this repo has paid for that before (see the docblock of
 * `lib/admin-map/scan-admin-routes.ts`).
 *
 * So the inventory is read from DISK, never from the map: every
 * `app/admin/**\/page.tsx`, dynamic segments included (a detail page has a home
 * tab too). The map is then held to it four ways:
 *   1. every page on disk has an entry;
 *   2. every entry names a page that exists;
 *   3. every redirect stub is marked as one, with the target the FILE forwards
 *      to — and nothing that renders is marked as a stub;
 *   4. every stub's target is a live page (exists, and is not itself a stub).
 *
 * Stub detection reuses the admin map's own helpers (`redirectTargetIn`,
 * `rendersJsx`) so there is one definition of "a stub" in the repo: a page that
 * forwards and draws nothing. A real page that guards its own door with
 * `redirect('/login')` is still a page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADMIN_TABS, ADMIN_TAB_MAP } from './admin-tabs';
import { redirectTargetIn, rendersJsx, urlPathFor } from './admin-map/scan-admin-routes';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN = resolve(HERE, '..', 'app', 'admin');

type DiskPage = { route: string; stubTo: string | null };

function pagesOnDisk(): DiskPage[] {
  const out: DiskPage[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (name === 'page.tsx') {
        const source = readFileSync(full, 'utf8');
        const target = redirectTargetIn(source);
        const isStub = target !== null && !rendersJsx(source);
        out.push({ route: urlPathFor(dir, ADMIN), stubTo: isStub ? target : null });
      }
    }
  };
  walk(ADMIN);
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

const DISK = pagesOnDisk();
const DISK_BY_ROUTE = new Map(DISK.map((p) => [p.route, p]));

test('the walk found the admin — a floor, so an empty sweep cannot pass', () => {
  // 107 page.tsx files on 2026-10-28. A floor, not the number: pages come and go.
  assert.ok(DISK.length >= 90, `only ${DISK.length} admin pages found — the walk narrowed`);
  assert.ok(
    DISK.filter((p) => p.stubTo).length >= 25,
    'fewer than 25 redirect stubs found — stub detection narrowed',
  );
  assert.ok(DISK.some((p) => p.route.includes('[')), 'no dynamic admin pages found');
});

test('every admin page on disk has a tab', () => {
  const mapped = new Set(ADMIN_TAB_MAP.map((e) => e.route));
  const unmapped = DISK.map((p) => p.route).filter((r) => !mapped.has(r));
  assert.deepEqual(
    unmapped,
    [],
    'admin page(s) with no tab — add each to ADMIN_TAB_MAP in apps/web/lib/admin-tabs.ts',
  );
});

test('every mapped route is a page that exists', () => {
  const missing = ADMIN_TAB_MAP.map((e) => e.route).filter((r) => !DISK_BY_ROUTE.has(r));
  assert.deepEqual(missing, [], 'ADMIN_TAB_MAP names admin page(s) that do not exist on disk');
});

test('each route is mapped once, to a known tab', () => {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const e of ADMIN_TAB_MAP) {
    if (seen.has(e.route)) dupes.push(e.route);
    seen.add(e.route);
  }
  assert.deepEqual(dupes, [], 'a route is mapped twice — one page, one tab');
  const badTab = ADMIN_TAB_MAP.filter((e) => !(ADMIN_TABS as readonly string[]).includes(e.tab));
  assert.deepEqual(badTab, []);
  // `retire` is a holding tab: every entry in it says when it goes, and only it does.
  const retireMismatch = ADMIN_TAB_MAP.filter((e) => (e.tab === 'retire') !== (e.retire === 'later'));
  assert.deepEqual(retireMismatch.map((e) => e.route), [], 'retire entries carry retire: "later" (and only they do)');
});

test('stubs are marked as stubs, with the target the file forwards to', () => {
  const wrong = ADMIN_TAB_MAP.flatMap((e) => {
    const disk = DISK_BY_ROUTE.get(e.route);
    if (!disk) return []; // reported by the "exists" test
    const said = e.stubTo ?? null;
    return said === disk.stubTo ? [] : [{ route: e.route, map: said, file: disk.stubTo }];
  });
  assert.deepEqual(wrong, [], 'stubTo disagrees with the page file (null = renders a page)');
});

test("every stub's target is a live page", () => {
  const dead = ADMIN_TAB_MAP.filter((e) => e.stubTo).flatMap((e) => {
    const to = (e.stubTo ?? '').split('?')[0] ?? '';
    const target = DISK_BY_ROUTE.get(to);
    return target && target.stubTo === null ? [] : [{ from: e.route, to: e.stubTo }];
  });
  assert.deepEqual(dead, [], 'a stub forwards to a missing page or to another stub');
});
