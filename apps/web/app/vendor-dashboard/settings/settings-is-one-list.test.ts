/**
 * SETTINGS IS ONE LIST, AND EVERY ROW GOES SOMEWHERE REAL (simpler supplier dashboard step 6; prototype
 * SCREENS.settings · SCREENS.help · SCREENS.more · SHEETS.avatar).
 *
 * Held:
 *   · More tools IS the shop's shelves (`shopToolShelves`): a tool added there appears here; the grant gates stay
 *     (Moodboard library, Repertoire); "Team & Setnayan" is not doubled (Helpers is its own row); Deep Search is
 *     withheld in the store shell (the route is refused there);
 *   · every href on Settings, Help and More resolves to a page in this app (no dead row);
 *   · More lists Settings, and Settings / Help light the More tab;
 *   · Settings carries NO sign-out (owner 2026-08-13 — the avatar only; `seam-invariants.test.ts` holds the rule);
 *   · the account sheet gets the supplier's rows from the supplier layout only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { shopToolShelves, TOOLS_WITH_OTHERS } from '../shop/shop-tool-shelves';
import { SUPPLIER_HELP_ROWS, SETTINGS_HELP_HREF, settingsMoreTools } from './settings-rows';
import { VENDOR_MORE_MATCH, VENDOR_MORE_ROWS } from '@/lib/vendor-more-rows';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/vendor-dashboard/settings
const APP = join(HERE, '..', '..');
const SETTINGS = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8') + readFileSync(join(HERE, 'settings-view.tsx'), 'utf8'));
const LAYOUT = stripComments(readFileSync(join(HERE, '..', 'layout.tsx'), 'utf8'));

/** Does `/a/b?x#y` name a page in app/? Route groups `(x)` are skipped through; a `[segment]` matches any one part. */
function isPage(href: string): boolean {
  const parts = (href.split(/[?#]/)[0] ?? '').split('/').filter(Boolean);
  const walk = (dir: string, rest: string[]): boolean => {
    if (!existsSync(dir)) return false;
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (rest.length === 0) {
      if (existsSync(join(dir, 'page.tsx'))) return true;
      return entries.some((e) => e.name.startsWith('(') && walk(join(dir, e.name), rest));
    }
    const [head = '', ...tail] = rest;
    return entries.some((e) =>
      e.name === head ? walk(join(dir, e.name), tail)
      : e.name.startsWith('(') ? walk(join(dir, e.name), rest)
      : /^\[[^.\]]+\]$/.test(e.name) ? walk(join(dir, e.name), tail)
      : false,
    );
  };
  return walk(APP, parts);
}

const all = (o: { hasMoodboardLibraryAccess: boolean; hasMusicRepertoireAccess: boolean; storeShell: boolean }) =>
  settingsMoreTools(o).flatMap((g) => g.tools.map((t) => t.href));

test('More tools is the shelves, minus Team, plus Manpower and (web only) Deep Search', () => {
  const shelves = shopToolShelves(true, true).flatMap((g) => g.tools.map((t) => t.href));
  const tools = all({ hasMoodboardLibraryAccess: true, hasMusicRepertoireAccess: true, storeShell: false });
  for (const h of shelves.filter((h) => h !== '/vendor-dashboard/team')) assert.ok(tools.includes(h), `${h} lost from More tools`);
  assert.ok(!tools.includes('/vendor-dashboard/team'), 'Team is doubled — Helpers is its own Settings row');
  assert.ok(tools.includes('/vendor-dashboard/shop?open=manpower#shop-folds'));
  assert.ok(tools.includes('/vendor-dashboard/deep-search'));
  assert.equal(tools.length, 15, 'the prototype’s fifteen, with every grant');
  assert.ok(!all({ hasMoodboardLibraryAccess: true, hasMusicRepertoireAccess: true, storeShell: true }).includes('/vendor-dashboard/deep-search'));
});

test('the grant gates stay', () => {
  const none = all({ hasMoodboardLibraryAccess: false, hasMusicRepertoireAccess: false, storeShell: false });
  assert.ok(!none.includes('/vendor-dashboard/moodboard-library'));
  assert.ok(!none.includes('/vendor-dashboard/repertoire'));
});

test('a tool added to the shelves reaches Settings with no edit', () => {
  const extra = { href: '/vendor-dashboard/attributes?probe=1', label: 'Probe', sub: 'probe' };
  TOOLS_WITH_OTHERS.push(extra);
  try {
    assert.ok(all({ hasMoodboardLibraryAccess: false, hasMusicRepertoireAccess: false, storeShell: false }).includes(extra.href));
  } finally {
    TOOLS_WITH_OTHERS.pop();
  }
});

test('every row goes to a real page', () => {
  const hrefs = [
    ...all({ hasMoodboardLibraryAccess: true, hasMusicRepertoireAccess: true, storeShell: false }),
    ...SUPPLIER_HELP_ROWS.map((r) => r.href),
    ...VENDOR_MORE_ROWS.map((r) => r.href),
    SETTINGS_HELP_HREF,
    ...[...SETTINGS.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? ''),
  ];
  const dead = hrefs.filter((h) => !isPage(h));
  assert.deepEqual(dead, [], `rows that go nowhere: ${dead.join(', ')}`);
});

test('More lists Settings; Settings and Help light More', () => {
  assert.ok(VENDOR_MORE_ROWS.some((r) => r.href === '/vendor-dashboard/settings'));
  assert.ok(VENDOR_MORE_MATCH.includes('/vendor-dashboard/settings'));
  assert.ok(VENDOR_MORE_MATCH.includes('/vendor-dashboard/help'));
});

test('Settings carries no sign-out; the account sheet carries the supplier rows', () => {
  assert.doesNotMatch(SETTINGS, /auth\/sign-out/);
  assert.match(LAYOUT, /<AccountSwitcher data=\{switcherData\} shopRows=\{switcherShopRows\} \/>/);
});
