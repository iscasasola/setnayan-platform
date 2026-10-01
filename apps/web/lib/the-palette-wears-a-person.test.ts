/**
 * 👗 THE PALETTE WEARS A PERSON — owner 2026-09-27 (DECISION_LOG "OWNER: 'YES TO
 * ALL' — PALETTE, DAY-OF SCHEDULE…", item 1): the dress-code scene shows the
 * palette three ways, one of them *"an ILLUSTRATED person in the exact role
 * colours (not AI — exact colour, free)"*; built on the Mood Board palette too.
 *
 * What is held here, each by drawing it:
 *   · ONE figure: the reception scene draws its people with the SAME functions
 *     (`lib/role-figure.ts`) — reused, never a second drawing system;
 *   · EXACT colour: the role's hex is the garment's fill, as stored;
 *   · who wears it: the couple and gendered attendants one person, a shared role
 *     a gown-and-suit pair, the guests one person per colour (never combined);
 *   · the SCENE and the MOOD BOARD render it, row by row, from the same colours
 *     as their chips.
 *
 * Run from `apps/web`: `npx tsx --test lib/the-palette-wears-a-person.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gownFig, roleFigureDataUri, roleFigureSvg, roleFigures, suitFig } from './role-figure';
import { stripComments } from './strip-comments';
import type { RolePalette } from './mood-board';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');

/** The fills an SVG paints, upper-cased. */
const fills = (svg: string) => [...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toUpperCase());
/** The picture inside an `<img data-role-figure>` of `html`, decoded. */
function figureIn(html: string): string | null {
  const m = /<img[^>]*src="data:image\/svg\+xml;charset=utf-8,([^"]+)"[^>]*data-role-figure="[^"]*"/.exec(html);
  return m ? decodeURIComponent(m[1]!.replace(/&amp;/g, '&')) : null;
}

test('♻ one figure: the reception scene draws its people with the shared gown and suit', () => {
  const scene = stripComments(readFileSync(join(WEB, 'lib/reception-scene.ts'), 'utf8'));
  assert.match(scene, /import \{[^}]*\bgownFig\b[^}]*\bsuitFig\b[^}]*\} from '\.\/role-figure'/, 'the scene imports the figures');
  assert.doesNotMatch(scene, /function (gownFig|suitFig|figHead)\(/, 'and draws no people of its own');
  // Without an accent the markup is the scene's, unchanged (one stripe, 0.5 opacity).
  assert.match(suitFig(10, 60, 50, '#1F2A44'), /opacity="0\.5"/);
  assert.doesNotMatch(gownFig(10, 60, 50, '#FFFFFF'), /rx="1"/, 'no sash without an accent');
});

test('🎨 exact colour: the garment is the role’s hex, the accent its second colour', () => {
  const [bride] = roleFigures('bride', ['#7A1F2B', '#C9A24B']);
  assert.deepEqual(bride, { kind: 'gown', color: '#7A1F2B', accent: '#C9A24B' });
  const svg = roleFigureSvg('bride', ['#7A1F2B', '#C9A24B'])!;
  assert.ok(fills(svg).includes('#7A1F2B'), 'the gown is painted the bride’s main colour, exactly');
  assert.ok(fills(svg).includes('#C9A24B'), 'and her accent is on it');
  assert.equal(roleFigureSvg('groom', []), null, 'no colour → nobody drawn');
  assert.equal(roleFigureSvg('groom', ['navy', '#12']), null, 'a colour that is not a hex dresses nobody');
});

test('👥 who wears a role: one person, a pair, or one guest per colour', () => {
  assert.deepEqual(roleFigures('groom', ['#111111']).map((p) => p.kind), ['suit']);
  assert.deepEqual(roleFigures('bridesmaids', ['#8E3B5B']).map((p) => p.kind), ['gown']);
  assert.deepEqual(roleFigures('principal_sponsors', ['#C9A24B', '#F4E9DC']).map((p) => p.kind), ['gown', 'suit']);
  assert.deepEqual(roleFigures('custom:lola', ['#123456']).map((p) => p.kind), ['gown', 'suit'], 'a custom role holds both');
  assert.deepEqual(roleFigures('principal_sponsor_ninang', ['#C9A24B']).map((p) => p.kind), ['gown'], 'a ninang reading her own panel is one woman');
  const guests = roleFigures('guest', ['#2B1D14', '#8E3B5B', '#C9A24B'], 'options');
  assert.deepEqual(guests.map((p) => [p.kind, p.color]), [['gown', '#2B1D14'], ['suit', '#8E3B5B'], ['gown', '#C9A24B']]);
  assert.ok(guests.every((p) => !p.accent), 'guest colours are options — never combined on one figure');
  assert.ok(roleFigureDataUri('guest', ['#2B1D14'], 'options')!.startsWith('data:image/svg+xml'), 'shown as an image, never injected markup');
});

const BOARD: RolePalette = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC', '#2B1D14', '#8E3B5B'],
  bride: ['#FFFFFF', '#F4E9DC'],
  groom: ['#1F2A44'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  guest: ['#2B1D14', '#8E3B5B', '#C9A24B'],
  touched_roles: ['bride', 'groom', 'principal_sponsors', 'guest'],
};
const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;

async function scene(props: Record<string, unknown>): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  return renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config: {}, rolePalette: BOARD, ...props }));
}
function rowHtml(html: string, key: string): string {
  const at = html.indexOf(`data-role-row="${key}"`);
  if (at < 0) return '';
  const end = html.indexOf('data-role-row="', at + 10);
  return end < 0 ? html.slice(at) : html.slice(at, end);
}

test('📜 the dress-code scene: every role row carries its person, in that row’s colours', async () => {
  const html = await scene({});
  for (const key of ['bride', 'groom', 'principal_sponsors', 'guest'] as const) {
    const pic = figureIn(rowHtml(html, key));
    assert.ok(pic, `${key}: the row draws its person`);
    const want = key === 'guest' ? BOARD.guest! : [BOARD[key]![0]!];
    for (const hex of want) assert.ok(fills(pic).includes(hex.toUpperCase()), `${key}: ${hex} is worn`);
  }
  assert.equal((figureIn(rowHtml(html, 'guest'))!.match(/<(polygon|rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" rx="2")/g) ?? []).length, 3, 'three guest colours → three guests');
});

test('📜 the reader’s own panel: a ninang sees a woman in her colours', async () => {
  const html = await scene({ guestRole: 'principal_sponsor_ninang' });
  const you = html.slice(html.indexOf('data-dress-code="you"'));
  const pic = figureIn(you);
  assert.ok(pic, 'her panel draws her');
  assert.equal((pic!.match(/<polygon/g) ?? []).length, 1, 'one gown — not the sponsors’ pair');
  assert.ok(fills(pic!).includes('#C9A24B'));
});

test('🎨 the Mood Board: each role card draws its person from the card’s own colours', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/palette-section.tsx'), 'utf8'));
  assert.match(src, /<RoleFigure roleKey=\{paletteKey\} hexes=\{colors\} meaning=\{limits\.meaning\} \/>/, 'the role card, from `board.colorsFor` — redrawn as the couple picks');
  assert.match(src, /limits\.meaning === 'scene' \? null/, 'a venue palette dresses nobody');
  assert.match(src, /<RoleFigure roleKey=\{`custom:\$\{slugifyCustomRoleKey\(role\.label\)\}`\} hexes=\{role\.colors\} \/>/, 'a custom role too');
});
