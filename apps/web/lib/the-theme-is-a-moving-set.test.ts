/**
 * the-theme-is-a-moving-set.test.ts — the Maker's Look › Theme shows a theme as ONE MOVING SET (owner 23 Nov 2026:
 * *"animated yes"*; DECISION_LOG "THEMES ARE SHOWN AS THE ANIMATED SET — APPROVED" and "EVENT HUB THEMES BATCH 6
 * APPROVED"; drawing `prototypes/maker_theme_set_animated_2026-11-23/`).
 *
 * Held here:
 *   1 · the five pieces, in the drawing's order of arrival, each read from the SHIPPED door that already draws it
 *       (the sample Event Hub, its RSVP sheet anchor, the one print door) — never a second copy;
 *   2 · the table sign is drawn in the theme by the print engine, inside the safe area, on every theme;
 *   3 · Look opens on Theme, and its tabs are Theme · Background · Elements · Music;
 *   4 · trying never saves: only "Use <theme>" picks, through the ONE theme pick (the draft) — no new server action,
 *       and the live pieces are sandboxed frames of the SAMPLE that take no pointer;
 *   5 · the motion is the house table's: transform and opacity, token lengths only, and reduce motion has no travel.
 *
 * 🛡 SABOTAGE-CHECKED: the sign's number moved off the card → RED; the RSVP piece without its anchor → RED; a frame
 * without its sandbox → RED; a raw `ms` in the set's CSS → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { THEME_SET_PIECES, liveThemeSetSources, themeUseLabel } from './theme-set';
import { INVITE_THEME_IDS, INVITE_THEMES } from './invite-themes';
import { layoutTableSign, SAFE_PT, TABLE_SIGN_PT, type PrintSetData } from './print-layout';
import { pathBounds } from './print-ground';
import { printLookFor, spotLayersFor } from './print-pieces';
import { STUDIO_LOOK_TABS, studioTileItem, studioTileOfItem } from './studio-tile-defs';
import { SAMPLE_DOOR_PIECES } from './maker-theme-tiles';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';

test('1 · five pieces, in the drawing’s order, each from the shipped door that draws it', () => {
  assert.deepEqual([...THEME_SET_PIECES], ['page', 'rsvp', 'ticket', 'invitation', 'sign']);
  const src = liveThemeSetSources({ board: 'palette=none', version: 'v1' });
  assert.deepEqual(src('page', 'perlas'), { kind: 'page', src: '/maria-and-jose?theme=perlas&palette=none' });
  assert.deepEqual(src('rsvp', 'perlas'), { kind: 'page', src: '/maria-and-jose?theme=perlas&palette=none#your-details' }, 'the RSVP piece is not the page with its reply sheet open');
  assert.deepEqual(src('ticket', 'perlas'), { kind: 'picture', src: '/api/hub-print/pass?sample=1&mode=screen&theme=perlas&palette=none&v=v1' });
  assert.deepEqual(src('invitation', 'perlas'), { kind: 'picture', src: '/api/hub-print/invitation?sample=1&mode=screen&theme=perlas&palette=none&v=v1' });
  assert.deepEqual(src('sign', 'perlas'), { kind: 'picture', src: '/api/hub-print/table-sign?sample=1&mode=screen&theme=perlas&palette=none&v=v1' });
  // The sample door serves exactly the pieces the Maker asks of it.
  const door = read('lib/print-sample-door.server.ts');
  for (const p of SAMPLE_DOOR_PIECES) assert.ok(door.includes(`'${p}'`), `the sample door does not serve ${p}`);
  assert.match(door, /piece === 'table-sign' \? layoutTableSign\(/, 'the sample door draws the table sign some other way');
  assert.equal(themeUseLabel('Hagdan'), 'Use Hagdan');
});

test('2 · the table sign wears the theme, and every word on it sits inside the safe area — every theme', () => {
  const data: PrintSetData = {
    names: { first: 'Maria', second: 'Jose' },
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    dateLabel: 'Saturday · December 12, 2026',
    ceremonyTime: null,
    ceremonyVenue: null,
    receptionTime: null,
    receptionVenue: null,
    monogram: null,
    initials: 'M & J',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], setnayanMark: true },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: null,
    hasStill: true,
    hasEventQr: false,
  };
  let signs = 0;
  for (const theme of INVITE_THEME_IDS) {
    const look = printLookFor(theme);
    const spot = spotLayersFor(theme);
    for (const label of ['Table 4', 'Table 12', 'Principal sponsors']) {
      const doc = layoutTableSign({ look, data, mode: 'screen', foil: spot.foil, whiteInk: spot.whiteInk }, { label, line: 'Scan to visit our wedding', qrRef: 'qr' });
      assert.equal(doc.w, TABLE_SIGN_PT.w);
      assert.equal(doc.h, TABLE_SIGN_PT.h);
      // The paper is the theme's own.
      const ground = doc.ops[0];
      assert.ok(ground && ground.t === 'rect' && ground.fill === look.paper, `${theme}: the sign is not on the theme's paper`);
      // Words are paths (outlined type). Every one sits inside the safe line.
      const words = doc.ops.filter((o) => o.t === 'path' && !('brand' in o && o.brand));
      assert.ok(words.length >= 3, `${theme} · ${label}: too few words on the sign`);
      for (const o of words) {
        if (o.t !== 'path') continue;
        const b = pathBounds(o.d);
        if (!b) continue;
        const where = `${theme} · ${label}: a word at ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}×${b.h.toFixed(1)}`;
        assert.ok(b.x >= SAFE_PT - 0.5 && b.x + b.w <= doc.w - SAFE_PT + 0.5, `${where} leaves the safe area across`);
        assert.ok(b.y >= SAFE_PT - 0.5 && b.y + b.h <= doc.h - SAFE_PT + 0.5, `${where} leaves the safe area down`);
      }
      // The table's code is drawn where the caller has one.
      assert.ok(doc.ops.some((o) => o.t === 'image' && o.ref === 'qr'), `${theme}: the table's code is missing`);
      signs += 1;
    }
  }
  assert.equal(signs, INVITE_THEME_IDS.length * 3);
  assert.ok(INVITE_THEMES.perlas, 'the batch 1 themes are in the sweep');
});

test('3 · Look opens on Theme; its tabs are Theme · Background · Elements · Music', () => {
  assert.deepEqual([...STUDIO_LOOK_TABS], ['theme', 'background', 'elements', 'music']);
  assert.equal(studioTileItem('look', null), 'theme');
  assert.equal(studioTileItem('look', 'logo'), 'theme', 'Look opened on another Look-group item');
  assert.equal(studioTileItem('look', 'music'), 'music', 'Look forgot the tab it was on');
  assert.equal(studioTileOfItem('theme'), 'look', 'an old ?item=theme door no longer reaches Look');
  const tools = read(`${L}/studio-tools.tsx`);
  assert.match(tools, /\{STUDIO_LOOK_TABS\.map\(\(k\) => \(/, 'the Look bar does not draw the four tabs');
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /bodies\.theme = <ThemeSetBody \/>;/, 'Look › Theme does not show the set');
  assert.match(details, /<ThemeSetCards themes=\{theme\.themes\} posters=\{theme\.posters\}/, 'Look › Theme does not hold the cards');
  assert.match(details, /<ThemeSetProvider board=\{theme\.samplePalette \?\? null\} version=\{theme\.sampleVersion\}/);
});

test('4 · trying never saves; "Use" picks through the one theme pick; the live pieces are sandboxed frames of the sample', () => {
  const set = read(`${L}/maker-theme-set.tsx`);
  assert.doesNotMatch(set, /['"]use server['"]|hubDraftAction|Action\(/, 'the set saves by a door of its own');
  assert.match(set, /onClick=\{\(\) => set\.tryTheme\(t\.id\)\}/, 'a card does something other than try');
  assert.match(set, /onClick=\{\(\) => pick\.pick\(tried\.id\)\}/, '"Use" is not the one theme pick');
  assert.equal((set.match(/pick\.pick\(/g) ?? []).length, 1, 'something else in the set picks a theme');
  const frames = [...set.matchAll(/<iframe[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(frames.length, 1);
  for (const f of frames) {
    assert.match(f, /sandbox="allow-scripts allow-same-origin"/, 'a set frame can navigate the Maker');
    assert.match(f, /pointer-events-none/, 'a set frame takes a pointer');
    assert.match(f, /tabIndex=\{-1\}/);
    assert.match(f, /aria-hidden/);
  }
  assert.doesNotMatch(set, /EditorBridge|makerThemeTileSrc|editor=1/, 'the set reaches the couple’s own page or its bridge');
  // The pick itself is the shipped one: the draft, Undo, Apply.
  const picker = read(`${L}/maker-theme-picker.tsx`);
  assert.match(picker, /fd\.set\('intent', 'save'\);/);
});

test('5 · the motion is the house table’s: transform and opacity, token lengths, no travel under reduce motion', () => {
  const css = readFileSync(join(WEB, `${L}/maker-theme-set.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /\d\s*m?s\b(?![a-z-])/, 'a raw length in the set’s motion — read the timing table');
  assert.match(css, /\.sn-set-arrive \{\s*animation-duration: var\(--sn-m-rise\);\s*animation-timing-function: var\(--sn-m-spring\);/);
  assert.match(css, /\.sn-set-swap \{ animation: sn-set-swap var\(--sn-m-move\) var\(--sn-m-settle\) both; \}/);
  for (const k of css.matchAll(/@keyframes [a-z-]+ \{([^}]*\})/g)) {
    const props = [...k[1]!.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    for (const p of props) assert.ok(p === 'opacity' || p === 'transform', `a keyframe animates ${p}`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-set-arrive \{ animation: none; \}/, 'reduce motion still travels');
  // Not in globals.css — every page parses that one.
  assert.doesNotMatch(readFileSync(join(WEB, 'app/globals.css'), 'utf8'), /sn-set-arrive/);
});
