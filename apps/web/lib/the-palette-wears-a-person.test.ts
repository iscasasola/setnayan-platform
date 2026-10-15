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
 * 2026-10-14 (owner, DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"; then the AI-drawn figures he picked): the person
 * is a drawing per GARMENT, dyed the role's colour through the garment's mask; the garment follows Wear ▾; a role that
 * holds both is two picks (men · women, boys · girls), each with its own Wear and colours, stored and kept through a
 * save; the reader sees their own pick, or both when the page cannot tell; the Studio's Attire draws the SAME
 * component; the artwork is reached through one seam (`lib/attire-figures.ts`).
 *
 * Run from `apps/web`: `npx tsx --test lib/the-palette-wears-a-person.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gownFig, roleFigurePeople, roleFigures, suitFig } from './role-figure';
import { FIGURE_ART, GARMENT_FOR, STYLE_ORDER, garmentFor } from './attire-figures';
import { ATTIRE_STYLES } from './role-dress-code';
import {
  attireRow,
  picksOf,
  readerPick,
  sanitizeSecondPicks,
  withFirstStyle,
  withSecondColours,
  withSecondPicksCarried,
  withSecondStyle,
} from './attire-rows';
import { withAttireStyle } from './mood-board-studio';
import { sanitizeHubDraft, sanitizeHubDraftEventValue } from './hub-draft';
import { existsSync, statSync } from 'node:fs';
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

/** The people a rendered figure draws, in order: who, the garment, the colour it is dyed. */
type Drawn = { who: string; garment: string; colour: string | null };
function figureIn(html: string): Drawn[] | null {
  const at = html.indexOf('data-role-figure="');
  if (at < 0) return null;
  const end = html.indexOf('data-role-figure="', at + 10);
  const pic = end < 0 ? html.slice(at) : html.slice(at, end);
  return [...pic.matchAll(/data-person="([a-z]+)" data-garment="([a-z]+)"(?: data-colour="(#[0-9A-Fa-f]{6})")?/g)].map((m) => ({ who: m[1]!, garment: m[2]!, colour: m[3]?.toUpperCase() ?? null }));
}
const people = (d: Drawn[]) => d.map((p) => p.who);
const colours = (d: Drawn[]) => d.map((p) => p.colour);

test('♻ one figure: the reception scene draws its people with the shared gown and suit', () => {
  const scene = stripComments(readFileSync(join(WEB, 'lib/reception-scene.ts'), 'utf8'));
  assert.match(scene, /import \{[^}]*\bgownFig\b[^}]*\bsuitFig\b[^}]*\} from '\.\/role-figure'/, 'the scene imports the figures');
  assert.doesNotMatch(scene, /function (gownFig|suitFig|figHead)\(/, 'and draws no people of its own');
  // Without an accent the markup is the scene's, unchanged (one stripe, 0.5 opacity).
  assert.match(suitFig(10, 60, 50, '#1F2A44'), /opacity="0\.5"/);
  assert.doesNotMatch(gownFig(10, 60, 50, '#FFFFFF'), /rx="1"/, 'no sash without an accent');
});

test('🎨 exact colour: the garment is dyed the role’s hex, through its own mask — the drawing’s shading kept', async () => {
  const [bride] = roleFigures('bride', ['#7A1F2B', '#C9A24B']);
  assert.deepEqual(bride, { kind: 'gown', color: '#7A1F2B', accent: '#C9A24B' });
  assert.deepEqual(roleFigurePeople('bride', ['#7A1F2B', '#C9A24B']), [{ who: 'f', garment: 'gown', main: '#7A1F2B' }]);
  assert.deepEqual(roleFigurePeople('groom', []), [], 'no colour → nobody drawn');
  assert.deepEqual(roleFigurePeople('groom', ['navy', '#12']), [], 'a colour that is not a hex dresses nobody');
  /* Drawn: the drawing, then the colour over it — clipped to the garment's mask, multiplied (the owner's method). */
  const { RoleFigure } = await import('../app/_components/role-figure');
  const html = renderToStaticMarkup(React.createElement(RoleFigure, { roleKey: 'bride', hexes: ['#7A1F2B'] }));
  assert.match(html, /<img src="\/attire\/gown\.webp" alt="" width="\d+" height="280" loading="lazy"/);
  assert.match(html, /background-color:#7A1F2B;-webkit-mask-image:url\(\/attire\/gown-mask\.webp\);mask-image:url\(\/attire\/gown-mask\.webp\);[^"]*mix-blend-mode:multiply/);
  assert.match(html, /^<span aria-hidden="true" data-role-figure="bride"/, 'the figure is not hidden from a screen reader');
  /* Every garment's drawing and mask is a real file the app serves — small. */
  for (const art of Object.values(FIGURE_ART)) {
    for (const file of [art.src, art.mask]) {
      const path = join(WEB, 'public', file);
      assert.ok(existsSync(path), `${file} is not in public/`);
      assert.ok(statSync(path).size <= 60_000, `${file} is ${statSync(path).size} bytes — over the 60 KB a figure may cost`);
    }
  }
});

test('👗 the garment follows Wear ▾ — every style drawable for every person; "Not said yet" is the dashed silhouette', async () => {
  for (const who of ['f', 'm', 'girl', 'boy'] as const) {
    assert.deepEqual([...STYLE_ORDER[who]].sort(), [...ATTIRE_STYLES].sort(), `${who}: Wear ▾ is not the ONE vocabulary`);
    for (const style of ATTIRE_STYLES) assert.ok(GARMENT_FOR[who][style] in FIGURE_ART, `${who} ${style}: no drawing`);
  }
  assert.equal(garmentFor('m', 'barong_tagalog'), 'barong');
  assert.equal(garmentFor('f', 'filipiniana'), 'terno');
  assert.equal(garmentFor('m', 'formal'), 'tux');
  assert.equal(garmentFor('girl', 'cocktail_dress'), 'flowergirl');
  assert.equal(garmentFor('boy', 'suit'), 'suitb');
  assert.equal(garmentFor('f', null), 'unset');
  const { RoleFigure } = await import('../app/_components/role-figure');
  const unset = renderToStaticMarkup(React.createElement(RoleFigure, { roleKey: 'x', people: [{ who: 'm', garment: 'unset', main: '#123456' }] }));
  assert.match(unset, /data-garment="unset"[\s\S]*stroke-dasharray="4 4"/, '"Not said yet" is not the dashed silhouette');
  assert.doesNotMatch(unset, /<img|#123456/, '"Not said yet" assumed an outfit, or wore a colour');
});

test('👥 who wears a role: one person, a pair, or one guest per colour', () => {
  assert.deepEqual(roleFigures('groom', ['#111111']).map((p) => p.kind), ['suit']);
  assert.deepEqual(roleFigures('bridesmaids', ['#8E3B5B']).map((p) => p.kind), ['gown']);
  assert.deepEqual(roleFigures('principal_sponsors', ['#C9A24B', '#F4E9DC']).map((p) => p.kind), ['gown', 'suit']);
  assert.deepEqual(roleFigures('custom:lola', ['#123456']).map((p) => p.kind), ['gown', 'suit'], 'a custom role holds both');
  assert.deepEqual(roleFigures('principal_sponsor_ninang', ['#C9A24B']).map((p) => p.kind), ['gown'], 'a ninang reading her own panel is one woman');
  assert.deepEqual(roleFigurePeople('bearers_flower_girl', ['#C9A24B']).map((p) => p.who), ['girl', 'boy'], 'the bearers’ row is children');
  assert.deepEqual(roleFigurePeople('ring_bearer', ['#C9A24B']).map((p) => [p.who, p.garment]), [['boy', 'suitb']]);
  /* With picks, the guests are one man and one woman, each in the first option — never two colours on one person. */
  const guests = roleFigurePeople('guest', ['#2B1D14', '#8E3B5B'], 'options', [
    { who: 'm', style: 'smart_casual', colours: null },
    { who: 'f', style: 'cocktail_dress', colours: null },
  ]);
  assert.deepEqual(guests, [{ who: 'm', garment: 'shirt', main: '#2B1D14' }, { who: 'f', garment: 'cocktail', main: '#2B1D14' }]);
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
    assert.ok(pic!.length > 0 && colours(pic!).every((c) => c === BOARD[key]![0]!.toUpperCase()), `${key}: not dressed in its first colour (${JSON.stringify(pic)})`);
  }
  /* 👥 The guests (owner 2026-10-14): a man and a woman — the two picks — each in the FIRST of the options ("the
     figures show the first"), never two of them combined on one person. */
  const guests = figureIn(rowHtml(html, 'guest'))!;
  assert.deepEqual(people(guests), ['m', 'f'], 'the guests are a man and a woman');
  assert.deepEqual(colours(guests), [BOARD.guest![0]!, BOARD.guest![0]!], 'a second option colour is worn — options are never combined');
  /* The sponsors hold both: a man and a woman. The bride is one woman. */
  assert.deepEqual(people(figureIn(rowHtml(html, 'principal_sponsors'))!), ['m', 'f']);
  assert.deepEqual(people(figureIn(rowHtml(html, 'bride'))!), ['f']);
});

test('📜 the reader’s own panel: a ninang sees a woman in her colours', async () => {
  const html = await scene({ guestRole: 'principal_sponsor_ninang' });
  const you = html.slice(html.indexOf('data-dress-code="you"'));
  const pic = figureIn(you);
  assert.ok(pic, 'her panel draws her');
  assert.deepEqual(people(pic!), ['f'], 'one woman — not the sponsors’ pair');
  assert.deepEqual(colours(pic!), ['#C9A24B']);
});

test('🎨 the Mood Board: each role card draws its person from the card’s own colours', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/palette-section.tsx'), 'utf8'));
  assert.match(src, /<RoleFigure roleKey=\{paletteKey\} hexes=\{colors\} meaning=\{limits\.meaning\} \/>/, 'the role card, from `board.colorsFor` — redrawn as the couple picks');
  assert.match(src, /limits\.meaning === 'scene' \? null/, 'a venue palette dresses nobody');
  assert.match(src, /<RoleFigure roleKey=\{`custom:\$\{slugifyCustomRoleKey\(role\.label\)\}`\} hexes=\{role\.colors\} \/>/, 'a custom role too');
});

/* ── two picks (owner 2026-10-14: "Yes, two picks") ─────────────────────── */

const SPONSORS = attireRow('groups', 'principal_sponsors')!;
const SPLIT = {
  groups: { principal_sponsors: { style: 'barong_tagalog', note: 'Ecru, please' } },
  women: { groups: { principal_sponsors: { style: 'filipiniana', colours: ['#8E3B5B'] } } },
};

test('👫 a row that holds both is two picks — each its own Wear and colours; one saved before the split meant everyone', () => {
  assert.deepEqual(picksOf(SPLIT, SPONSORS), [
    { who: 'm', style: 'barong_tagalog', colours: null },
    { who: 'f', style: 'filipiniana', colours: ['#8E3B5B'] },
  ]);
  /* Saved before the split: the one Wear is everyone's. */
  const legacy = { groups: { principal_sponsors: { style: 'formal' } } };
  assert.deepEqual(picksOf(legacy, SPONSORS).map((p) => p.style), ['formal', 'formal']);
  /* The FIRST change to the men's pins the women's to what it was — it never moves under them. */
  const split = withFirstStyle(legacy, 'groups', 'principal_sponsors', 'barong_tagalog', withAttireStyle);
  assert.deepEqual(picksOf(split, SPONSORS).map((p) => p.style), ['barong_tagalog', 'formal']);
  /* "Not said yet" for the women is said — never "follow the men". */
  assert.deepEqual(picksOf(withSecondStyle(split, 'groups', 'principal_sponsors', null), SPONSORS).map((p) => p.style), ['barong_tagalog', null]);
  /* Their colours: their own, or back to the row's. */
  const dyed = withSecondColours(split, 'groups', 'principal_sponsors', ['#123456', 'nope']);
  assert.deepEqual(picksOf(dyed, SPONSORS)[1]!.colours, ['#123456']);
  assert.equal(picksOf(withSecondColours(dyed, 'groups', 'principal_sponsors', null), SPONSORS)[1]!.colours, null);
  /* The note and the call time stay on the row, untouched. */
  assert.deepEqual((withSecondStyle(SPLIT, 'groups', 'principal_sponsors', 'long_gown').groups as Record<string, unknown>).principal_sponsors, { style: 'barong_tagalog', note: 'Ecru, please' });
  /* Which rows: VIP · Immediate Family, the sponsors, the guests (men · women); the bearers (boys · girls). The rest one. */
  assert.deepEqual(['vip_family', 'principal_sponsors', 'secondary_sponsors', 'bearers_flower_girl'].map((k) => attireRow('groups', k)!.who.join('+')), ['m+f', 'm+f', 'm+f', 'boy+girl']);
  assert.deepEqual(attireRow('roles', 'guest')!.who, ['m', 'f']);
  for (const [tier, key] of [['roles', 'bride'], ['roles', 'groom'], ['groups', 'bridesmaids'], ['groups', 'groomsmen']] as const) assert.equal(attireRow(tier, key)!.who.length, 1, key);
  /* Only those rows may hold a second pick; nothing else rides in. */
  assert.deepEqual(sanitizeSecondPicks({ groups: { bridesmaids: { style: 'suit' }, principal_sponsors: { style: 'sari', colours: ['red'] } }, roles: { guest: { style: null } } }), { roles: { guest: { style: null } } });
});

test('💾 the second pick SURVIVES A SAVE — the draft holds it as sent, the older form carries it, the guest page reads it', async () => {
  /* 1 · Studio → the draft door: the whole dress code goes in, `women` with it. */
  assert.deepEqual(sanitizeHubDraftEventValue('dress_code_config', SPLIT), SPLIT, 'the draft dropped the second pick');
  const stored = sanitizeHubDraft({ events: { dress_code_config: SPLIT } }) as unknown as { events: Record<string, unknown> };
  assert.deepEqual(stored.events.dress_code_config, SPLIT, 'the stored draft (read back) dropped the second pick');
  /* 2 · The older dress-code form rebuilds the whole config from its fields — and has none for the women's pick: it is carried. */
  const rebuilt = withSecondPicksCarried({ title: '', roles: {}, groups: { principal_sponsors: { style: 'suit' } } }, SPLIT);
  assert.deepEqual(rebuilt.women, SPLIT.women, 'a save from the older form took the women’s pick away');
  assert.equal('women' in withSecondPicksCarried({ title: '' }, { title: 'x' }), false, 'nothing to carry, nothing written');
  const actions = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/dress-code-actions.ts'), 'utf8'));
  assert.equal((actions.match(/withSecondPicksCarried\(built,/g) ?? []).length, 2, 'the older form writes the dress code in two places (draft, live) — both must carry the second pick');
  /* 3 · The guest page reads it: the sponsors' row draws a man in a barong and a woman in a terno, in her own colour. */
  const html = await scene({ config: SPLIT });
  const row = figureIn(rowHtml(html, 'principal_sponsors'))!;
  assert.deepEqual(row.map((p) => [p.who, p.garment, p.colour]), [['m', 'barong', '#C9A24B'], ['f', 'terno', '#8E3B5B']]);
  assert.match(rowHtml(html, 'principal_sponsors'), /For men · Barong Tagalog[\s\S]*For women · Filipiniana/);
});

test('🙋 the reader sees their own pick — or both, named, when the page cannot tell', async () => {
  assert.equal(readerPick(SPONSORS, 'principal_sponsor_ninong', null), 0);
  assert.equal(readerPick(SPONSORS, 'principal_sponsor_ninang', 'suit'), 1, 'the role says it before the guest list does');
  assert.equal(readerPick(SPONSORS, 'principal_sponsor', 'gown'), 1);
  assert.equal(readerPick(SPONSORS, 'principal_sponsor', 'neutral'), null);
  const you = async (props: Record<string, unknown>) => {
    const html = await scene({ config: SPLIT, ...props });
    return html.slice(html.indexOf('data-dress-code="you"'));
  };
  const ninong = await you({ guestRole: 'principal_sponsor_ninong' });
  assert.deepEqual(figureIn(ninong)!.map((p) => [p.who, p.garment]), [['m', 'barong']]);
  assert.match(ninong, />Barong Tagalog</);
  const her = await you({ guestRole: 'principal_sponsor', guestAttire: 'gown' });
  assert.deepEqual(figureIn(her)!.map((p) => [p.who, p.garment, p.colour]), [['f', 'terno', '#8E3B5B']]);
  assert.match(her, />Filipiniana</);
  const unknown = await you({ guestRole: 'principal_sponsor' });
  assert.deepEqual(people(figureIn(unknown)!), ['m', 'f'], 'a reader the page cannot place is not shown both');
  assert.match(unknown, /For men: Barong Tagalog · For women: Filipiniana/);
});

test('🧩 ONE component for the Studio and the guest page; the artwork through ONE seam; Entourage gone from Attire', async () => {
  const studio = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'), 'utf8'));
  assert.match(studio, /import \{ RoleFigure \} from '@\/app\/_components\/role-figure'/, 'the Studio draws its own figure');
  assert.match(studio, /<RoleFigure\s+roleKey=\{row\.key\}\s+people=/);
  assert.doesNotMatch(studio, /function Figure\(/, 'the Studio’s old circle-and-rectangle is back');
  /* Nothing but the seam names a drawing's file. */
  const { execSync } = await import('node:child_process');
  const naming = execSync(`/usr/bin/grep -rlE "/attire/[a-z]+(-mask)?\\.webp" app lib --include=*.ts --include=*.tsx || true`, { cwd: WEB, encoding: 'utf8' }).split('\n').filter((f) => f && !f.endsWith('.test.ts'));
  assert.deepEqual(naming, [], 'a file names a figure drawing directly — reach it through FIGURE_ART');
  const component = stripComments(readFileSync(join(WEB, 'app/_components/role-figure.tsx'), 'utf8'));
  assert.match(component, /FIGURE_ART\[person\.garment\]/);
  const slots = stripComments(readFileSync(join(WEB, 'lib/inspiration-slots.ts'), 'utf8'));
  assert.doesNotMatch(slots, /slotKey: 'entourage'/, 'the Entourage board is back in Attire');
});
