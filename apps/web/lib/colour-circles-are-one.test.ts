/**
 * colour-circles-are-one.test.ts — STUDIO › MOOD BOARD & DRESS CODE DRAWS ONE COLOUR CIRCLE (owner 2026-10-19, on the
 * Attire rows and the Palette side by side, verbatim: *"i like the circles on the attire. but they look different on the
 * palette. palette has a dropdown but attire does not. all colors can be edited on palette. no need for code. just name
 * if it has name. and just the circle like attire"*).
 *
 *   1 · ONE component: `RoleColourDot` / `NamedColourDot` live in `colour-dot.tsx`; the Studio defines no circle of its own.
 *   2 · the Palette: every colour (the five · the room · the flowers) is that circle — no colour code, no dropdown arrow,
 *       no pill — with the colour's NAME under it (`nearestColorName`) and nothing when it has none.
 *   3 · every Palette colour can be changed (the one picker) — every part has its own colour since 2026-10-19 (owner:
 *       "yes all circles"); only a part a supplier agreed is shown, not a button.
 *   4 · the word under a Palette circle is in the Attire dots' own type (`DOT_WORD`) — the two can never drift apart.
 *
 * Sabotaged, seen red, restored (see the commit): the hex back on a row → 2 · a circle drawn inline in the Studio → 1 ·
 * a part's circle back to shown-only → 3 · the Attire word's class changed → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { nearestColorName } from './color-names';
import { CAKE_LANE_PARTS, FLORIST_LANE_PARTS, ROOM_LANE_PARTS } from './colour-access';
import { fallbackInspirationParts } from './inspiration-parts';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { ...load.call(this, request, ...rest), useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }) };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const MB = 'app/dashboard/[eventId]/studio/mood-board/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const STUDIO = `${MB}/mood-board-studio.tsx`;
const DOT = `${MB}/colour-dot.tsx`;

const FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];
async function palette(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoodBoardStudio } = await import(`../${STUDIO}`);
  const html = renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'E1',
      inspirationParts: fallbackInspirationParts(),
      palette: { reception: FIVE, room_dressing: { linens: '#E5D3B3' } },
      fallbackFive: FIVE,
      frozenDressing: ['florals'],
      changes: [{ id: 'c1', who: 'Your florist', what: 'Bouquets', from: '#F2C8C2', to: '#C99A9A' }],
      attire: [],
      dressConfig: { roles: {} },
      attireStyles: [],
      inspirations: [],
      autoThemes: [],
      regions: [],
      dosLists: null,
      startTab: 'colours',
    }),
  );
  const from = html.indexOf('data-mood-board-colours=""');
  assert.ok(from > 0, 'the Palette section is not drawn');
  return html.slice(from);
}
/** Each Palette colour's own markup (its circle and its word), by its `data-mood-board-colour`: up to the end of its wrapper. */
function circles(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<span class="flex flex-col items-center" data-mood-board-colour="([^"]+)">/g)) {
    const rest = html.slice(m.index! + m[0].length);
    /* The wrapper holds a button (or the shown span) with one <i>, then at most one <small>. */
    const end = /^(?:<button[^>]*><i[^>]*><\/i><\/button>|<span role="img"[^>]*><i[^>]*><\/i><\/span>)(?:<small[^>]*>[^<]*<\/small>){0,2}<\/span>/.exec(rest);
    assert.ok(end, `${m[1]}: the circle is not the colour-dot component's markup`);
    out.set(m[1]!, end[0]);
  }
  return out;
}

test('1 · ONE circle: the Studio draws the colour-dot component and defines no circle of its own', () => {
  const studio = read(STUDIO);
  const dot = read(DOT);
  assert.match(dot, /export function RoleColourDot\([\s\S]*?data-mood-board-role-colour=\{index\} onClick=\{onPick\}/, 'RoleColourDot is not the button that opens what it is handed');
  assert.match(dot, /export function NamedColourDot\([\s\S]*?<RoleColourDot\b/, 'the Palette circle is not the Attire circle');
  assert.match(studio, /import \{ NamedColourDot, RoleColourDot \} from '\.\/colour-dot';/, 'the Studio does not draw the one circle');
  assert.doesNotMatch(studio, /function (?:RoleColourDot|NamedColourDot|ColourPill)\b/, 'the Studio defines a colour circle of its own');
  /* The only colours the Studio paints itself: the supplier change's small dots and the photos' strips (drawings, not controls). */
  assert.equal((studio.match(/style=\{\{ background:/g) ?? []).length, 3, 'the Studio paints a colour of its own — draw the one circle');
  assert.equal((studio.match(/<button\b/g) ?? []).length, 0, 'a hand-made button in the Studio (a colour is the one circle in colour-dot.tsx; a photo’s ＋ is the ActionButton)');
});

test('2 · the Palette: every colour is the circle with its NAME under it — no code, no arrow, no pill', async () => {
  const html = await palette();
  const all = circles(html);
  const expected = ['main-0', 'main-1', 'main-2', 'main-3', 'main-4', ...[...ROOM_LANE_PARTS, ...FLORIST_LANE_PARTS, ...CAKE_LANE_PARTS].map((p) => `part-${p.label.replace(/&/g, '&amp;')}`)];
  assert.deepEqual([...all.keys()].sort(), [...expected].sort(), 'a Palette colour is not the one circle');
  /* No colour code anywhere in the Palette's words (a code inside an attribute — the circle's own paint — is not a word). */
  const words = html.replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(words, /#[0-9a-fA-F]{3,8}\b/, 'a colour code is written on the Palette');
  assert.doesNotMatch(html, /data-form-row-mark="arrow"|aria-haspopup="dialog"[^>]*data-mood-board-colour|font-mono/, 'a Palette colour is still a pill with an arrow');
  FIVE.forEach((hex, i) => {
    const name = nearestColorName(hex);
    const c = all.get(`main-${i}`)!;
    if (name) assert.match(c, new RegExp(`data-mood-board-dot-word="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `main-${i} does not say its name (${name})`);
    else assert.doesNotMatch(c, /data-mood-board-dot-word=/, `main-${i} has no name but a word is drawn`);
  });
});

test('3 · every Palette colour can be changed — only a supplier-agreed part is shown, not a button', async () => {
  const html = await palette();
  for (const [k, c] of circles(html)) {
    if (k === 'part-Centrepieces') {
      assert.match(c, /data-mood-board-colour-shown=""/, 'a part the florist agreed looks changeable');
      assert.doesNotMatch(c, /<button/, 'a part the florist agreed is a button');
    } else {
      assert.match(c, /<button[^>]*data-mood-board-role-colour=/, `${k} cannot be changed (owner: "all colors can be edited on palette")`);
    }
  }
  const { CAKE_LANE_PARTS: cake, FLORIST_LANE_PARTS: flowers, ROOM_LANE_PARTS: room } = await import('./colour-access');
  for (const p of [...room, ...flowers, ...cake]) assert.ok(p.field, `${p.label} has no colour of its own to set`);
  assert.match(read(STUDIO), /onPick=\{frozen \? undefined : \(\) => setSheet\(\{ kind: 'picker', target: \{ kind: 'part', part: p \} \}\)\}/, 'a part’s circle does not open its own picker');
});

test('4 · the word under a Palette circle is in the Attire dots’ own type', () => {
  const dot = read(DOT);
  const word = /export const DOT_WORD = '([^']+)';/.exec(dot)?.[1];
  assert.ok(word, 'DOT_WORD is gone');
  const attire = read(STUDIO);
  const attireWords = [...attire.matchAll(/<small className="([^"]+)" data-mood-board-dot-word=/g)].map((m) => m[1]);
  assert.ok(attireWords.length >= 3, `the Attire dots lost their words (${attireWords.length})`);
  for (const w of attireWords) assert.equal(w, word, 'an Attire dot’s word and a Palette circle’s word are in different type');
  assert.match(dot, /<small className=\{slot \? DOT_NAME : DOT_WORD\} data-mood-board-dot-word=\{name\}>/, 'a part’s circle word is not DOT_WORD');
  assert.match(dot, /<small className=\{DOT_WORD\} data-mood-board-dot-slot=\{slot\}>/, 'a main colour’s slot word is not DOT_WORD');
});
