/**
 * the-shop-gear-holds-the-set-once-things.test.ts — 🏪 ONE SHOP ⚙, IT HOLDS WHAT A SUPPLIER SETS ONCE, AND NONE OF IT IS
 * STILL ON THE PAGE.
 *
 * Owner 2026-10-31, verbatim *"Yes follow your recommendation"* (DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"): the
 * Shop ⚙ holds Plan and billing · Team · Verification and documents · Notifications · Shop status; what a supplier edits
 * often stays on the page. Held as PROPERTIES:
 *   1 · exactly ONE Shop ⚙: the `shop` menu entry is live and one literal `<MenuSettingsButton menu="shop"` exists, in
 *       `ShopSettings`, which Shop's pinned row (`ShopSegments`) draws at its right end;
 *   2 · it holds the four that exist (Shop status waits on a build — nothing stores it), each the SHIPPED editor: the Plan
 *       screen, the Helpers screen, `VerifySection`, the push switch — in `SHOP_GEAR_SECTIONS` order, on what RENDERS;
 *   3 · none of them is still on the page: Shop › Details mounts no documents fold, the account menu's Settings page no
 *       push switch, no Plan row and no Helpers row; `VerifySection` is mounted by the ⚙ alone;
 *   4 · every old link still lands: `/subscription` and `/team` draw the SAME screens; `#docs` (and every fold's anchor)
 *       opens the ⚙ on its fold; every Shop section page hands the row its ⚙ rows.
 *
 * Sabotage (2026-10-31, each run and reverted, each RED): the documents fold put back on Details · a second
 * `<MenuSettingsButton menu="shop"` · the Notifications fold dropped from the rows · `gearBody` dropped from Page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SETTINGS_ENTRY } from '@/lib/menu-settings';
import { SHOP_GEAR_SECTIONS, SHOP_GEAR_TITLE } from './_components/shop-gear-sections';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const VD = join(WEB, 'app', 'vendor-dashboard');
const src = (...p: string[]) => stripComments(readFileSync(join(VD, ...p), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const APP = walk(join(WEB, 'app')).map((p) => ({ path: relative(WEB, p).split('\\').join('/'), code: stripComments(readFileSync(p, 'utf8')) }));
const sitesOf = (re: RegExp) => APP.filter((f) => re.test(f.code)).map((f) => f.path);

test('1 · exactly ONE Shop ⚙ — live, one mount, at the right end of Shop’s pinned row', () => {
  assert.equal(SETTINGS_ENTRY.shop.live, true, 'the Shop ⚙ is not live');
  assert.equal(SETTINGS_ENTRY.shop.door, 'first-row-gear');
  const mounts = APP.flatMap((f) => (f.code.match(/<MenuSettingsButton\s+menu="shop"/g) ?? []).map(() => f.path));
  assert.deepEqual(mounts, ['app/vendor-dashboard/shop/_components/shop-settings.tsx'], `Shop ⚙ mounts: ${mounts.join(', ')}`);
  const row = src('shop', '_components', 'shop-segments.tsx');
  assert.equal(count(row, /<ShopSettings\b/g), 1, 'Shop’s pinned row does not draw its ⚙ exactly once');
  assert.ok(row.indexOf('<ShopSettings') > row.indexOf('<PickMenu'), 'the ⚙ is not right of the Shop ▾');
  assert.ok(row.indexOf('<ShopSettings') > row.indexOf('{end}'), 'something sits after the ⚙ — it must be the row’s right end');
});

test('2 · it holds the four that exist, each the shipped editor, in order (on what RENDERS)', async () => {
  assert.deepEqual([...SHOP_GEAR_SECTIONS], ['plan', 'team', 'docs', 'notifications']);
  const body = src('shop', '_components', 'shop-settings-body.tsx');
  assert.match(body, /<PlanScreen\b[^>]*\bembedded\b/, 'Plan and billing is not the shipped Plan screen');
  assert.match(body, /<TeamScreen\b[^>]*\bembedded\b/, 'Team is not the shipped Helpers screen');
  assert.match(body, /<VerifySection\b/, 'Verification is not the shipped documents section');
  assert.match(body, /fetchShopWallet\(/, 'the Papic credit wallet is not read');
  assert.match(src('shop', '_components', 'shop-settings-rows.tsx'), /<PushToggle\b/, 'Notifications is not the shipped push switch');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ShopSettingsRows } = await import('./_components/shop-settings-rows');
  const html = renderToStaticMarkup(
    React.createElement(ShopSettingsRows, {
      planLine: 'Solo · Papic credits · receipts',
      wallet: { title: 'Shop wallet · 12 Papic credits', line: 'x' },
      plan: React.createElement('i', { 'data-plan-stand-in': '' }),
      team: React.createElement('i', { 'data-team-stand-in': '' }),
      docs: { isVerified: false, docsIn: 1, docsTotal: 4, measured: false, section: React.createElement('i', { 'data-docs-stand-in': '' }) },
    }),
  );
  const order = [...html.matchAll(/data-shop-gear="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, [...SHOP_GEAR_SECTIONS], `the folds render as ${order.join(', ')}`);
  for (const k of SHOP_GEAR_SECTIONS) assert.ok(html.includes(SHOP_GEAR_TITLE[k]), `${k}: its title is not drawn`);
  assert.match(html, /Shop wallet · 12 Papic credits/, 'the wallet row is not in Plan and billing');
  assert.match(html, /data-shop-gear-docs-unread=""/, 'an unread documents read is not said');
});

test('3 · none of them is still on the page — the ⚙ alone holds them', () => {
  const details = src('profile', '_components', 'details-screen.tsx');
  assert.doesNotMatch(details, /<VerifySection\b|anchor="docs"/, 'Shop › Details still draws the documents');
  const settings = src('settings', 'settings-view.tsx');
  assert.doesNotMatch(settings, /<PushToggle\b/, 'the Settings page still draws the push switch');
  assert.doesNotMatch(settings, /\/vendor-dashboard\/subscription|data="settings-plan"/, 'the Settings page still has a Plan row');
  assert.doesNotMatch(settings, /\/vendor-dashboard\/team|data="settings-helpers"/, 'the Settings page still has a Helpers row');
  // The documents' seats: the Shop ⚙, and a NEW shop's six steps on Today (step 5 "Send your documents", owner
  // 2026-10-28 "done in place" — onboarding, not a page a running shop edits). Never Shop › Details again.
  const verify = sitesOf(/<VerifySection\b/).filter((p) => !p.startsWith('app/dev/'));
  assert.deepEqual(verify.sort(), ['app/vendor-dashboard/_components/supplier-setup-screen.tsx', 'app/vendor-dashboard/shop/_components/shop-settings-body.tsx'], `VerifySection mounts: ${verify.join(', ')}`);
  // The push switch's seats: the Shop ⚙, and Today's ⚙ (Today ⚙ = notifications, owner 2026-10-28) — never a page.
  const push = sitesOf(/<PushToggle\b/).filter((p) => p.startsWith('app/vendor-dashboard/'));
  assert.deepEqual(push.sort(), ['app/vendor-dashboard/_components/today-settings.tsx', 'app/vendor-dashboard/shop/_components/shop-settings-rows.tsx'], `PushToggle seats: ${push.join(', ')}`);
});

test('4 · every old link still lands', () => {
  assert.match(src('subscription', 'page.tsx'), /<PlanScreen search=\{await searchParams\} \/>/, '/subscription no longer draws the Plan screen');
  assert.match(src('team', 'page.tsx'), /<TeamScreen search=\{await searchParams\} \/>/, '/team no longer draws the Helpers screen');
  assert.match(src('verify', 'page.tsx'), /redirect\(`\/vendor-dashboard\/profile\$\{query \? `\?\$\{query\}` : ''\}#docs`\)/, '/verify no longer lands on #docs');
  const door = src('shop', '_components', 'shop-settings.tsx');
  assert.match(door, /SHOP_GEAR_SECTIONS as readonly string\[\]\)\.includes\(at\)\) go\(true, at\)/, 'an old #docs link no longer opens the ⚙');
  assert.match(door, /addEventListener\('hashchange', check\)/, 'a same-page #docs link no longer opens the ⚙');
  // Every Shop section page hands the row its ⚙ rows.
  const rows = APP.filter((f) => f.path.startsWith('app/vendor-dashboard/') && /<ShopSegments\b/.test(f.code));
  const bare = rows.flatMap((f) => (f.code.match(/<ShopSegments\b[^>]*\/>/g) ?? []).filter((m) => !/gearBody=/.test(m)).map(() => f.path));
  assert.deepEqual(bare, [], `a Shop section draws a ⚙ that can never open: ${bare.join(', ')}`);
  assert.ok(rows.length >= 6, `only ${rows.length} Shop section files walked`);
});
