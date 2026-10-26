/**
 * every-menu-has-one-settings-button.test.ts — ONE ⚙ PER MENU, IN ONE SPOT, AND NONE ON HOME.
 *
 * Owner, 2026-10-26: *"Settings button must all be located at ideally the same spot per menu for consistency"*;
 * approved 2026-10-27 (`prototypes/settings_per_menu_2026-10-26/` PLAN.md § 1 · § 7 guard 2). The door is ONE
 * component, `MenuSettingsButton`; the spot is the right end of the menu's first control row (`data-first-row`).
 *
 * Held as properties, measured on what RENDERS where it can be rendered:
 *   1 · the door is one 44 px icon-only ⚙ named "<Menu> settings", marked `data-menu-settings="<menu>"`;
 *   2 · every menu whose entry is `live` is mounted at EXACTLY ONE site in the app, and every menu that is not live
 *       (Suppliers' reserved spot included) at NONE — flipping `live` in `lib/menu-settings.ts` flips this check;
 *   3 · Memories RENDERS exactly one ⚙, inside its first row, at the row's right end — and none for a guest;
 *   4 · Home mounts no menu ⚙ (its ⚙ is the cover's, which opens Event Settings).
 *
 * Sabotage (2026-10-27, each run and reverted): a second `<MenuSettingsButton menu="memories"` in the gallery → 2 and
 * 3 red; the ⚙ moved before the count → 3 red ("right end"); `data-first-row` dropped → 3 red; `live: false` on
 * memories → 2 red; a `<MenuSettingsButton` in `home-first-screen.tsx` → 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SETTINGS_ENTRY, SETTINGS_MENUS } from '@/lib/menu-settings';

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
const APP = join(HERE, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}
const SOURCES = walk(APP).map((p) => ({ path: relative(APP, p), code: stripComments(readFileSync(p, 'utf8')) }));

/** The element that starts at `at` (an index inside its open tag), cut out by tag depth. */
function elementAround(html: string, at: number): string {
  const start = html.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(start))?.[1];
  assert.ok(tag, 'no element around the marker');
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error('unclosed element');
}

const count = (s: string, re: RegExp) => [...s.matchAll(re)].length;

test('1 · the door is one 44 px icon-only ⚙ named for its menu', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MenuSettingsButton } = await import('./menu-settings-button');
  for (const menu of SETTINGS_MENUS) {
    const html = renderToStaticMarkup(
      React.createElement(MenuSettingsButton, { menu, open: false, onOpenChange: () => {}, children: React.createElement('p', null, 'rows') }),
    );
    assert.equal(count(html, /<button\b/g), 1, `${menu}: the door is not exactly one button`);
    assert.equal(count(html, new RegExp(`data-menu-settings="${menu}"`, 'g')), 1, `${menu}: the door is not marked`);
    assert.match(html, new RegExp(`aria-label="${SETTINGS_ENTRY[menu].sheet}"`), `${menu}: the ⚙ is not named "${SETTINGS_ENTRY[menu].sheet}"`);
    assert.match(html, /aria-haspopup="dialog"/, `${menu}: the ⚙ does not say it opens a sheet`);
    // 44 px: the house icon-only ActionButton (`.ab.icon-only` in globals.css), neutral ink outline.
    assert.match(html, /class="ab ab-neutral icon-only"/, `${menu}: the ⚙ is not the neutral icon-only ActionButton`);
    assert.doesNotMatch(html, />rows</, `${menu}: the sheet's rows draw while it is closed`);
  }
});

test('2 · each live menu is mounted at exactly one site; the others (Suppliers reserved) at none', () => {
  const mounts = SOURCES.flatMap((s) => [...s.code.matchAll(/<MenuSettingsButton\b[^>]*?\bmenu="([a-z]+)"/g)].map((m) => ({ menu: m[1]!, path: s.path })));
  const bare = SOURCES.filter((s) => /<MenuSettingsButton\b(?![^>]*?\bmenu=")/.test(s.code)).map((s) => s.path);
  assert.deepEqual(bare, [], 'a ⚙ is mounted without a literal menu="…" — this check could not count it');
  const printed: string[] = [];
  for (const menu of SETTINGS_MENUS) {
    const sites = mounts.filter((m) => m.menu === menu).map((m) => m.path);
    printed.push(`${menu}=${sites.length}`);
    const e = SETTINGS_ENTRY[menu];
    if (e.door === 'reserved') assert.equal(e.live, false, `${menu}: a reserved spot cannot be live`);
    assert.equal(sites.length, e.live ? 1 : 0, `${menu}: ${sites.length} ⚙ mount(s) (${sites.join(' · ') || 'none'}), want ${e.live ? 1 : 0}`);
  }
  const unknown = mounts.filter((m) => !(SETTINGS_MENUS as string[]).includes(m.menu));
  assert.deepEqual(unknown, [], 'a ⚙ is mounted for a menu the map does not know');
  assert.ok(SETTINGS_MENUS.some((m) => SETTINGS_ENTRY[m].live), 'no menu is live — this check counts nothing');
  console.log(`  ⚙ mounts: ${printed.join(' · ')}`);
});

async function renderMemories(host: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventMemoriesGallery } = await import('./memories/event-memories-gallery');
  return renderToStaticMarkup(
    React.createElement(EventMemoriesGallery, {
      eventId: 'e1',
      items: [],
      host,
      totals: { all: 0, papic: 0 },
      footLine: null,
      cappedLine: null,
      emptyLine: 'Nothing yet',
      unreadable: false,
      timeZone: null,
    }),
  );
}

test('3 · Memories renders one ⚙, at the right end of its first row — and none for a guest', async () => {
  const html = await renderMemories(true);
  assert.equal(count(html, /data-menu-settings="/g), 1, 'Memories does not render exactly one ⚙');
  assert.equal(count(html, /data-first-row=""/g), 1, 'Memories does not mark exactly one first row');
  const row = elementAround(html, html.indexOf('data-first-row=""'));
  assert.equal(count(row, /data-menu-settings="memories"/g), 1, 'the ⚙ is not inside the first row');
  // The right end: the ⚙'s element is the row's LAST child — nothing drawn after it.
  const door = elementAround(row, row.indexOf('data-menu-settings="memories"'));
  assert.ok(row.endsWith(`${door}</div>`), 'something is drawn after the ⚙ — it is not at the row’s right end');
  assert.equal(count(await renderMemories(false), /data-menu-settings="/g), 0, 'a guest sees the Memories ⚙');
});

test('4 · Home mounts no menu ⚙ — its ⚙ is the cover’s', () => {
  const home = SOURCES.filter((s) => /^dashboard\/\[eventId\]\/(page\.tsx|_components\/home-|_components\/home-cards\/)/.test(s.path));
  assert.ok(home.length >= 5, `only ${home.length} Home files found — this check would pass vacuously`);
  const offenders = home.filter((s) => /MenuSettingsButton|menu-settings-button/.test(s.code)).map((s) => s.path);
  assert.deepEqual(offenders, [], `Home mounts a menu ⚙: ${offenders.join(' · ')}`);
});
