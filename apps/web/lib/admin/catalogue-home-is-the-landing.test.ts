/**
 * The Catalogue tab opens on its Home (#7693, /admin/catalogue) in the reorganised shell (`admin-pages.ts`, v7), and its
 * one ＋ is the New category form. Before this, the shell read `admin-pages.ts` while #7693 wired only the old
 * `admin-tabs.ts`, so the merged tree had a Catalogue Home that no tab, rail or bar reached (opus review, 18 Nov 2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_BAR_TABS, ADMIN_TAB_LANDING, activeAdminBarKey, adminShellPlaceFor } from './admin-pages';

test('the Catalogue tab lands on /admin/catalogue and the page lights the Catalogue tab', () => {
  assert.equal(ADMIN_TAB_LANDING.catalogue, '/admin/catalogue');
  const tab = ADMIN_BAR_TABS.find((t) => t.key === 'catalogue');
  assert.equal(tab?.href, '/admin/catalogue');
  assert.equal(adminShellPlaceFor('/admin/catalogue')?.kind, 'landing');
  assert.equal(activeAdminBarKey('/admin/catalogue'), 'catalogue');
});

test('the Catalogue ＋ opens the one New category form', () => {
  const tab = ADMIN_BAR_TABS.find((t) => t.key === 'catalogue');
  assert.deepEqual(tab?.create, { label: 'New category', href: '/admin/categories?new=category' });
});

/**
 * 📐 The Home is the SHARED tab landing (admin reorg v7, owner 17 Nov), never a frame of its own — the 14 Nov A3 Home
 * (its own Next card and rows) was superseded. And its taxonomy counts are honest: a failed list reaches the head as
 * `null` ("—"), never 0. Sabotage (19 Nov): drew the page with its own `sn-tile` → red; passed `cats.categories.length`
 * without the `failed` check → red.
 */
test('the Catalogue Home is the shared TabLanding, with honest taxonomy counts', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const web = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const page = readFileSync(join(web, 'app/admin/catalogue/page.tsx'), 'utf8');
  assert.match(page, /<TabLanding\s+tab="catalogue"/, 'the Catalogue Home is no longer the shared tab landing');
  assert.doesNotMatch(page, /sn-tile|className=/, 'the Catalogue Home draws a frame of its own again');
  assert.match(page, /categories: cats\.failed\.includes\('the category tree'\) \? null :/, 'a failed category read reaches the head as a number');
  assert.match(page, /services: cats\.failed\.includes\('services'\) \? null :/, 'a failed services read reaches the head as a number');
  const landing = readFileSync(join(web, 'app/admin/_components/tab-landing.tsx'), 'utf8');
  assert.match(landing, /label: 'Asking', value: show\(asking\)/, 'the Catalogue head no longer says how many shops are asking');
});
