/**
 * EVERY /admin PAGE HAS A HOME UNDER THE FIVE TABS (or the avatar).
 *
 * Owner, 13 Nov 2026: *"admin has been ok'ed"* — the approved drawing's Place
 * map (`Setnayan-specs/prototypes/admin_pub/map.html`) says every shipped admin
 * page lives under Work · Money · People · Catalogue · Insights, or under the
 * avatar, and that "all mapping will be kept". `lib/admin/admin-tabs.ts` is
 * that map in code; this test is what makes the claim true and keeps it true.
 *
 * 🔑 IT WALKS THE TREE, IT DOES NOT TRUST A LIST. A hand-written list of
 * routes is a list of the routes somebody remembered. Every `page.tsx` and
 * `route.ts` under `app/admin` is found on disk and asked "where do you live?"
 * — a new admin page with no tab fails here until somebody gives it one.
 *
 * And the other direction: every door the shell draws (a view, a ⚙ row, an
 * avatar row) must open a page that exists. A selector entry that 404s is a
 * fake door, which is worse than a missing one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import {
  ADMIN_TABS,
  ADMIN_AVATAR_ROWS,
  adminPlaceFor,
  activeAdminTabKey,
  allAdminClaims,
  claimScore,
} from '@/lib/admin/admin-tabs';
import { ADMIN_QUEUE_META } from '@/lib/admin/queue-counts';

const APP = join(process.cwd(), 'app');
const ADMIN = join(APP, 'admin');

/** Every page.tsx / route.ts under app/admin, as the URL it serves. */
function adminRoutes(): { url: string; file: string }[] {
  const out: { url: string; file: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name.startsWith('_')) continue; // private folders are not routes
        walk(p);
      } else if (name === 'page.tsx' || name === 'route.ts') {
        const rel = relative(APP, dir).split(sep);
        const segs = rel
          .filter((s) => !(s.startsWith('(') && s.endsWith(')'))) // route groups
          .map((s) => (s.startsWith('[') ? 'sample-id' : s));
        out.push({ url: '/' + segs.join('/'), file: relative(process.cwd(), p) });
      }
    }
  };
  walk(ADMIN);
  return out;
}

const ROUTES = adminRoutes();
const URLS = new Set(ROUTES.map((r) => r.url));

/** Does `href` open something that exists on disk? */
function opensARealPage(href: string): boolean {
  const path = href.split('?')[0]!;
  if (URLS.has(path)) return true;
  // a dynamic segment: /admin/x/sample-id/... matched by shape
  const parts = path.split('/');
  return [...URLS].some((u) => {
    const up = u.split('/');
    return up.length === parts.length && up.every((s, i) => s === parts[i] || s === 'sample-id');
  });
}

test('ANCHOR — the walk found the admin tree', () => {
  // A walk that finds nothing passes every assertion below.
  assert.ok(ROUTES.length >= 110, `found only ${ROUTES.length} admin routes — the walk is wrong`);
  assert.ok(URLS.has('/admin'), 'the /admin landing itself was not found');
  assert.ok(
    ROUTES.some((r) => r.file.endsWith('route.ts')),
    'no route handlers found — the walk only read pages',
  );
});

test('every page and route under app/admin has a tab (or the avatar)', () => {
  const homeless = ROUTES.filter((r) => adminPlaceFor(r.url, null) === null).map(
    (r) => `${r.url}   (${r.file})`,
  );
  assert.deepEqual(
    homeless,
    [],
    'these admin pages have no home under Work · Money · People · Catalogue · Insights or the ' +
      'avatar. Add each to a view, a ⚙ row or an avatar row in lib/admin/admin-tabs.ts — the ' +
      "approved drawing's Place map (map.html) says where.",
  );
});

test('the five tabs, in order, and no More tab', () => {
  assert.deepEqual(
    ADMIN_TABS.map((t) => t.label),
    ['Work', 'Money', 'People', 'Catalogue', 'Insights'],
  );
  for (const t of ADMIN_TABS) {
    assert.notEqual(t.label, 'More', 'the approved admin has no More tab');
    assert.ok(t.views.length > 0, `${t.label} has no views`);
    assert.equal(t.views[0]!.href, t.href, `${t.label}'s landing must be its first view`);
  }
});

test('admin-of-admin is under the avatar, never a tab', () => {
  const avatar = ADMIN_AVATAR_ROWS.map((r) => r.label);
  for (const want of ['Team & permissions', 'Admin log', 'Secrets & integrations', 'Email delivery', 'Switches', 'Business & compliance']) {
    assert.ok(avatar.includes(want), `the avatar lost "${want}"`);
  }
  const tabWords = ADMIN_TABS.flatMap((t) => [...t.views, ...t.settings].map((v) => v.label));
  for (const label of avatar) {
    assert.ok(!tabWords.includes(label), `"${label}" is admin-of-admin and must not also sit in a tab`);
  }
});

test('a row whose page is not built yet names the slice building it, and draws nothing', () => {
  for (const r of ADMIN_AVATAR_ROWS) {
    if (r.href === null) {
      assert.ok(r.slice, `${r.label} has no address and does not say who builds it`);
    }
  }
});

test('every door the shell draws opens a page that exists', () => {
  const doors = [
    ...ADMIN_TABS.flatMap((t) => [
      { where: `${t.label} tab`, href: t.href },
      ...t.views.map((v) => ({ where: `${t.label} › ${v.label}`, href: v.href })),
      ...t.settings.map((v) => ({ where: `${t.label} ⚙ › ${v.label}`, href: v.href })),
      ...(t.create ? [{ where: `${t.label} ＋`, href: t.create.href }] : []),
    ]),
    ...ADMIN_AVATAR_ROWS.filter((r) => r.href).map((r) => ({ where: `avatar › ${r.label}`, href: r.href! })),
  ];
  const dead = doors.filter((d) => !opensARealPage(d.href)).map((d) => `${d.where} → ${d.href}`);
  assert.deepEqual(dead, [], 'a door to nowhere is worse than no door');
});

test('every door lands back in the place that drew it', () => {
  // Pressing "Money › Refunds" must light Money › Refunds — not To confirm.
  const wrong: string[] = [];
  for (const t of ADMIN_TABS) {
    for (const [list, isSetting] of [
      [t.views, false],
      [t.settings, true],
    ] as const) {
      for (const v of list) {
        const [path, q] = v.href.split('?');
        const place = adminPlaceFor(path!, new URLSearchParams(q ?? ''));
        if (place?.kind !== 'tab' || place.tab.key !== t.key || place.view.key !== v.key || place.isSetting !== isSetting) {
          wrong.push(`${t.label} › ${v.label} (${v.href}) lands on ${place?.kind === 'tab' ? `${place.tab.label} › ${place.view.label}` : String(place?.kind)}`);
        }
      }
    }
  }
  assert.deepEqual(wrong, []);
});

test('no two places claim the same address equally — one winner, always', () => {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const { pattern, place } of allAdminClaims()) {
    const who = place.kind === 'tab' ? `${place.tab.label} › ${place.view.label}` : `avatar › ${place.row.label}`;
    const prev = seen.get(pattern);
    if (prev && prev !== who) dupes.push(`${pattern}: ${prev} AND ${who}`);
    seen.set(pattern, who);
  }
  assert.deepEqual(dupes, []);
});

test('the specific claim wins over the umbrella (query beats path, deeper beats shallower)', () => {
  assert.equal(activeAdminTabKey('/admin/studio', new URLSearchParams('tab=referrals')), 'money');
  assert.equal(activeAdminTabKey('/admin/studio', new URLSearchParams('tab=songs')), 'catalogue');
  assert.equal(activeAdminTabKey('/admin/studio', null), 'catalogue');
  assert.equal(activeAdminTabKey('/admin/payments/supplier-refunds', null), 'money');
  assert.equal(activeAdminTabKey('/admin/users/abc', null), 'people');
  assert.equal(activeAdminTabKey('/admin/settings', new URLSearchParams('tab=demo-mode')), 'people');
  // avatar pages light no tab
  assert.equal(activeAdminTabKey('/admin/secrets', null), null);
  assert.equal(activeAdminTabKey('/admin/settings', new URLSearchParams('tab=compliance')), null);
  // /admin is exact-only: it must never adopt an unplaced page
  assert.equal(claimScore('/admin$', '/admin/not-a-real-page', null), 0);
  assert.equal(adminPlaceFor('/admin/not-a-real-page', null), null);
  // and nothing outside the console belongs to it
  assert.equal(adminPlaceFor('/dashboard', null), null);
});

test('every view that shows a count reads a queue that is actually counted', () => {
  const known = new Set(Object.keys(ADMIN_QUEUE_META));
  const bad = ADMIN_TABS.flatMap((t) => t.views)
    .filter((v) => v.queue && !known.has(v.queue))
    .map((v) => `${v.label}: ${v.queue}`);
  assert.ok(known.size > 10, 'ADMIN_QUEUE_META did not load');
  assert.deepEqual(bad, [], 'a queue key nobody counts would draw a count of nothing');
});

test('the words: supplier, never vendor', () => {
  const src = readFileSync(join(process.cwd(), 'lib/admin/admin-tabs.ts'), 'utf8');
  const labels = [...src.matchAll(/label: '([^']+)'/g)].map((m) => m[1]!);
  assert.ok(labels.length > 60, 'labels not parsed');
  assert.deepEqual(labels.filter((l) => /vendor/i.test(l)), []);
});
