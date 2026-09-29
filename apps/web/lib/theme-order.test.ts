/**
 * 🔢 THE ONE THEME ORDER — owner 2026-09-29, verbatim: *"arrange the themes to
 * have the free as the first 3 and the rest will be based on size also"*
 * (DECISION_LOG "THEME ORDER: THE THREE FREE FIRST, THEN THE PRO THEMES
 * LIGHTEST TO HEAVIEST").
 *
 *   1 · the order is pinned, and it IS "free first, then Pro by loop size" —
 *       a tier flip or a re-measured loop goes red here, not in a couple's picker;
 *   2 · every list a couple sees reads it: the Details picker's feed
 *       (`pickableInviteThemes` → `tilesShown`), the store shell, Prints &
 *       Tickets' theme choice, the Pro pitch that names them — and no surface
 *       lists the themes in the object's key order or sorts them itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import {
  FREE_THEMES,
  HUB_THEMES,
  INVITE_THEME_IDS,
  PRO_THEMES,
  pickableInviteThemes,
  themeNames,
  type InviteThemeId,
} from './invite-themes';
import { tilesShown } from './maker-theme-tiles';
import { hubProPitchFor } from './event-hub-pro';
import { PRO_THEMES_ITEM } from './website-pro-items';

const WEB = join(__dirname, '..');

const ORDER: InviteThemeId[] = ['house', 'galeriya', 'cyber', 'velvet', 'vintage', 'regency', 'abaca', 'cinderella', 'gatsby', 'whimsical'];

test('1 · Classic · Modern · Cyber Neon first, then Pro lightest loop to heaviest', () => {
  assert.deepEqual([...INVITE_THEME_IDS], ORDER);
  assert.deepEqual(HUB_THEMES.map((t) => t.id), ORDER, 'HUB_THEMES is not the one order');
  assert.deepEqual(
    HUB_THEMES.map((t) => t.name),
    ['Classic', 'Modern', 'Cyber Neon', 'Luxe', 'Vintage', 'Regency', 'Rustic', 'Cinderella', 'Great Gatsby', 'Whimsical'],
  );
  // THE RULE, not just the list: every free theme before every Pro one…
  const firstPro = HUB_THEMES.findIndex((t) => t.tier === 'pro');
  assert.equal(firstPro, FREE_THEMES.length, 'a Pro theme sits among the free ones');
  assert.ok(HUB_THEMES.slice(firstPro).every((t) => t.tier === 'pro'), 'a free theme sits after a Pro one');
  // …and the Pro ones never get heavier-then-lighter (measured 2026-09-28).
  const mb = PRO_THEMES.map((t) => t.loopMb);
  assert.ok(mb.every((m) => typeof m === 'number' && m > 0), 'a Pro theme has no measured loop');
  for (let i = 1; i < mb.length; i += 1) {
    assert.ok(mb[i]! >= mb[i - 1]!, `${PRO_THEMES[i]!.name} (${mb[i]} MB) comes after a heavier ${PRO_THEMES[i - 1]!.name} (${mb[i - 1]} MB)`);
  }
});

test('2a · the Details picker and the store shell read the one order — filtered, never re-sorted', () => {
  for (const mayShowStdFilm of [true, false]) {
    const ids = pickableInviteThemes({ mayShowStdFilm }).map((t) => t.id);
    assert.deepEqual(ids, ORDER.filter((id) => ids.includes(id)), `pickable order (fence ${mayShowStdFilm})`);
    assert.deepEqual(ids.slice(0, 3), ['house', 'galeriya', 'cyber'], 'the free three are not first');
  }
  const all = pickableInviteThemes({ mayShowStdFilm: true });
  for (const [ownsPro, storeShell] of [[false, false], [true, false], [false, true], [true, true]] as const) {
    // Whatever theme is current (a "suggested" or saved one included), nothing moves.
    for (const current of ['house', 'whimsical', 'gatsby']) {
      const shown = tilesShown(all, { ownsPro, storeShell, current }).map((t) => t.id);
      assert.deepEqual(shown, ORDER.filter((id) => shown.includes(id)), `tiles reordered (${ownsPro}/${storeShell}/${current})`);
    }
  }
});

test('2b · Prints & Tickets’ theme choice is fed from the one order', () => {
  // Prints & Tickets folded into Details (2026-09-28): the prints are drawn in
  // the theme picked in Details' gallery, whose tiles are \`pickableInviteThemes\`
  // — HUB_THEMES, filtered, never re-ordered. A closed dropdown renders no
  // options, so the FEED is what is held.
  const launch = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/page.tsx'), 'utf8'));
  assert.match(launch, /const themes = pickableInviteThemes\(/);
  const lib = stripComments(readFileSync(join(WEB, 'lib/invite-themes.ts'), 'utf8'));
  assert.match(lib, /export function pickableInviteThemes\([^)]*\)[^{]*\{\s*return HUB_THEMES\.filter\(/);
  // And the Maker's theme panel (the editor page) the same.
  const editor = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/page.tsx'), 'utf8'));
  assert.match(editor, /const themes = HUB_THEMES\.map\(/);
});

test('2c · the Pro pitch names the Pro themes lightest first', () => {
  assert.equal(hubProPitchFor(PRO_THEMES_ITEM)!.blurb.startsWith(`Choose ${themeNames(PRO_THEMES, 'or')}.`), true);
  assert.ok(themeNames(PRO_THEMES, 'or').startsWith('Luxe, Vintage, Regency'), 'the pitch is not in the one order');
});

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sourceFiles(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

test('2d · no surface lists the themes in the object’s key order, or sorts them itself', () => {
  const OBJECT_ORDER = /Object\.(?:values|keys|entries)\(\s*INVITE_THEMES\s*\)/;
  const LOCAL_SORT = /(?:HUB_THEMES|INVITE_THEME_IDS|FREE_THEMES|PRO_THEMES|pickableInviteThemes\([^)]*\))[^;]{0,120}\.sort\(/;
  const hits: string[] = [];
  let scanned = 0;
  for (const root of ['app', 'lib']) {
    for (const file of sourceFiles(join(WEB, root))) {
      scanned += 1;
      const src = stripComments(readFileSync(file, 'utf8'));
      const m = OBJECT_ORDER.exec(src) ?? LOCAL_SORT.exec(src);
      if (m) hits.push(`${relative(WEB, file)}: "${m[0].slice(0, 80)}"`);
    }
  }
  assert.ok(scanned > 500, `scanned only ${scanned} files`);
  assert.deepEqual(hits, [], 'read HUB_THEMES (the one order) — never the object key order, never a local sort');
});
