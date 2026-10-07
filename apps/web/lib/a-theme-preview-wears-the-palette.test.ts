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
import { sanitizeRolePalette } from './mood-board';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUB_THEMES, INVITE_THEMES } from '@/lib/invite-themes';
import {
  boardIsTheCouples,
  dressedTheme,
  paletteColourVars,
  sampleBoardQuery,
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
import { boardWithFill } from '@/lib/mood-board-palette-set';
import { writePaletteFill } from '@/lib/palette-fill-write';
import { THEME_STILL_CAPTURE_TAG } from '@/lib/theme-sample-stills-hash';

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
  // The live proof's case: Cyber Neon under maria-and-jose's board wears its
  // Neutral (main slot 4, "THE 5 MAIN COLOURS") — light, never Cyber Neon's night.
  assert.equal(themeColours('cyber', MARIA).colours.canvas, '#c9a9a6');
  assert.notEqual(themeColours('cyber', MARIA).colours.canvas, INVITE_THEMES.cyber.palette.canvas);
});

test('owner: "when mood board theme palette changes, then the theme will adjust accordingly" — every picture re-dresses, every address moves', () => {
  // The couple edits two of their main colours: the Neutral (paper) and the Accent (buttons, links).
  const SWAP: Record<string, string> = { '#C9A9A6': '#FFF5EE', '#9CA98B': '#A63D57' };
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
  assert.notEqual(sampleBoardQuery(edited, 'e1'), sampleBoardQuery(MARIA, 'e1'), 'a sample page/print URL survives a board edit — it would be served stale');
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
    assert.equal(dressed.paper, '#c9a9a6', `${t.id} prints on the board's paper (its Neutral)`);
    assert.equal(dressed.ink, themeColours(t.id, MARIA).colours.ink, `${t.id} ink`);
    if (dressed.still === 'full') {
      assert.ok(dressed.scrim && dressed.scrim.color === dressed.paper && dressed.scrim.opacity >= 0.8, `${t.id}: a full still is veiled in the paper`);
    }
  }
});

test("the gallery's sample address never carries colours — one of a fixed set, read on the server, moved by every edit", () => {
  const EID = '947e7bab-893d-454d-b4c5-0a6e23f36009';
  assert.equal(sampleBoardQuery(null, EID), 'palette=none');
  assert.equal(sampleBoardQuery({}, EID), 'palette=none');
  assert.equal(sampleBoardQuery(themeSeedPalette('cyber'), EID), 'palette=none', 'a theme-filled board is refilled by a pick: each theme in its own colours');
  const q = sampleBoardQuery(MARIA, EID);
  assert.match(q, new RegExp(`^board=${EID}&bv=[0-9a-z]+$`));
  assert.doesNotMatch(q, /[0-9A-F]{6}/, 'colours in the public address');
  // The server reads it: only `none`, or the named event's board for its signed-in host.
  const door = read('lib/sample-board.server.ts');
  assert.match(door, /if \(search\.palette === 'none'\) return null;/);
  assert.match(door, /const viewer = await getCurrentUser\(\)/);
  assert.match(door, /if \(!viewer\) return null;/);
  assert.match(door, /loadHostMembership\(admin, eventId, viewer\.id\)/);
  assert.match(door, /return boardIsTheCouples\(board\) \? sanitizeRolePalette\(board\) : null;/);
  assert.doesNotMatch(door, /searchParams\.get\('palette'\)[^;]*#/, 'colours parsed from the request');
});

test('the draft fills a board that is not the couple’s, refills a theme-filled one, never touches a painted one, and names the theme', () => {
  const seed = themeSeedPalette('cyber');
  const velvet = themeSeedPalette('velvet');
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', seed), seed);
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', { reception: [...seed.reception].reverse() }), seed, 'a seed in any order is that seed');
  assert.equal(sanitizeHubDraftEventValue('role_palette', null), undefined, 'the board is never cleared from the draft');
  /* 🎨 STEP 4c (controller 2026-10-07): a board the couple PAINTED is draftable too —
     through the Mood Board's own sanitizer (\`the-draft-holds-a-painted-palette.test.ts\`);
     a theme seed keeps its fill rule, and a board with no valid colour is still refused. */
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', MARIA), sanitizeRolePalette(MARIA), 'a painted board is held as the Mood Board reads it');
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', { reception: ['#123456'] }), { reception: ['#123456'] }, 'colours no theme writes are a painted board');
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: ['#FFF'] }), undefined, 'no valid colour — no palette');
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: ['nope'] }), undefined);

  assert.equal(boardIsTheCouples(null), false);
  assert.equal(boardIsTheCouples(seed), false, 'a theme-filled board is still the theme’s (owner: "New theme refills them")');
  assert.equal(boardIsTheCouples(MARIA), true);
  // Theme-written is STRUCTURAL: the seed and nothing else. Anything the couple added makes it theirs.
  for (const extra of [{ room_dressing: { florals: '#ffffff' } }, { touched_roles: ['bride'] }, { custom_roles: [] }, { bride: ['#123456'] }]) {
    assert.equal(boardIsTheCouples({ ...seed, ...extra }), true, `seed + ${Object.keys(extra)[0]} is the couple's`);
  }
  // A fill MERGES into the board it lands on — an empty board's room dressing is kept.
  assert.deepEqual(boardWithFill({ room_dressing: { florals: 'x' } }, seed), { room_dressing: { florals: 'x' }, reception: seed.reception });
  assert.equal(boardWithFill(MARIA, seed), null, 'a board the couple made is never filled');

  assert.equal(eventColumnChange('role_palette', null, seed), 'add');
  assert.equal(eventColumnChange('role_palette', {}, seed), 'add');
  assert.equal(eventColumnChange('role_palette', velvet, seed), 'change', 'a theme-filled board is refilled');
  assert.equal(eventColumnChange('role_palette', seed, seed), 'none');
  assert.equal(eventColumnChange('role_palette', MARIA, seed), 'none', 'a painted board is never replaced');

  const draft = { events: { role_palette: seed, invite_theme: 'cyber' }, widgets: {} };
  assert.deepEqual(overlayHubDraftEvent({ role_palette: null }, draft).role_palette, seed, 'an empty board shows the fill');
  assert.deepEqual(overlayHubDraftEvent({ role_palette: velvet }, draft).role_palette, seed, 'a theme-filled board shows the refill');
  assert.deepEqual(overlayHubDraftEvent({ role_palette: MARIA }, draft).role_palette, MARIA, 'a painted board wins');
  assert.deepEqual(
    overlayHubDraftEvent({ role_palette: { room_dressing: { florals: 'x' } } }, draft).role_palette,
    { room_dressing: { florals: 'x' }, reception: seed.reception },
    'the canvas shows the fill as Apply will land it — merged',
  );

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
  // …and Apply writes it through the one compare-and-swap (exercised below), out of the session UPDATE.
  const act = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(act, /delete eventsPatch\.role_palette;/);
  assert.match(act, /await writePaletteFill\(supabase as unknown as PaletteFillClient, eventId, paletteRead, seed\)/);
});

/** A stand-in session: records the UPDATE's filters, answers rows/no rows, and a re-read. */
function fakeClient(opts: { rows: number; error?: unknown; now?: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const filter = {
    is: (c: string, v: unknown) => (calls.push(['is', c, v]), filter),
    contains: (c: string, v: unknown) => (calls.push(['contains', c, v]), filter),
    containedBy: (c: string, v: unknown) => (calls.push(['containedBy', c, v]), filter),
    select: async () => ({ data: Array.from({ length: opts.rows }, () => ({ event_id: 'e' })), error: opts.error ?? null }),
  };
  const client = {
    from: () => ({
      update: (patch: unknown) => (calls.push(['update', patch]), { eq: () => filter }),
      select: () => ({ eq: () => ({ maybeSingle: async () => (calls.push(['reread']), { data: { role_palette: opts.now }, error: null }) }) }),
    }),
  };
  return { client: client as unknown as Parameters<typeof writePaletteFill>[0], calls };
}

test("Apply's fill: a merge, a compare-and-swap on the board as read, rows counted — never over the couple's board", async () => {
  const seed = themeSeedPalette('cyber');
  // An empty board (NULL): `IS NULL`, the seed written.
  let f = fakeClient({ rows: 1 });
  assert.deepEqual(await writePaletteFill(f.client, 'e', null, seed), { ok: true, wrote: true });
  assert.deepEqual(f.calls[0], ['update', { role_palette: { reception: seed.reception } }]);
  assert.deepEqual(f.calls[1], ['is', 'role_palette', null]);
  // A board with only room dressing: merged, matched by containment both ways — never a string compare.
  const dressed = { room_dressing: { florals: 'x' } };
  f = fakeClient({ rows: 1 });
  await writePaletteFill(f.client, 'e', dressed, seed);
  assert.deepEqual(f.calls[0], ['update', { role_palette: { ...dressed, reception: seed.reception } }]);
  assert.deepEqual(f.calls.slice(1, 3), [['contains', 'role_palette', dressed], ['containedBy', 'role_palette', dressed]]);
  // The board was painted between the read and the write: zero rows, re-read, it is theirs → success, nothing written.
  f = fakeClient({ rows: 0, now: MARIA });
  assert.deepEqual(await writePaletteFill(f.client, 'e', null, seed), { ok: true, wrote: false });
  assert.ok(f.calls.some(([k]) => k === 'reread'), 'zero rows were not re-read');
  // Zero rows and the board is still not theirs → the write did not land: Apply again.
  f = fakeClient({ rows: 0, now: null });
  assert.deepEqual(await writePaletteFill(f.client, 'e', null, seed), { ok: false });
  f = fakeClient({ rows: 0, error: { message: 'refused' }, now: themeSeedPalette('velvet') });
  assert.deepEqual(await writePaletteFill(f.client, 'e', themeSeedPalette('velvet'), seed), { ok: false });
  // The board as read is the couple's: nothing is even attempted.
  f = fakeClient({ rows: 1 });
  assert.deepEqual(await writePaletteFill(f.client, 'e', MARIA, seed), { ok: true, wrote: false });
  assert.equal(f.calls.length, 0);
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
  assert.match(picker, /samplePalette && samplePalette !== 'palette=none' \? null : themeStillSrc\(id\)/);
  assert.match(read('scripts/capture-theme-samples.ts'), /sampleHubTileSrc\(id, THEME_STILL_CAPTURE_TAG\)/);
  assert.equal(THEME_STILL_CAPTURE_TAG, 'palette=none', 'the stills are each theme in its own colours');
  // …and the sample door + the sample page read it.
  assert.match(read('lib/print-sample-door.server.ts'), /await sampleBoardFor\(\{ palette: url\.searchParams\.get\('palette'\), board \}\)/);
  assert.match(read('lib/print-sample-door.server.ts'), /'cache-control': board \? 'private, max-age=3600'/, 'a couple’s board in a shared cache');
  assert.match(read('app/[slug]/page.tsx'), /await sampleBoardFor\(search\)/);
  // The provider is told by the Maker, from the LIVE board.
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /samplePalette: sampleBoardQuery\(printEvent\.role_palette, eventId\)/);
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
  'app/_components',
  'lib',
  'scripts',
];
/** The resolver itself — the one place a theme's own colours are the answer. */
const RESOLVER_FILES = new Set(['lib/theme-colours.ts', 'lib/mood-board-palette-set.ts']);
const THEME_COLOUR_READS = [
  RAW_THEME_COLOUR,
  // The whole palette off the registry, however it is spelled after.
  /INVITE_THEMES\[[^\]]*\]\??\.palette\b/,
  // Any theme-shaped object's palette into a variable / an expression (not a `palette:` key).
  /\b(?:theme|t|worn|seed|pal|own|tile|entry)\??\.palette\b(?!\s*:)/,
  // Destructured.
  /\{[^}]*\bpalette\b[^}]*\}\s*=\s*(?:INVITE_THEMES|theme\b|t\b|worn\b)/,
];
const SWEEP_ALLOWED_LINES: Record<string, Record<string, string>> = {
  'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx': {
    // The Colors panel's fallback — used only when `moodBoard` (the board, via `boardSiteColours`) is null: no palette.
    'return { theme, background: theme.palette.canvas, buttons: theme.palette.accent };': 'no-palette default of the Colors panel',
  },
  // ── Functions OF the theme they are handed. Every picture call site hands them
  //    the theme as the board dresses it (`dressedTheme` / `colours`) — asserted
  //    in "the measurers are handed the dressed theme" below.
  'lib/hub-theme-tokens.ts': { 'const p = theme.palette;': 'page tokens of the theme it is handed' },
  'lib/hub-legibility.ts': { 'const { palette } = theme;': 'legibility of the theme it is handed' },
  'lib/adaptive-theme.ts': {
    'const metal = oklchOfHex(theme.palette.accent);': 'tint of the theme it is handed',
    'const inks = [theme.palette.accentInk, theme.palette.lightInk, theme.palette.darkInk];': 'tint of the theme it is handed',
  },
  'lib/ombre.ts': { "'--color-ink-on-plate': hexChannels(theme.palette.ink),": 'ombré legibility of the theme it is handed' },
  'lib/hub-buttons.ts': {
    "?? (house ? HOUSE_PAPER : theme.palette.canvas);": 'buttons measured on the theme it is handed, when no layer painted a paper',
    "?? (house ? HOUSE_PLATE : theme.palette.surface);": 'buttons measured on the theme it is handed, when no layer painted a plate',
  },
  // The no-board answer, when a caller hands no dressed colours (the print set always does).
  'lib/print-pieces.ts': { "dressed: ThemeColours = { source: 'theme', colours: INVITE_THEMES[theme].palette },": 'no-board default' },
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
    walk(root).forEach((f) => {
      scanned += 1;
      const rel = relative(WEB, join(WEB, f));
      if (RESOLVER_FILES.has(rel)) return;
      const allowed = SWEEP_ALLOWED_LINES[rel] ?? {};
      read(f).split('\n').forEach((line, i) => {
        if (!THEME_COLOUR_READS.some((re) => re.test(line))) return;
        const anchor = Object.keys(allowed).find((a) => line.includes(a));
        if (anchor) used.add(`${rel}::${anchor}`);
        else offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    });
  }
  assert.ok(scanned > 100, `scanned only ${scanned} files — the sweep's roots moved`);
  assert.deepEqual(offenders, [], `theme colours read around lib/theme-colours.ts:\n${offenders.join('\n')}`);
  // Every exception still matches a line (a stale entry hides the next offender).
  for (const [f, anchors] of Object.entries(SWEEP_ALLOWED_LINES)) {
    for (const a of Object.keys(anchors)) assert.ok(used.has(`${f}::${a}`), `${f}: "${a}" no longer reads a theme colour — drop its exception`);
  }
});

test('the measurers are handed the dressed theme at every picture call site', () => {
  assert.match(read('app/[slug]/_lib/main-ground-layer.tsx'), /resolveAdaptiveTheme\(dressedTheme\(theme, event\.role_palette\), mainGround\.tint\)/);
  const panel = read('app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx');
  assert.match(panel, /const theme = useMemo\(\(\) => \(\{ \.\.\.INVITE_THEMES\[themeId\], palette: colours \}\), \[themeId, colours\]\);/);
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /colours=\{themeColours\(mainThemeId, \(drafted as \{ role_palette\?: unknown \}\)\.role_palette\)\.colours\}/);
  assert.match(read('lib/event-poster.server.ts'), /colours: themeColours\(theme, event\.role_palette\)\.colours,/);
  assert.match(read('lib/event-poster.ts'), /const theme = input\.colours \? \{ \.\.\.own, palette: input\.colours \} : own;/);
  assert.match(read('app/[slug]/_lib/theme-ground.ts'), /hubLegibility\(input\.colours \? \{ \.\.\.t, palette: input\.colours \} : t, \{ kind: 'theme' \}\)/);
  assert.match(read('app/[slug]/_components/host-draft-look.tsx'), /resolveThemeGround\(look\.theme, \{ ownColours: Boolean\(look\.vars\), colours: look\.colours \}\)/);
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /const dressed = dressedTheme\(hub\.theme, event\.role_palette\);/);
  assert.match(loaders, /ombreLook\(dressed, background\.ombre\)/);
  assert.match(loaders, /page: hubButtonPage\(dressed, painted\)/);
  // The Maker's Buttons panel (its one door) measures on the dressed theme too.
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /const theme = dressedTheme\(currentThemeId, \(drafted as \{ role_palette\?: unknown \}\)\.role_palette\);\s*const pageLook = guestLookFrom\(/);
  // (Event Details' Buttons door left 2026-10-08 — DECISION_LOG "EVENT DETAILS IS THREE SEGMENTS": the Buttons row went home to the Maker.)
  // …and a board does reach them: Cyber Neon dressed in maria's board is light.
  assert.equal(dressedTheme('cyber', MARIA).palette.canvas, '#c9a9a6');
  assert.equal(dressedTheme('cyber', null), INVITE_THEMES.cyber, 'no board: the registry entry itself');
});

test('every scope that sets the ornament gild also sets the WORDS gild — a nested scope never inherits a stale one', () => {
  const sets = (src: string) => [...src.matchAll(/'--color-gild':\s*([^,\n]+)/g)].length;
  const setsText = (src: string) => [...src.matchAll(/'--color-gild-text':\s*([^,\n]+)/g)].length;
  for (const f of ['lib/adaptive-theme.ts', 'lib/theme-colours.ts', 'lib/site-palette.ts']) {
    const src = read(f);
    assert.ok(sets(src) > 0, `${f} no longer sets --color-gild — this check went vacuous`);
    assert.equal(setsText(src), sets(src), `${f}: a scope sets --color-gild without --color-gild-text`);
  }
  const css = read('app/globals.css');
  const candle = css.slice(css.indexOf("[data-art='candlelight'] {"), css.indexOf('}', css.indexOf("[data-art='candlelight'] {")));
  assert.match(candle, /--color-gild:/);
  assert.match(candle, /--color-gild-text:/, 'Candlelight sets the ornament gild but not its words');
});

test('every theme in the one order has a seed nobody else shares', () => {
  const seen = new Set<string>();
  for (const t of HUB_THEMES) {
    const key = [...(themeSeedPalette(t.id).reception ?? [])].sort().join(',');
    assert.ok(!seen.has(key), `${t.id} seeds the same colours as another theme — a pick could not be told apart`);
    seen.add(key);
  }
});
