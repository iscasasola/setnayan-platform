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
  boardIsTheCouples,
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
  planHubDraftApply,
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
    const vars = paletteColourVars(MARIA, t.id)!;
    for (const [k, v] of Object.entries(page)) assert.equal(vars[k], v, `${t.id} ${k}: the board's derivation, unchanged`);
    const { source, colours } = themeColours(t.id, MARIA);
    assert.equal(source, 'palette', t.id);
    // The tile's ground, words and accent ARE the page's paper, ink and eyebrow.
    assert.equal(ch(colours.canvas), vars['--color-cream'], `${t.id} canvas`);
    assert.equal(ch(colours.ink), vars['--color-ink'], `${t.id} ink`);
    assert.equal(ch(colours.accent), vars['--color-terracotta'], `${t.id} accent`);
    // …and the theme's own `--hub-*` hexes speak the board too, never the theme.
    for (const k of ['canvas', 'surface', 'ink', 'muted', 'accent', 'heading'] as const) {
      assert.equal(vars[`--hub-${k}`], colours[k], `${t.id} --hub-${k}`);
    }
    assert.equal(vars['--hub-accent-ink'], colours.accentInk);
  }
  // The live proof's case: Cyber Neon under maria-and-jose's board is LIGHT.
  assert.equal(themeColours('cyber', MARIA).colours.canvas, '#fbfbfa');
  assert.notEqual(themeColours('cyber', MARIA).colours.canvas, INVITE_THEMES.cyber.palette.canvas);
});

test('owner: "when mood board theme palette changes, then the theme will adjust accordingly" — every picture re-dresses, every address moves', () => {
  // The couple edits two colours on their board: the near-white paper warms, the gold turns rose.
  const SWAP: Record<string, string> = { '#FBFBFA': '#FFF5EE', '#C5A059': '#A63D57' };
  const edited = Object.fromEntries(Object.entries(MARIA).map(([k, v]) => [k, v.map((c) => SWAP[c] ?? c)]));
  for (const t of HUB_THEMES) {
    const before = themeColours(t.id, MARIA).colours;
    const after = themeColours(t.id, edited).colours;
    assert.notEqual(after.canvas, before.canvas, `${t.id}: the tile/print paper did not follow the board`);
    assert.notEqual(after.accent, before.accent, `${t.id}: the tile/print accent did not follow the board`);
    assert.equal(ch(after.canvas), paletteColourVars(edited, t.id)!['--color-cream'], `${t.id}: page and tile disagree after the edit`);
    assert.equal(printLookFor(t.id, themeColours(t.id, edited)).paper, after.canvas, `${t.id}: the print did not follow`);
  }
  // No stale picture: the gallery's sample address IS the swatches…
  assert.notEqual(samplePaletteParam(edited), samplePaletteParam(MARIA), 'a sample page/print URL survives a board edit — it would be served stale');
  // …the couple's print preview address names the event row it is drawn from (role_palette included)…
  const set = read('lib/print-set.server.ts');
  assert.match(set, /'event_id, display_name, event_type, [^']*\brole_palette\b[^']*'/, 'the print row (and so its preview hash) no longer reads the board');
  assert.match(set, /printPreviewVersion\(\{ event, inputs, qrLook \}\)/, 'the print preview hash no longer covers the event row');
  // …a drafted fill is named in the preview's draft address…
  assert.match(read('lib/ceremony-time.ts'), /PRINT_DRAFTED_KEYS = \[[\s\S]*?'role_palette'[\s\S]*?\] as const/);
  // …and the scene tiles re-copy when the canvas scope's inline colours change (the chain is compared).
  assert.match(read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), /JSON\.stringify\(old\.chain\) === JSON\.stringify\(v\.chain\)/);
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
  // A theme-filled board is refilled by the next pick, so each sample shows its own colours.
  assert.equal(samplePaletteParam(themeSeedPalette('cyber')), 'none');
});

test('the draft fills a board that is not the couple’s, refills a theme-filled one, never touches a painted one, and names the theme', () => {
  const seed = themeSeedPalette('cyber');
  const velvet = themeSeedPalette('velvet');
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', seed), seed);
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', { reception: [...seed.reception].reverse() }), seed, 'a seed in any order is that seed');
  assert.equal(sanitizeHubDraftEventValue('role_palette', null), undefined, 'the board is never cleared from the draft');
  assert.equal(sanitizeHubDraftEventValue('role_palette', MARIA), undefined, 'only a theme seed is draftable');
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: ['#123456'] }), undefined, 'colours no theme writes are refused');
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: ['#FFF'] }), undefined);
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: Array(6).fill('#FFFFFF') }), undefined);

  assert.equal(boardIsTheCouples(null), false);
  assert.equal(boardIsTheCouples(seed), false, 'a theme-filled board is still the theme’s (owner: "New theme refills them")');
  assert.equal(boardIsTheCouples(MARIA), true);

  assert.equal(eventColumnChange('role_palette', null, seed), 'add');
  assert.equal(eventColumnChange('role_palette', {}, seed), 'add');
  assert.equal(eventColumnChange('role_palette', velvet, seed), 'change', 'a theme-filled board is refilled');
  assert.equal(eventColumnChange('role_palette', seed, seed), 'none');
  assert.equal(eventColumnChange('role_palette', MARIA, seed), 'none', 'a painted board is never replaced');

  const draft = { events: { role_palette: seed, invite_theme: 'cyber' }, widgets: {} };
  assert.deepEqual(overlayHubDraftEvent({ role_palette: null }, draft).role_palette, seed, 'an empty board shows the fill');
  assert.deepEqual(overlayHubDraftEvent({ role_palette: velvet }, draft).role_palette, seed, 'a theme-filled board shows the refill');
  assert.deepEqual(overlayHubDraftEvent({ role_palette: MARIA }, draft).role_palette, MARIA, 'a painted board wins');

  const place = hubDraftChangePlace(
    { kind: 'event', column: 'role_palette', value: seed, change: 'add', pro: false } as Parameters<typeof hubDraftChangePlace>[0],
    { events: {}, widgets: [] } as unknown as Parameters<typeof hubDraftChangePlace>[1],
  );
  assert.deepEqual(place, { place: 'Mood Board', what: 'Colours from Cyber Neon' });
});

test('a held Pro theme holds its colours with it at Apply; a free theme applies both', () => {
  const live = { events: { invite_theme: null, role_palette: null }, widgets: [] } as unknown as Parameters<typeof planHubDraftApply>[1];
  const pro = HUB_THEMES.find((t) => t.tier === 'pro' && t.ready)!;
  const held = planHubDraftApply({ events: { invite_theme: pro.id, role_palette: themeSeedPalette(pro.id) }, widgets: {} }, live, false);
  const cols = (items: typeof held.apply) => items.flatMap((i) => (i.kind === 'event' ? [i.column] : []));
  assert.deepEqual(cols(held.apply), [], `${pro.id} without Pro: nothing applies`);
  assert.deepEqual(cols(held.refused).sort(), ['invite_theme', 'role_palette'], 'the colours are held WITH the theme');
  assert.deepEqual(held.remaining.events.role_palette, themeSeedPalette(pro.id), 'the held colours stay drafted');
  const owned = planHubDraftApply({ events: { invite_theme: pro.id, role_palette: themeSeedPalette(pro.id) }, widgets: {} }, live, true);
  assert.deepEqual(cols(owned.apply).sort(), ['invite_theme', 'role_palette']);
  const free = HUB_THEMES.find((t) => t.tier === 'free' && t.id !== 'house')!;
  const plan = planHubDraftApply({ events: { invite_theme: free.id, role_palette: themeSeedPalette(free.id) }, widgets: {} }, live, false);
  assert.deepEqual(cols(plan.apply).sort(), ['invite_theme', 'role_palette']);
  // …and Apply writes the fill conditionally on the board it read — never over a board painted since.
  const act = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(act, /board\.is\('role_palette', null\)/);
  assert.match(act, /board\.eq\('role_palette', JSON\.stringify\(paletteRead\)\)/);
  assert.match(act, /delete eventsPatch\.role_palette;/);
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
  // The element editor's theme colours and the Love Story scrapbook's `--ls-*` vars ask it too.
  const element = region(read(file), 'elementEditing={{', 'draftAction:', file);
  assert.match(element, /themeColours\(currentThemeId,\s*\(drafted as \{ role_palette\?: unknown \}\)\.role_palette\)/);
  const story = read('app/dashboard/[eventId]/website/our-story/page.tsx');
  assert.match(story, /const p = themeColours\(theme\.id, board\)\.colours;/);
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
  // An empty (or theme-filled) board keeps the static stills — each theme's own colours, captured with `none`.
  assert.match(picker, /samplePalette && samplePalette !== 'none' \? null : themeStillSrc\(id\)/);
  assert.match(read('scripts/capture-theme-samples.ts'), /sampleHubTileSrc\(id, 'none'\)/);
  // …and the sample door + the sample page read it.
  assert.match(read('lib/print-sample-door.server.ts'), /paletteFromSampleParam\(url\.searchParams\.get\('palette'\)\)/);
  assert.match(read('app/[slug]/page.tsx'), /paletteFromSampleParam\(search\.palette\)/);
  // The provider is told by the Maker, from the LIVE board.
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /samplePalette: samplePaletteParam\(printEvent\.role_palette\)/);
  assert.match(launch, /seeds: boardIsTheCouples\(printEvent\.role_palette\) \? null : themeSeedPalettes\(\)/);
});

/**
 * 🧹 THE SWEEP — no file in the Maker, the guest components or the print path
 * reads a theme's colours around the resolver: not a field (`.palette.canvas`),
 * not the whole palette into a variable (`const p = theme.palette`,
 * `INVITE_THEMES[id]?.palette ?? …`), not destructured (`{ palette } = theme`).
 * Each exception is ONE LINE, named by an anchor on it, with why — never a file.
 */
const SWEEP_ROOTS = [
  'app/dashboard/[eventId]/launch',
  'app/dashboard/[eventId]/website',
  'app/dashboard/[eventId]/details',
  'app/[slug]/_components',
  'app/[slug]/_lib',
  'app/api/hub-print',
];
const THEME_COLOUR_READS = [
  RAW_THEME_COLOUR,
  /INVITE_THEMES\[[^\]]*\]\??\.palette\b/,
  /\b(?:theme|t|worn|seed|pal)\??\.palette\b(?!\s*:)/,
  /\{[^}]*\bpalette\b[^}]*\}\s*=\s*(?:INVITE_THEMES|theme\b|t\b)/,
];
const SWEEP_ALLOWED_LINES: Record<string, Record<string, string>> = {
  'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx': {
    // The Colors panel's fallback — used only when `moodBoard` (the board, via `boardSiteColours`) is null: no palette.
    'return { theme, background: theme.palette.canvas, buttons: theme.palette.accent };': 'no-palette default of the Colors panel',
  },
  'app/[slug]/_lib/pro-site-vars.ts': {
    // The plate's ink — the theme's INKS as legibility candidates, never the page's colours.
    "proSiteVars['--color-ink-on-plate'] = channels(theme.palette.ink);": 'plate ink pinned under the couple’s own background',
    "vars['--color-paper-deep'] ?? channels(theme.palette.surface)": 'plate paper when no layer painted one',
    "vars['--color-ink-on-plate'] ?? channels(theme.palette.ink)": 'plate ink when no layer named one',
    'channels(theme.palette.ink),': 'plate-ink candidate',
    'channels(theme.palette.darkInk),': 'plate-ink candidate',
    'channels(theme.palette.lightInk),': 'plate-ink candidate',
  },
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
  const used = new Set<string>();
  let scanned = 0;
  for (const root of SWEEP_ROOTS) {
    for (const f of walk(root)) {
      scanned += 1;
      const rel = relative(WEB, join(WEB, f));
      const allowed = SWEEP_ALLOWED_LINES[rel] ?? {};
      read(f).split('\n').forEach((line, i) => {
        if (!THEME_COLOUR_READS.some((re) => re.test(line))) return;
        const anchor = Object.keys(allowed).find((a) => line.includes(a));
        if (anchor) used.add(`${rel}::${anchor}`);
        else offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
  }
  assert.ok(scanned > 100, `scanned only ${scanned} files — the sweep's roots moved`);
  assert.deepEqual(offenders, [], `theme colours read around lib/theme-colours.ts:\n${offenders.join('\n')}`);
  // Every exception still matches a line (a stale entry hides the next offender).
  for (const [f, anchors] of Object.entries(SWEEP_ALLOWED_LINES)) {
    for (const a of Object.keys(anchors)) assert.ok(used.has(`${f}::${a}`), `${f}: "${a}" no longer reads a theme colour — drop its exception`);
  }
});

test('every theme in the one order has a seed nobody else shares', () => {
  const seen = new Set<string>();
  for (const t of HUB_THEMES) {
    const key = [...(themeSeedPalette(t.id).reception ?? [])].sort().join(',');
    assert.ok(!seen.has(key), `${t.id} seeds the same colours as another theme — a pick could not be told apart`);
    seen.add(key);
  }
});
