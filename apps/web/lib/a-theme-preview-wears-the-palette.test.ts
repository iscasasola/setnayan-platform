/**
 * lib/a-theme-preview-wears-the-palette.test.ts — THE MOOD BOARD PALETTE IS THE
 * PRIORITY (owner 2026-10-05, DECISION_LOG), verbatim: *"The priority palette
 * will always be based on the mood board. If the mood board does not have a
 * palette, use our original theme and place it on the moodboard's palette. If a
 * moodboard has a color palette already then all themes will adapt to the color
 * palette of the moodboard."*
 *
 * 🔴 WHAT WAS WRONG (measured on maria-and-jose, prod, 375 px): a light Mood
 * Board under Cyber Neon — the canvas light, every words-only scene tile dark,
 * because the tiles read `INVITE_THEMES.cyber.palette` while the page wore the
 * board. Two readers of one fact; each passed its own tests.
 *
 * 🔒 SO EVERY PICTURE OF A THEME ASKS ONE RESOLVER (`lib/theme-colours.ts`):
 *   · its behaviour — the three cases, agreement between the page's vars and
 *     the pictures' hexes, the sample's palette param, the draft's fill;
 *   · the wiring — each theme preview calls it, and no file in the Maker, the
 *     guest components or the print path reads a theme's colours around it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUB_THEMES, INVITE_THEMES } from '@/lib/invite-themes';
import {
  paletteColourVars,
  paletteFromSampleParam,
  samplePaletteParam,
  seededTheme,
  themeColours,
  themeSeedPalette,
} from '@/lib/theme-colours';
import { buildSitePaletteVars } from '@/lib/site-palette';
import { printLookFor } from '@/lib/print-pieces';
import {
  eventColumnChange,
  overlayHubDraftEvent,
  sanitizeHubDraftEventValue,
} from '@/lib/hub-draft';
import { hubDraftChangePlace } from '@/lib/hub-draft-change-lines';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** maria-and-jose's live board (prod, 2026-10-05) — the real-shaped case. */
const MARIA = {
  bride: ['#FBFBFA', '#C5A059'],
  groom: ['#1E2229', '#C5A059'],
  guest: ['#FBFBFA', '#C5A059', '#9CA98B', '#C9A9A6'],
  ceremony: ['#FBFBFA', '#C5A059', '#9CA98B'],
  reception: ['#FBFBFA', '#C5A059', '#9CA98B', '#C9A9A6', '#D8C7B0'],
  officiants: ['#FBFBFA', '#C5A059'],
  wedding_party: ['#9CA98B', '#C9A9A6', '#C5A059'],
  principal_sponsors: ['#C5A059', '#1E2229'],
  secondary_sponsors: ['#9CA98B', '#C5A059'],
  bearers_flower_girl: ['#FBFBFA', '#9CA98B'],
};

const ch = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/* ── behaviour ─────────────────────────────────────────────────────────── */

test('no palette → every theme wears its own colours, and the page paints nothing over it', () => {
  for (const t of HUB_THEMES) {
    for (const empty of [null, {}, { room_dressing: {} }, { reception: [] }]) {
      assert.deepEqual(themeColours(t.id, empty), { source: 'theme', colours: t.palette }, `${t.id}`);
      assert.equal(paletteColourVars(empty, t.id), null, `${t.id}`);
    }
  }
});

test('a Mood Board palette → EVERY theme wears the same colours, and the pictures agree with the page', () => {
  const page = buildSitePaletteVars(MARIA)!;
  for (const t of HUB_THEMES) {
    const vars = paletteColourVars(MARIA, t.id);
    assert.deepEqual(vars, page, `${t.id}: the guest page wears the board's derivation, unchanged`);
    const { source, colours } = themeColours(t.id, MARIA);
    assert.equal(source, 'palette', t.id);
    // The tile's ground, words and accent ARE the page's paper, ink and eyebrow.
    assert.equal(ch(colours.canvas), vars!['--color-cream'], `${t.id} canvas`);
    assert.equal(ch(colours.ink), vars!['--color-ink'], `${t.id} ink`);
    assert.equal(ch(colours.accent), vars!['--color-terracotta'], `${t.id} accent`);
  }
  // The live proof's case: Cyber Neon under maria-and-jose's board is LIGHT.
  assert.equal(themeColours('cyber', MARIA).colours.canvas, '#fbfbfa');
  assert.notEqual(themeColours('cyber', MARIA).colours.canvas, INVITE_THEMES.cyber.palette.canvas);
});

test("a theme's seed IS that theme's colours — on itself byte-identical, on every other theme its own page block", () => {
  for (const seedTheme of HUB_THEMES) {
    const seed = themeSeedPalette(seedTheme.id);
    assert.ok(seed.reception && seed.reception.length > 0 && seed.reception.length <= 5, `${seedTheme.id} seeds the five main colours`);
    assert.equal(seededTheme(seed), seedTheme.id, `${seedTheme.id} seed is recognised`);
    for (const worn of HUB_THEMES) {
      const vars = paletteColourVars(seed, worn.id);
      const { colours } = themeColours(worn.id, seed);
      assert.deepEqual(colours, seedTheme.palette, `${worn.id} wears ${seedTheme.id}'s colours`);
      if (worn.id === seedTheme.id) {
        assert.equal(vars, null, `${worn.id} on its own seed adds nothing — the theme block paints`);
      } else {
        assert.equal(vars!['--color-cream'], ch(seedTheme.palette.canvas), `${worn.id} under ${seedTheme.id}'s seed: paper`);
        assert.equal(vars!['--hub-canvas'], seedTheme.palette.canvas);
      }
    }
  }
  // A dark theme picked on an empty board stays dark — the board's own
  // derivation (always-near-white paper) would have drawn it light.
  assert.equal(themeColours('velvet', themeSeedPalette('cyber')).colours.canvas, INVITE_THEMES.cyber.palette.canvas);
  assert.equal(seededTheme(MARIA), null, "a couple's own board is nobody's seed");
});

test('the prints wear the same answer — palette paper, palette ink, a paper veil over a full still', () => {
  for (const t of HUB_THEMES) {
    const own = printLookFor(t.id);
    assert.equal(own.paper, t.palette.canvas, `${t.id} without a palette prints in its own colours`);
    const dressed = printLookFor(t.id, themeColours(t.id, MARIA));
    assert.equal(dressed.paper, '#fbfbfa', `${t.id} prints on the board's paper`);
    assert.equal(dressed.ink, themeColours(t.id, MARIA).colours.ink, `${t.id} ink`);
    if (dressed.still === 'full') {
      assert.ok(dressed.scrim && dressed.scrim.color === dressed.paper && dressed.scrim.opacity >= 0.8, `${t.id}: a full still is veiled in the paper`);
    }
  }
});

test("the gallery's sample param round-trips the couple's swatches, says 'none' for an empty board, and refuses anything else", () => {
  assert.equal(samplePaletteParam(null), 'none');
  assert.equal(samplePaletteParam({}), 'none');
  const p = samplePaletteParam(MARIA);
  assert.match(p, /^[0-9A-F]{6}(\.[0-9A-F]{6})*$/);
  const back = paletteFromSampleParam(p)!;
  assert.deepEqual(buildSitePaletteVars(back), buildSitePaletteVars(MARIA), 'the sample wears exactly the couple’s page colours');
  for (const t of HUB_THEMES) assert.deepEqual(themeColours(t.id, back), themeColours(t.id, MARIA));
  assert.equal(paletteFromSampleParam('none'), null);
  for (const bad of [undefined, null, '', 'red', 'FBFBFA.zzzzzz', '<script>', 'FBFBFA,C5A059']) {
    assert.equal(paletteFromSampleParam(bad as string | null | undefined), undefined, String(bad));
  }
  const seedBack = paletteFromSampleParam(samplePaletteParam(themeSeedPalette('cyber')));
  assert.equal(seededTheme(seedBack), 'cyber', 'a seeded board survives the trip');
});

test('the draft takes a theme’s colours only onto an EMPTY board, never clears one, and names where they came from', () => {
  const seed = themeSeedPalette('cyber');
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', seed), seed);
  assert.equal(sanitizeHubDraftEventValue('role_palette', null), undefined, 'the board is never cleared from the draft');
  assert.equal(sanitizeHubDraftEventValue('role_palette', MARIA), undefined, 'only a theme seed is draftable');
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: ['#FFF'] }), undefined);
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: Array(6).fill('#FFFFFF') }), undefined);

  assert.equal(eventColumnChange('role_palette', null, seed), 'add');
  assert.equal(eventColumnChange('role_palette', {}, seed), 'add');
  assert.equal(eventColumnChange('role_palette', MARIA, seed), 'none', 'a board with colours is never replaced');

  const draft = { events: { role_palette: seed, invite_theme: 'cyber' }, widgets: {} };
  assert.deepEqual(overlayHubDraftEvent({ role_palette: null }, draft).role_palette, seed, 'an empty board shows the fill');
  assert.deepEqual(overlayHubDraftEvent({ role_palette: MARIA }, draft).role_palette, MARIA, 'a painted board wins');

  const place = hubDraftChangePlace(
    { kind: 'event', column: 'role_palette', value: seed, change: 'add', pro: false } as Parameters<typeof hubDraftChangePlace>[0],
    { events: {}, widgets: [] } as unknown as Parameters<typeof hubDraftChangePlace>[1],
  );
  assert.deepEqual(place, { place: 'Mood Board', what: 'Colours from Cyber Neon' });
});

/* ── wiring: every theme preview asks the ONE resolver ──────────────────── */

/** The slice of `src` from `start` up to the first `end` after it. */
function region(src: string, start: string, end: string, file: string): string {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `${file}: "${start}" not found — the guard lost its anchor`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b > a, `${file}: "${end}" not found after "${start}"`);
  return src.slice(a, b);
}

/** A direct read of a theme's own colours. */
const RAW_THEME_COLOUR = /\.palette\??\.(canvas|surface|ink|muted|accent|accentInk|heading|lightInk|darkInk)\b/;

test("the Maker's scene tiles take their colours from the resolver, with the board as drafted", () => {
  const file = 'app/dashboard/[eventId]/website/editor/page.tsx';
  const tint = region(read(file), 'tint: (() => {', '})(),', file);
  assert.match(tint, /themeColours\(currentThemeId,\s*\(drafted as \{ role_palette\?: unknown \}\)\.role_palette\)/, 'the tile tint asks themeColours with the drafted board');
  assert.doesNotMatch(tint, RAW_THEME_COLOUR, 'the tile tint reads a theme palette around the resolver');
  assert.doesNotMatch(tint, /INVITE_THEMES/, 'the tile tint reads the theme registry around the resolver');
  // The miniature itself draws only what it is handed.
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.doesNotMatch(shell, /INVITE_THEMES/, 'editor-shell paints a tile from the theme registry');
  assert.doesNotMatch(shell, RAW_THEME_COLOUR, 'editor-shell paints a tile from a theme palette');
});

test('the guest page and the prints ask the same resolver', () => {
  const loaders = 'app/[slug]/_lib/loaders.ts';
  const look = region(read(loaders), 'export function guestLookFrom(', '\n}\n', loaders);
  assert.match(look, /paletteColourVars\(event\.role_palette,\s*hub\.theme\)/);
  assert.doesNotMatch(look, /buildSitePaletteVars\(/, 'guestLookFrom builds palette vars around the resolver');

  const set = 'lib/print-set.server.ts';
  const call = region(read(set), 'const look = printLookFor(', ');', set);
  assert.match(call, /themeColours\(theme,/, 'the print set hands printLookFor the resolver’s answer');

  const pieces = 'lib/print-pieces.ts';
  const body = region(read(pieces), 'export function printLookFor(', '\n}\n', pieces);
  const afterSignature = body.slice(body.indexOf('): PrintLook {'));
  assert.doesNotMatch(afterSignature, RAW_THEME_COLOUR, 'printLookFor paints from the theme palette around its dressed colours');
  for (const f of ['paper: colours.canvas', 'ink: colours.ink', 'muted: colours.muted', 'accent: colours.accent', 'heading: colours.heading']) {
    assert.ok(afterSignature.includes(f), `printLookFor: ${f}`);
  }
});

test("the theme gallery's samples — page, prints and full-screen preview — wear the couple's palette", () => {
  const picker = read('app/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx');
  const calls = [...picker.matchAll(/\b(sampleHubTileSrc|samplePrintSrc)\(([^)]*)\)/g)];
  assert.ok(calls.length >= 2, 'the gallery draws its samples');
  for (const [all] of calls) assert.match(all, /samplePalette\)$/, `${all} — a sample drawn without the couple's palette`);
  const overlay = read('app/dashboard/[eventId]/launch/_components/theme-preview-overlay.tsx');
  const ov = [...overlay.matchAll(/\bsampleHubTileSrc\(([^)]*)\)/g)];
  assert.ok(ov.length >= 1);
  for (const [all] of ov) assert.match(all, /samplePalette\)$/, `${all} — the preview drawn without the couple's palette`);
  // …and the sample door + the sample page read it.
  assert.match(read('lib/print-sample-door.server.ts'), /paletteFromSampleParam\(url\.searchParams\.get\('palette'\)\)/);
  assert.match(read('app/[slug]/page.tsx'), /paletteFromSampleParam\(search\.palette\)/);
  // The provider is told by the Maker, from the LIVE board.
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /samplePalette: samplePaletteParam\(printEvent\.role_palette\)/);
  assert.match(launch, /seeds: paletteIsSet\(printEvent\.role_palette\) \? null : themeSeedPalettes\(\)/);
});

/**
 * 🧹 THE SWEEP — no file in the Maker, the guest components or the print path
 * reads a theme's colours around the resolver. Each exception is the
 * NO-PALETTE branch only, named with why.
 */
const SWEEP_ROOTS = [
  'app/dashboard/[eventId]/launch',
  'app/dashboard/[eventId]/website',
  'app/dashboard/[eventId]/details',
  'app/[slug]/_components',
  'app/[slug]/_lib',
  'app/api/hub-print',
];
const SWEEP_ALLOWED: Record<string, string> = {
  // The Colors panel's "Theme's" choice — what a page with NO Mood Board wears;
  // with a board the panel shows `moodBoardSiteColours` instead.
  'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx': 'the no-palette default of the Colors panel',
  // The button-colour swatches' fallback, used only when the board has no swatches.
  'app/dashboard/[eventId]/website/editor/page.tsx': 'button swatches when the board is empty',
  'app/dashboard/[eventId]/details/_components/record-editor.tsx': 'button swatches when the board is empty',
  // The page's own legibility over the couple's colours (`pinPlateInk`) — it
  // reads the theme's INKS as candidates, never as the page's colours.
  'app/[slug]/_lib/pro-site-vars.ts': 'plate-ink candidates, not the page colours',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(WEB, dir))) {
    const rel = join(dir, name);
    const st = statSync(join(WEB, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

test('the sweep: nothing in the Maker, guest components or print door reads a theme’s colours around the resolver', () => {
  const offenders: string[] = [];
  let scanned = 0;
  for (const root of SWEEP_ROOTS) {
    for (const f of walk(root)) {
      scanned += 1;
      const src = read(f);
      if (!RAW_THEME_COLOUR.test(src)) continue;
      const rel = relative(WEB, join(WEB, f));
      if (!(rel in SWEEP_ALLOWED)) offenders.push(rel);
    }
  }
  assert.ok(scanned > 100, `scanned only ${scanned} files — the sweep's roots moved`);
  assert.deepEqual(offenders, [], `theme colours read around lib/theme-colours.ts:\n${offenders.join('\n')}`);
  // Every exception still exists and still needs to be one (a stale entry hides the next offender).
  for (const f of Object.keys(SWEEP_ALLOWED)) assert.match(read(f), RAW_THEME_COLOUR, `${f} no longer reads a theme colour — drop its exception`);
});

test('every theme in the one order has a seed nobody else shares', () => {
  const seen = new Set<string>();
  for (const t of HUB_THEMES) {
    const key = [...(themeSeedPalette(t.id).reception ?? [])].sort().join(',');
    assert.ok(!seen.has(key), `${t.id} seeds the same colours as another theme — a pick could not be told apart`);
    seen.add(key);
  }
});
