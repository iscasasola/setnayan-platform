/**
 * hub-font-shelves.test.ts — 🔤 ONE FONT DROPDOWN ACROSS THE EVENT HUB EDITOR.
 *
 * Owner, 2026-09-29, verbatim: *"the font across all event hub editor. can be
 * one style. A dropdown with the following: 5 recently used · 5 most used fonts
 * on the website · all the rest of the fonts. * all fonts that are being used
 * in the website must have and (actively used) label?"*
 *
 *   1. SHELVES — Recently used · Most used · All fonts, in that order; every
 *      face exactly once, whatever the couple has picked (property, 400 runs).
 *   2. RECENT — the shelf is the last five DISTINCT picks, newest first
 *      (property: `pushRecentHubFont` against a model of the pick history).
 *   3. IN USE — `hubFontsInUse` over a canvas names exactly the faces the
 *      renderer sets on it (`hubElementDeclarations` / `hubRunDeclarations` /
 *      `hubFontVars`), and the dropdown marks exactly those (property).
 *   4. THE WIRING — the page computes "In use" from the canvases it hands the
 *      canvas, the work area registers it, the dropdown reads it.
 *   5. THE SWEEP — no file in the editor offers a list of faces except the one
 *      dropdown (`font-pick.tsx`): the PROPERTY "names the face catalogue or
 *      draws a face preview", not a phrasing. Each picker mounts `<FontPick`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_FONT_KEYS, HUB_FONTS, HUB_FONTS_MOST_USED, hubFontVars, type HubFontKey } from './hub-fonts';
import {
  HUB_FONT_IN_USE,
  HUB_FONT_LEAD,
  HUB_FONT_RECENT_MAX,
  HUB_FONT_SHELVES,
  hubFontPickOptions,
  hubFontShelves,
  hubFontsInUse,
  pushRecentHubFont,
  sanitizeRecentHubFonts,
} from './hub-font-shelves';
import { hubElementDeclarations, hubRunDeclarations, type HubElementStyles } from './element-style';
import { INVITE_THEMES } from './invite-themes';

const WEB = join(__dirname, '..');

/** A seeded generator, so a failure replays. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const someKeys = (r: () => number, max: number): HubFontKey[] =>
  Array.from({ length: Math.floor(r() * (max + 1)) }, () => pick(r, HUB_FONT_KEYS));

test('1 · shelves: Recently used · Most used · All fonts — in order, every face exactly once', () => {
  const r = rng(20260929);
  for (let run = 0; run < 400; run++) {
    const recent = sanitizeRecentHubFonts(someKeys(r, 8));
    const inUse = someKeys(r, 10);
    const rows = hubFontShelves({ recent, inUse });
    assert.equal(rows.length, HUB_FONTS.length, 'every face appears');
    assert.equal(new Set(rows.map((f) => f.key)).size, rows.length, 'no face appears twice');
    const order = rows.map((f) => HUB_FONT_SHELVES.indexOf(f.shelf));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), 'shelves never interleave, and come in the stated order');
    const on = (s: string) => rows.filter((f) => f.shelf === s).map((f) => f.key);
    assert.deepEqual(on('Recently used'), recent, 'the recent shelf is the recent list, exactly');
    assert.deepEqual(on('Most used'), HUB_FONTS_MOST_USED.filter((k) => !recent.includes(k)), 'the measured five, less any shown above');
    assert.ok(on('Recently used').length <= HUB_FONT_RECENT_MAX);
  }
  // Nothing picked yet: the measured five lead (`mostUsedHubFontKeys`, pinned by hub-fonts-most-used.test.ts).
  assert.deepEqual(hubFontShelves().slice(0, 5).map((f) => f.key), [...HUB_FONTS_MOST_USED]);
});

test('2 · recent = the last five DISTINCT picks, newest first', () => {
  assert.equal(HUB_FONT_RECENT_MAX, 5, 'the owner asked for 5 recently used');
  const r = rng(5);
  for (let run = 0; run < 300; run++) {
    const history = someKeys(r, 20);
    let recent: HubFontKey[] = [];
    for (const k of history) recent = pushRecentHubFont(recent, k);
    // The model: walk the history backwards, keep first sightings, stop at five.
    const model: HubFontKey[] = [];
    // FIVE is the owner's number ("5 recently used") — written here, not read from the code under test.
    for (const k of [...history].reverse()) if (!model.includes(k) && model.length < 5) model.push(k);
    assert.deepEqual(recent, model, `history ${JSON.stringify(history)}`);
    // What is kept on the device reads back the same.
    assert.deepEqual(sanitizeRecentHubFonts(JSON.parse(JSON.stringify(recent))), recent);
  }
  // A stored value this product did not write is dropped, never repaired.
  assert.deepEqual(sanitizeRecentHubFonts(['Cinzel', 'cinzel', 'cinzel', 7, null, 'jost']), ['cinzel', 'jost']);
  assert.deepEqual(sanitizeRecentHubFonts('cinzel'), []);
});

/** The faces a renderer's declarations set, read back through each face's CSS variable. */
function renderedFaces(decls: Array<[string, string]>): HubFontKey[] {
  return decls
    .filter(([p]) => p === 'font-family' || p === '--pahina-face')
    .flatMap(([, v]) => HUB_FONTS.filter((f) => v.startsWith(`var(${f.cssVar})`)).map((f) => f.key));
}

test('3 · "In use" names exactly what the renderer sets — and the dropdown marks exactly those', () => {
  const r = rng(77);
  const parts = ['names', 'eyebrow', 'label', 'heading', 'body'] as const;
  for (let run = 0; run < 300; run++) {
    const canvases: Record<string, { elements: HubElementStyles }> = {};
    for (const scene of ['hero', 'story', 'venue']) {
      const elements: HubElementStyles = {};
      for (const p of parts) {
        if (r() < 0.4) continue;
        const style: NonNullable<HubElementStyles[typeof p]> = {};
        if (r() < 0.6) style.font = pick(r, HUB_FONT_KEYS);
        if (r() < 0.4) style.runs = someKeys(r, 3).map((font, i) => ({ start: i * 2, end: i * 2 + 1, ...(r() < 0.7 ? { font } : {}) }));
        elements[p] = style;
      }
      canvases[scene] = { elements };
    }
    const site = r() < 0.5 ? pick(r, HUB_FONT_KEYS) : null;
    const rendered = new Set<HubFontKey>();
    for (const c of Object.values(canvases)) {
      for (const st of Object.values(c.elements)) {
        for (const k of renderedFaces(hubElementDeclarations(st))) rendered.add(k);
        for (const run of st?.runs ?? []) for (const k of renderedFaces(hubRunDeclarations(run))) rendered.add(k);
      }
    }
    for (const k of renderedFaces(Object.entries(hubFontVars(site)))) rendered.add(k);
    const inUse = hubFontsInUse({ canvases, siteFontKey: site });
    assert.deepEqual(new Set(inUse), rendered, 'In use = what the renderer sets');
    const marked = hubFontPickOptions({ inUse }).filter((o) => o.trail?.text === HUB_FONT_IN_USE).map((o) => o.key);
    assert.deepEqual(new Set(marked), rendered, 'the dropdown marks exactly those');
  }
  // The theme's faces count; the couple's own typeface REPLACES the theme's heading (`--pahina-face`).
  const velvet = INVITE_THEMES.velvet.fonts;
  const key = (fam: string | null) => HUB_FONTS.find((f) => f.family === fam)?.key;
  const own = hubFontsInUse({ themeFaces: velvet });
  assert.ok(own.includes(key(velvet.heading)!), 'the theme heading, while no typeface is chosen');
  const chosen = hubFontsInUse({ themeFaces: velvet, siteFontKey: 'poppins' });
  assert.ok(chosen.includes('poppins'));
  assert.ok(!chosen.includes(key(velvet.heading)!) || [velvet.body, velvet.labels, velvet.script].includes(velvet.heading));
  assert.deepEqual(hubFontsInUse({ logoFonts: ['cinzel', 'nope'] }), ['cinzel'], 'the logo’s text layers count; a stranger does not');
  // The lead option is first and plain.
  assert.deepEqual(hubFontPickOptions({ lead: 'Event Hub font' })[0], { key: HUB_FONT_LEAD, label: 'Event Hub font' });
});

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('4 · the wiring: the page computes In use from the canvas’s own data; the work area registers it; the dropdown reads it', () => {
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  const call = /fontsInUse: hubFontsInUse\(\{[\s\S]*?logoFonts:[^\n]*/.exec(page)?.[0] ?? '';
  assert.ok(call, 'the page computes fontsInUse with hubFontsInUse');
  assert.match(call, /canvases: elementCanvases/, 'from the SAME canvases the canvas is handed');
  assert.match(page, /canvases: elementCanvases,/, 'which are the ones per-element editing edits');
  assert.match(page, /const elementCanvases = \{\s*\.\.\.Object\.fromEntries\(allWidgets\.map/, 'drafted over live (allWidgets)');
  assert.match(page, /const elementCanvases = \{[\s\S]*?postEventElementScope\(key\)[\s\S]*?\n  \};/, 'and Post Event’s scenes, so a part styled there is In use too');
  assert.match(call, /siteFontKey: \(drafted as/, 'the typeface, drafted over live');
  assert.match(call, /INVITE_THEMES\[currentThemeId/, 'the theme being edited');
  assert.match(call, /logoFonts: await readMakerLogoFonts\(eventId\)/, 'the logo’s layers');
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /fontsInUse: elementEditing\?\.fontsInUse \?\? \[\]/, 'the work area registers it for the whole Maker');
  const pickSrc = read('app/dashboard/[eventId]/website/editor/_components/font-pick.tsx');
  assert.match(pickSrc, /inUse: maker\?\.lookPages\?\.fontsInUse/, 'and the dropdown reads what was registered');
  assert.match(pickSrc, /hubFontPickOptions\(/, 'through the one option list');
});

/** Every source file of the Event Hub editor (the Maker's two trees). */
function editorFiles(): string[] {
  const roots = ['app/dashboard/[eventId]/launch', 'app/dashboard/[eventId]/website'];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(relative(WEB, p));
    }
  };
  for (const r of roots) walk(join(WEB, r));
  return out;
}

/**
 * THE PROPERTY: offering faces. A file offers faces when it names the face
 * catalogue (any list of hub faces, or the shelves), draws a face preview for a
 * choice, or posts the couple's typeface field itself.
 */
const OFFERS_FACES = [
  /\bHUB_FONTS\b/,
  /\bHUB_FONT_KEYS\b/,
  /\bHUB_FONTS_MOST_USED\b/,
  /\bHUB_FONT_GROUPS\b/,
  /\bmostUsedHubFontKeys\b/,
  /\bhubFontShelves\b/,
  /\bhubFontPickOptions\b/,
  /\bhubFontPreviewStack\b/,
  /name=["']site_font_key["']/,
];
const THE_ONE = 'app/dashboard/[eventId]/website/editor/_components/font-pick.tsx';

function sweepFontPickers(files: readonly string[], src: (f: string) => string): string[] {
  const offenders: string[] = [];
  for (const f of files) {
    if (f === THE_ONE) continue;
    let s = src(f);
    // The Colours row posts the typeface THROUGH the dropdown's `name` prop — that is the one dropdown, not a second list.
    s = s.replace(/<FontPick\b[\s\S]*?\/>/g, '');
    for (const re of OFFERS_FACES) if (re.test(s)) offenders.push(`${f} · ${re.source}`);
  }
  return offenders;
}

test('5 · the sweep: only the one dropdown offers faces; every font picker mounts it', () => {
  const files = editorFiles();
  assert.ok(files.length > 100, `the sweep reads the editor (${files.length} files)`);
  // The tap-to-type bar's Style ▾ hands over to the part's own sheet (its Font row is the one dropdown) — it is swept, never a list of its own.
  assert.ok(files.includes('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx'), 'the type bar is swept');
  assert.deepEqual(sweepFontPickers(files, read), [], 'a second font list in the editor — use <FontPick>');
  // The pickers, each anchored by file, with its count printed.
  const mounts = files
    .map((f) => [f, (read(f).match(/<FontPick\b/g) ?? []).length] as const)
    .filter(([, n]) => n > 0);
  console.log(`# FontPick mounts: ${mounts.map(([f, n]) => `${f.split('/').pop()}×${n}`).join(' · ')}`);
  const at = Object.fromEntries(mounts.map(([f, n]) => [f.split('/').pop()!, n]));
  assert.equal(at['part-inspector.tsx'], 1, 'a part’s Font row (scene parts, hero parts, a letter run)');
  assert.equal(at['maker-logo.tsx'], 1, 'the Logo text layer’s Typeface');
  assert.equal(at['pro-panels.tsx'], 1, 'the Colours row’s Typeface (site_font_key)');
  // The sweep can hit: a second list planted in a real file is caught.
  const planted = sweepFontPickers(['x.tsx'], () => "options={HUB_FONTS.map((f) => ({ key: f.key, fontFamily: hubFontPreviewStack(f.key) }))}");
  assert.ok(planted.length >= 2, 'the sweep catches a planted list');
});
