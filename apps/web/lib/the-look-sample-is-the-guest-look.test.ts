/**
 * the-look-sample-is-the-guest-look.test.ts — STUDIO › LOOK'S SAMPLE SCREEN WEARS
 * THE GUEST PAGE'S OWN LOOK, MOUNTS NO PAGE FRAME, AND ANSWERS AT THE TAP.
 *
 * Owner, 2026-10-08 (DECISION_LOG "THE LOOK PREVIEW IS A SAMPLE OF WHAT IS BEING
 * EDITED — NOT THE COVER PAGE"): *"our preview should not be this. but a sample
 * of the header text, buttons on the actual screen"* · *"this should be a
 * preview of whatever we edit here."* Contract:
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.D and § 4 (the watches).
 *
 * The sample is drawn in the browser, with no guest-page render. That is honest
 * only while these hold — each EXECUTED where it can be:
 *
 *   (1) THE SAME LOOK. `lookSampleScope` returns what the guest page's own
 *       `guestLookFrom` returns, value for value. The guest function is RUN here
 *       (its own source, from `app/[slug]/_lib/loaders.ts`) beside the sample's,
 *       over themes × boards × backgrounds × buttons × faces × Candlelight. A
 *       layer added to one and not the other fails on the first look it changes.
 *   (2) THE SAME VEIL. Over a picture the sample lays the page's paper at the
 *       strength the page's rule measures; a Shade lays the page's own veil and
 *       flips the words exactly as `mainGroundLayerFor` does.
 *   (3) THE REAL BUTTONS. The sample's two buttons are the guest page's classes;
 *       the paint the dashboard takes from them is handed back in the SAME
 *       tokens the base rules name, before the host's Buttons rules.
 *   (4) NO PAGE FRAME. Studio › Look draws the sample and mounts no
 *       `MakerPageFrame`; the sample itself holds no frame, asks for nothing and
 *       starts no timer. (The Hero and the Reveal keep their page.)
 *   (5) AT THE TAP. Each Look control tells the sample what it drew; the store
 *       lays a pick over the server's values until the server shows the same or
 *       something newer, and a refusal puts the old value back.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import ts from 'typescript';

import { stripComments } from './strip-comments';
import { adaptiveThemeVars, pagePaperAndInk, resolveAdaptiveTheme } from './adaptive-theme';
import { hubButtonPage, resolveHubButtons } from './hub-buttons';
import { compositeOver } from './hub-legibility';
import type { HubMainGround } from './hub-canvas';
import { INVITE_THEMES, INVITE_THEME_IDS, type InviteThemeId } from './invite-themes';
import { lookSampleGround, lookSampleScope, lookSampleTint, type LookSampleRow } from './look-sample';
import { createLookSampleStore } from './look-sample-store';
import { mainGroundShade, shadeWordVars } from './main-ground-shade';
import { ombreLook, ombreRamp, parseSiteBackground } from './ombre';
import { dressedTheme, paletteColourVars } from './theme-colours';
import { pageWordBase, pinPlateInk, pinWordInks, proSiteVarsFor } from '../app/[slug]/_lib/pro-site-vars';

(globalThis as unknown as { React: unknown }).React = React;

/* The sample draws the panel's own picture pieces, and the panel reaches the draft action, which is server-only — stood in for, as the other render guards do. */
{
  const Mod = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';

/* ── the sweep ───────────────────────────────────────────────────────────── */

const ROSE_BOARD = { reception: ['#525252', '#C5A059', '#373B31', '#C9A9A6', '#E8D9BD'] };
const PINK_BOARD = { reception: ['#C97B4B', '#CEA7AE', '#FAF7F2'], ceremony: ['#D3AE93'] };
const BOARDS: Record<string, unknown> = { 'no board': null, 'a rose board': ROSE_BOARD, 'a light board': PINK_BOARD };
const BACKGROUNDS: readonly (string | null)[] = [null, '#ffffff', '#d9c7a8', '#1a1410', 'ombre:glow:#f3e2d8', 'ombre:dawn:#1e2229', 'ombre:diagonal:#8fa58a', 'ombre:diagonal:#f6f1e7:#c5a059', 'ombre:dawn:#1a1410:#c9a9a6'];
const BUTTONS: readonly { style: string | null; colour: string | null }[] = [
  { style: null, colour: null },
  { style: 'pill-theme', colour: null },
  { style: 'square-solid', colour: '#5b4a6b' },
  { style: 'rounded-outline', colour: '#c24e25' },
  { style: 'theme-theme', colour: '#f3dde3' },
];
const FACES: readonly (string | null)[] = [null, 'playfair'];
const ARTS: readonly ('candlelight' | null)[] = [null, 'candlelight'];

function everyRow(fn: (where: string, themeId: InviteThemeId, row: LookSampleRow) => void): number {
  let n = 0;
  for (const themeId of INVITE_THEME_IDS) {
    for (const [boardName, role_palette] of Object.entries(BOARDS)) {
      for (const site_bg_color of BACKGROUNDS) {
        for (const b of BUTTONS) {
          for (const site_font_key of FACES) {
            for (const site_art_direction of ARTS) {
              n++;
              fn(`${themeId} · ${boardName} · bg ${site_bg_color} · ${b.style}/${b.colour} · face ${site_font_key} · ${site_art_direction ?? 'daylight'}`, themeId, {
                role_palette,
                site_bg_color,
                site_button_color: b.colour,
                site_button_style: b.style,
                site_font_key,
                site_art_direction,
              });
            }
          }
        }
      }
    }
  }
  return n;
}

/**
 * THE GUEST PAGE'S OWN FUNCTION, RUN. `loaders.ts` cannot be imported here (it
 * is the guest route's request-scoped file: the admin client, `after`), so its
 * `guestLookFrom` is lifted out as SOURCE, its types stripped by the compiler,
 * and called with the very functions it imports. Whatever it does, this does.
 */
function guestLookFromSource(): (event: unknown, hub: { theme: InviteThemeId; accent: string; monogram: string }, proActive: boolean) => Record<string, unknown> {
  const loaders = raw('app/[slug]/_lib/loaders.ts');
  const start = loaders.indexOf('export function guestLookFrom(');
  assert.ok(start > 0, 'guestLookFrom is no longer in app/[slug]/_lib/loaders.ts — re-aim this guard at where the guest look is composed');
  const end = loaders.indexOf('\n}\n', start);
  const source = loaders.slice(start, end + 2).replace('export function', 'function');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const deps = { paletteColourVars, proSiteVarsFor, parseSiteBackground, dressedTheme, ombreLook, ombreRamp, compositeOver, pinWordInks, pageWordBase, pinPlateInk, resolveHubButtons, hubButtonPage };
  /* A name the guest function uses and this list lacks is a ReferenceError — a new layer the sample must learn too. */
  return new Function(...Object.keys(deps), `${js}\nreturn guestLookFrom;`)(...Object.values(deps));
}

test('(1) the sample wears the guest page’s own look — guestLookFrom is run beside lookSampleScope, value for value', () => {
  const guestLookFrom = guestLookFromSource();
  const failures: string[] = [];
  let painted = 0;
  let blended = 0;
  let buttoned = 0;
  const looks = everyRow((where, themeId, row) => {
    const guest = guestLookFrom(row, { theme: themeId, accent: '#000000', monogram: '' }, true);
    const sample = lookSampleScope(row, themeId);
    if (sample.vars) painted++;
    if (sample.ombre) blended++;
    if (sample.buttons) buttoned++;
    for (const key of ['theme', 'art', 'vars', 'ombre', 'buttons'] as const) {
      try {
        assert.deepEqual(sample[key], guest[key]);
      } catch {
        if (failures.length < 8) failures.push(`${where} · ${key}: sample ${JSON.stringify(sample[key])?.slice(0, 160)} ≠ guest ${JSON.stringify(guest[key])?.slice(0, 160)}`);
      }
    }
  });
  assert.equal(looks, INVITE_THEME_IDS.length * 3 * BACKGROUNDS.length * BUTTONS.length * FACES.length * ARTS.length);
  assert.ok(looks >= 4000, `only ${looks} looks were compared`);
  /* The sweep must really move each layer — an empty look agrees with anything. */
  assert.ok(painted >= looks * 0.6 && blended >= looks * 0.3 && buttoned >= looks * 0.6, `the sweep is too plain (painted ${painted} · blended ${blended} · buttoned ${buttoned} of ${looks})`);
  assert.deepEqual(failures, [], `the sample screen and the guest page disagree:\n  ${failures.join('\n  ')}`);
});

/* ── (2) the veil over a picture ─────────────────────────────────────────── */

const FRAME = ['#f4efe6', '#3a2f28', '#8a6f52'];
const photo = (extra: Record<string, unknown> = {}): HubMainGround => ({ kind: 'photo', media: 'r2://m/a.jpg', tint: { match: true, frame: FRAME }, ...extra }) as HubMainGround;

test('(2) over a picture the sample lays the page’s own veil — the paper its rule measures, and a Shade’s veil with its flipped words', () => {
  let measured = 0;
  for (const themeId of INVITE_THEME_IDS) {
    for (const role_palette of Object.values(BOARDS)) {
      const row = { role_palette, site_button_color: null };
      const dressed = dressedTheme(themeId, role_palette);
      const adaptive = resolveAdaptiveTheme(dressed, { match: true, frame: FRAME });
      const page = pagePaperAndInk(dressed);
      // As is: the paper veil, the picture's tint, no flip.
      const asIs = lookSampleGround(photo(), row, themeId);
      assert.equal(asIs.scrim, adaptive.scrim, `${themeId}: the sample's paper veil is not the page's`);
      assert.equal(asIs.veil, null);
      assert.deepEqual(asIs.vars, adaptiveThemeVars(adaptive, { ownButton: false }));
      for (const step of ['darker', 'dark', 'light', 'lighter'] as const) {
        measured++;
        const shade = mainGroundShade(step, page, FRAME);
        const g = lookSampleGround(photo({ shade: step }), row, themeId);
        assert.deepEqual(g.veil, { color: shade.veil, opacity: shade.opacity }, `${themeId} · ${step}: the sample's veil is not the page's`);
        const flip = shadeWordVars(shade, page);
        for (const [token, value] of Object.entries(flip)) assert.equal(g.vars[token], value, `${themeId} · ${step}: ${token} did not flip`);
        // An ink veil flips the words; a paper veil flips none — for every dark step and for no light one.
        assert.equal(Boolean(g.vars['--color-cream']) && g.vars['--color-cream'] === flip['--color-cream'], step === 'dark' || step === 'darker' ? true : Boolean(flip['--color-cream']));
        if (step === 'light' || step === 'lighter') assert.deepEqual(flip, {}, `${themeId} · ${step}: a paper veil flipped the words`);
      }
      // The couple's own button colour is left alone by a picture's tint.
      const own = lookSampleGround(photo(), { role_palette, site_button_color: '#5b4a6b' }, themeId);
      assert.equal(own.vars['--color-mulberry'], undefined, `${themeId}: a tint repainted the couple's own button colour`);
    }
  }
  assert.ok(measured >= 100, `only ${measured} shades were measured`);
  // No picture, nothing to veil: a colour, a pattern, "just the colour".
  for (const main of [{ ground: 'none' }, { ground: 'pattern', pattern: 'dots' }] as HubMainGround[]) {
    assert.deepEqual(lookSampleGround(main, { role_palette: null, site_button_color: null }, 'velvet'), { scrim: null, veil: null, vars: {} });
  }
  // A loop of ours is measured over its own two colours and never tints.
  const loop = lookSampleTint({ ground: 'loop', loop: 'velvet' }, 'house', true);
  assert.deepEqual(loop, { match: false, frame: [INVITE_THEMES.velvet.media!.samples.light, INVITE_THEMES.velvet.media!.samples.dark] });
  assert.deepEqual(lookSampleGround({ ground: 'loop', loop: 'velvet' }, { role_palette: null, site_button_color: null }, 'house').vars, {});
  // Nothing stored = the theme's own loop; Classic has none.
  assert.ok(lookSampleTint(null, 'velvet', false));
  assert.equal(lookSampleTint(null, 'house', false), null);
  // A follow whose photo is gone is not on the page: the theme's ground is measured, never the old photo's frame.
  const stale = { follow: 'hero', of: 'r2://m/old.jpg', tint: { match: true, frame: ['#ff0000'] } } as HubMainGround;
  assert.deepEqual(lookSampleTint(stale, 'house', false), null);
  assert.deepEqual(lookSampleTint(stale, 'house', true), { match: true, frame: ['#ff0000'] });
  // A picture whose colours are still being read wears no veil yet (nothing is measured) — never a guessed one.
  assert.deepEqual(lookSampleGround(photo({ tint: { match: true, frame: [] } }), { role_palette: null, site_button_color: null }, 'velvet'), { scrim: null, veil: null, vars: {} });
});

/* ── (3) the real buttons ────────────────────────────────────────────────── */

test('(3) the sample’s buttons are the guest page’s classes, in the guest page’s own paint, under the host’s Buttons rules', async () => {
  const sample = read(`${L}/look-sample.tsx`);
  assert.match(sample, /data-look-sample-button="primary" className="button-primary\b/);
  assert.match(sample, /data-look-sample-button="secondary" className="button-secondary\b/);
  // The primary's words are the guest page's own.
  assert.match(sample, /\{LANDING_WORDS\.reply\}/);
  // No second button style: nothing in the sample paints a button itself.
  assert.doesNotMatch(sample, /--hub-btn-(?:fill|label|radius)/, 'the sample paints a button of its own');
  // The scope's marks — the guest scope's own.
  for (const mark of ['sn-editorial', 'data-hub-theme={', 'data-art={', 'data-hub-btn-shape={', 'data-hub-btn-paint={']) {
    assert.ok(sample.includes(mark), `the sample scope does not wear ${mark}`);
  }

  const css = raw('app/globals.css');
  const base = (cls: string) => css.match(new RegExp(`\\n  \\.${cls} \\{\\s*@apply ([^;]+);`))?.[1] ?? '';
  const rule = (sel: string) => css.match(new RegExp(`\\n${sel.replace(/[.[\]]/g, '\\$&')} \\{([^}]+)\\}`))?.[1] ?? '';
  // What the base rules name…
  assert.match(base('button-primary'), /\bbg-mulberry\b/);
  assert.match(base('button-primary'), /\btext-cream\b/);
  assert.match(base('button-secondary'), /\bborder-link\/30\b/);
  assert.match(base('button-secondary'), /\bbg-cream\b/);
  assert.match(base('button-secondary'), /\btext-link\b/);
  // …is what the sample hands back, token for token.
  const primary = rule('[data-look-sample] .button-primary');
  assert.match(primary, /background: rgb\(var\(--color-mulberry\)\);/);
  assert.match(primary, /color: rgb\(var\(--color-cream\)\);/);
  const secondary = rule('[data-look-sample] .button-secondary');
  assert.match(secondary, /background: rgb\(var\(--color-cream\)\);/);
  assert.match(secondary, /color: rgb\(var\(--color-link\)\);/);
  assert.match(secondary, /border: 1px solid rgb\(var\(--color-link\) \/ 0\.3\);/);
  // BEFORE the host's Buttons rules (same weight — the later one wins), and outside every layer.
  const mine = css.indexOf('\n[data-look-sample] .button-primary {');
  const hosts = css.indexOf('\n[data-hub-btn-shape] .button-primary,');
  assert.ok(mine > 0 && hosts > mine, 'the sample’s paint must come before the host’s Buttons rules');
  const dashboards = css.indexOf('.app-surface .button-primary {');
  const layer = css.lastIndexOf('@layer components {', dashboards);
  assert.ok(layer > hosts, 'the dashboard’s re-point is expected in a later @layer components block — an unlayered sample rule beats it');
});

/* ── (4) no page frame ───────────────────────────────────────────────────── */

async function paintLookBody(value: Record<string, unknown>, item: string) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { DetailsLookBody } = await import(`../${L}/details-look-pages`);
  return renderToStaticMarkup(React.createElement(MakerContext.Provider, { value }, React.createElement(DetailsLookBody, { item })));
}

const pagesWith = (sample: unknown) => ({
  logo: null,
  hero: null,
  reveal: null,
  revealOptions: null,
  heroParts: null,
  revealStages: [],
  publicLandingUrl: '/maria-and-jose',
  look: { background: null, font: null, colours: null, palette: null, sample },
});
const makerWith = (extra: Record<string, unknown>) => ({
  eventId: 'ev-1',
  stage: 'rsvp',
  device: 'phone',
  renderStamp: '1',
  selection: { kind: 'tool', key: 'details' },
  detailsItem: 'background',
  ...extra,
});

test('(4) Studio › Look draws the sample screen and mounts no page frame — the Hero, the Reveal and the shipped Maker keep theirs', async () => {
  const { lookShowsSample } = await import(`../${L}/details-look-pages`);
  assert.equal(lookShowsSample('look', true), true);
  assert.equal(lookShowsSample('look', false), false, 'the shipped Maker lost its page');
  assert.equal(lookShowsSample('hero', true), false, 'the Hero IS the page');
  assert.equal(lookShowsSample('reveal', true), false);

  const stub = React.createElement('div', { 'data-stub': 'the-sample' });
  const studio = await paintLookBody(makerWith({ stagesStudio: true, lookPages: pagesWith(stub) }), 'look');
  assert.match(studio, /data-details-look-sample=""/);
  assert.match(studio, /data-stub="the-sample"/);
  assert.equal((studio.match(/<iframe/g) ?? []).length, 0, 'Studio › Look mounted a guest-page frame');
  assert.doesNotMatch(studio, /data-maker-page-frame/);
  // A sample that never arrived SAYS so — never an empty column, and never the page frame as a quiet fallback.
  const missing = await paintLookBody(makerWith({ stagesStudio: true, lookPages: pagesWith(null) }), 'look');
  assert.match(missing, /data-details-look-failed="look"/);
  assert.equal((missing.match(/<iframe/g) ?? []).length, 0);
  // The shipped Maker: the page, as before.
  const shipped = await paintLookBody(makerWith({ stagesStudio: false, lookPages: pagesWith(stub) }), 'look');
  assert.doesNotMatch(shipped, /data-details-look-sample/);
  assert.ok((shipped.match(/<iframe/g) ?? []).length >= 1, 'the shipped Maker’s Look lost its page frame');
  // The Hero in the Studio is still the page.
  const hero = await paintLookBody(makerWith({ stagesStudio: true, lookPages: pagesWith(stub) }), 'hero');
  assert.ok((hero.match(/<iframe/g) ?? []).length >= 1, 'the Hero lost its page frame');

  // The sample itself: no frame, no request, no timer, no render asked.
  const sample = read(`${L}/look-sample.tsx`);
  for (const [what, re] of [
    ['a frame', /<iframe|MakerPageFrame|BufferedCanvasFrame/],
    ['a request', /\bfetch\(|createClient|supabase|use server/],
    ['a timer', /setInterval|setTimeout|requestAnimationFrame/],
    ['a render', /router\.refresh|useRouter|requestMakerRefresh|requestCanvasRedraw|makerSave|makerRedrawSave/],
    ['a message to a canvas', /postMessage/],
  ] as const) {
    assert.doesNotMatch(sample, re, `the sample screen holds ${what}`);
  }
  const store = read('lib/look-sample-store.ts');
  assert.doesNotMatch(store, /setInterval|setTimeout|fetch\(|postMessage/, 'the sample’s store asks or waits for something');
  // It rides the Look chunk — never the Maker's first load.
  assert.match(raw(`${L}/details-lazy.tsx`), /export const LookSample = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/look-sample'\)/);
  for (const first of [`${E}/editor-shell.tsx`, `${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`]) {
    assert.doesNotMatch(read(first), /from '[^']*look-sample(?:-store)?'/, `${first} (first load) imports the sample screen`);
  }
  // The page builds it from reads it already made: the seed names no new query.
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  const seed = page.slice(page.indexOf("'look-sample': ("), page.indexOf('/>', page.indexOf("'look-sample': (")));
  assert.ok(seed.length > 200, 'the editor page no longer builds the sample screen');
  assert.doesNotMatch(seed, /await |\.from\(|displayUrlForStoredAsset|publicUrlForStoredAsset/, 'the sample’s seed reads or signs something of its own');
  // The theme's faces come as class names from the server — the sample's own chunk loads no font file.
  assert.match(seed, /fontClassName: siteSkin\(mainThemeId, \{ accent: '#000000' \}\)\?\.className \?\? ''/);
  assert.doesNotMatch(sample, /site-skin|next\/font/, 'the sample screen loads fonts of its own');
  // …and the work area hands it to Look.
  assert.match(read(`${E}/editor-shell.tsx`), /sample: madeOnce\?\.\['look-sample'\] \?\? null/);
});

test('(4b) the sample screen renders the header text, the two real buttons and the picture — from the seed alone', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { LookSample, splitNames } = await import(`../${L}/look-sample`);
  const seed = {
    eventId: 'ev-render',
    themeId: 'house' as InviteThemeId,
    fontClassName: '',
    row: { role_palette: ROSE_BOARD, site_bg_color: '#f6f1e7', site_button_color: null, site_button_style: 'pill-theme', site_font_key: 'playfair', site_art_direction: null } as LookSampleRow,
    main: { ground: 'loop', loop: 'velvet' } as HubMainGround,
    coverRef: null,
    sources: { loops: [{ id: 'velvet', stillUrl: 'https://media.example/velvet.jpg', loopUrl: 'https://media.example/velvet.mp4' }], photoChoices: [], videoChoice: null, sceneUploads: [], cover: null, themeId: 'house' },
    words: { names: 'Maria & Jose', date: 'December 12, 2026', line: 'Seda Vertis North' },
    musicOn: true,
  };
  const paint = (s: typeof seed, detailsItem = 'background') =>
    renderToStaticMarkup(React.createElement(MakerContext.Provider, { value: { detailsItem } as never }, React.createElement(LookSample, { seed: s })));
  const html = paint(seed);
  assert.match(html, /data-look-sample=""/);
  assert.match(html, /data-look-sample-ground="film"/);
  assert.match(html, /Together with their families/);
  assert.match(html, /Maria <em[^>]*>&amp;<\/em> Jose/);
  assert.match(html, /December 12, 2026/);
  assert.match(html, /Seda Vertis North/);
  assert.match(html, /class="button-primary[^"]*"[^>]*>Reply to the invitation</);
  assert.match(html, /class="button-secondary[^"]*"[^>]*>Details</);
  // The shape is worn as the guest scope wears it, and the Headings face is the couple's.
  assert.match(html, /data-hub-btn-shape="pill"/);
  assert.match(html, /--hub-btn-radius:/);
  assert.match(html, /--pahina-face:var\(--font-playfair\)/);
  // The film's still, then the film — and the page's paper veil over it.
  assert.match(html, /https:\/\/media\.example\/velvet\.jpg/);
  assert.match(html, /data-look-sample-veil="paper"/);
  assert.equal((html.match(/<iframe/g) ?? []).length, 0);
  // The speaker is on the sample only while Music is the tab open (and music is on).
  assert.doesNotMatch(html, /data-look-sample-speaker/);
  assert.match(paint(seed, 'music'), /data-look-sample-speaker/);
  assert.doesNotMatch(paint({ ...seed, eventId: 'ev-quiet', musicOn: false }, 'music'), /data-look-sample-speaker/);
  // A colour: the paper alone; a blend: the ombré's own CSS; Candlelight: the scope's own attribute.
  const colour = paint({ ...seed, eventId: 'ev-colour', main: { ground: 'none' } as HubMainGround });
  assert.match(colour, /data-look-sample-ground="colour"/);
  assert.doesNotMatch(colour, /velvet\.jpg/);
  const blend = paint({ ...seed, eventId: 'ev-blend', main: { ground: 'none' } as HubMainGround, row: { ...seed.row, site_bg_color: 'ombre:dawn:#f6f1e7', site_art_direction: 'candlelight' as const } });
  assert.match(blend, /data-look-sample-ground="blend"/);
  assert.match(blend, /data-look-sample-ombre=""/);
  assert.match(blend, /data-art="candlelight"/);
  // A stored pattern still shows, in the page's ink.
  assert.match(paint({ ...seed, eventId: 'ev-pattern', main: { ground: 'pattern', pattern: 'dots' } as HubMainGround }), /data-look-sample-pattern=""/);
  // Names: two around the "&", one whole, none = a placeholder — never an empty header.
  assert.deepEqual(splitNames('Maria & Jose'), ['Maria', 'Jose']);
  assert.deepEqual(splitNames('Maria and Jose'), ['Maria', 'Jose']);
  assert.deepEqual(splitNames('Lola Remedios at 80'), ['Lola Remedios at 80', null]);
  assert.deepEqual(splitNames(null), ['Your names', null]);
});

/* ── (5) at the tap ──────────────────────────────────────────────────────── */

test('(5) a pick is laid over the server’s values at once — until the server shows the same, or something newer; a refusal goes back', () => {
  const s = createLookSampleStore();
  const server = { bg: '#ffffff' as string | null, fontKey: null as string | null };
  let heard = 0;
  const off = s.subscribe(() => heard++);
  assert.deepEqual(s.read('ev', server), server, 'nothing told: the server’s values, the same object');
  assert.equal(s.read('ev', server), server);

  s.tell('ev', { bg: '#1a1410' });
  assert.equal(heard, 1, 'a tell did not notify the sample');
  assert.equal(s.read('ev', server).bg, '#1a1410', 'the pick is not on the sample at the tap');
  assert.equal(s.read('ev', server).fontKey, null, 'a value nobody picked moved');
  assert.equal(s.read('other', server).bg, '#ffffff', 'another event wears this one’s pick');
  // A second pick before any render: the latest.
  s.tell('ev', { bg: '#8fa58a' });
  assert.equal(s.read('ev', server).bg, '#8fa58a');
  // The server caught up: ours is dropped.
  assert.equal(s.read('ev', { ...server, bg: '#8fa58a' }).bg, '#8fa58a');
  assert.equal(s.held('ev'), 0, 'a value the server now holds is still kept');
  // The server moved to something else after our pick (Undo, Restore): the server's.
  s.tell('ev', { bg: '#1a1410' });
  assert.equal(s.read('ev', server).bg, '#1a1410');
  assert.equal(s.read('ev', { ...server, bg: '#d9c7a8' }).bg, '#d9c7a8', 'a pick outlived an Undo');
  assert.equal(s.held('ev'), 0);
  // A refusal tells the old value again: nothing is held.
  s.tell('ev', { bg: '#1a1410' });
  s.tell('ev', { bg: '#ffffff' });
  assert.equal(s.read('ev', server).bg, '#ffffff');
  assert.equal(s.held('ev'), 0);
  // By content, not identity: the five as a new array of the same colours is the server's.
  const five = ['#111111', '#222222', '#333333', '#444444', '#555555'];
  s.tell('ev', { five: [...five] });
  assert.equal(s.read('ev', { five }).five, five);
  off();
  s.tell('ev', { bg: '#000000' });
  assert.equal(heard, 6, 'an unsubscribed listener was still told');

  // Each Look control tells the sample where it draws its own pick.
  const panel = read(`${E}/main-background-panel.tsx`);
  assert.match(panel, /lookGround\.draw\(lookKey, next, serverRef\.current\);\s*tellLookSample\(eventId, next\);/, 'a Background pick is not on the sample at the tap');
  assert.match(panel, /failed: said \} : p\)\);\s*tellLookSample\(eventId, lookGround\.read\(lookKey, serverRef\.current\)\);\s*\}/, 'a refused Background pick stays on the sample');
  assert.match(panel, /tellLookSample\(eventId, \{ main: provisional \}\);/, 'a picture being read is not on the sample at the tap');
  assert.match(panel, /failed: COULD_NOT_READ \} : p\)\);\s*tellLookSample\(eventId, \{ main: before \}\);\s*return;/, 'a picture that could not be read stays on the sample');
  const buttons = read(`${E}/buttons-look-row.tsx`);
  assert.match(buttons, /const preview = \(c: Choice\) => \{\s*tellLookSample\(eventId, \{ buttonStyle: encodeHubButtonStyle\(c\), buttonColour: c\.colour \}\);/);
  const tools = read(`${L}/studio-tools.tsx`);
  assert.match(tools, /tellLookSample\(eventId, \{ five: nextFive \}\);/);
  assert.match(tools, /if \(!ok\) \{\s*tellLookSample\(eventId, \{ five: before\.five \}\);/, 'a refused colour stays on the sample');
  assert.match(read(`${E}/pro-panels.tsx`), /onPick=\{\(key\) => tellLookSample\(eventId, \{ fontKey: key \}\)\}/);
});

/* ── (6) no page on screen, no page render ───────────────────────────────── */

test('(6) while the sample is the screen the hidden stage canvas is not re-rendered — it redraws once when a page is shown again, only if a pick asked', async () => {
  const { MAKER_CANVAS_REDRAW_EVENT, holdCanvasRedraw, requestCanvasRedraw, makerRedrawSave } = await import('./maker-refresh');
  const g = globalThis as unknown as { window?: unknown; Event?: unknown };
  const had = { window: g.window, Event: g.Event };
  let redraws = 0;
  g.Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
  g.window = { dispatchEvent: (e: { type: string }) => (e.type === MAKER_CANVAS_REDRAW_EVENT ? ++redraws : 0) };
  try {
    // Not held: every ask is a redraw, as before.
    requestCanvasRedraw();
    assert.equal(redraws, 1);
    // Held (Look's sample is the screen): three picks the server must measure ask for NO render…
    holdCanvasRedraw(true);
    for (let i = 0; i < 3; i++) await makerRedrawSave(async () => ({ ok: true }), () => {});
    assert.equal(redraws, 1, 'a Look pick re-rendered a page nobody is looking at');
    // …and the page redraws ONCE when it is shown again.
    holdCanvasRedraw(false);
    assert.equal(redraws, 2, 'the stage canvas was not redrawn when it was shown again — it would show the old look');
    holdCanvasRedraw(false);
    assert.equal(redraws, 2);
    // Look opened and left with nothing picked (or only refused picks): nothing is asked.
    holdCanvasRedraw(true);
    await makerRedrawSave(async () => ({ ok: false }), () => {});
    holdCanvasRedraw(false);
    assert.equal(redraws, 2, 'leaving Look re-rendered the page though nothing changed');
    requestCanvasRedraw();
    assert.equal(redraws, 3);
  } finally {
    holdCanvasRedraw(false);
    g.window = had.window;
    g.Event = had.Event;
  }

  const { lookSampleOnScreen } = await import(`../${L}/look-sample`);
  const details = { kind: 'tool', key: 'details' };
  for (const item of ['theme', 'background', 'elements', 'music']) assert.equal(lookSampleOnScreen(details, item), true, `${item} is a Look item`);
  assert.equal(lookSampleOnScreen(details, 'hero'), false, 'the Hero shows its page — its redraws must not be held');
  assert.equal(lookSampleOnScreen(details, 'rsvp'), false);
  assert.equal(lookSampleOnScreen({ kind: 'tool', key: 'hero' }, 'background'), false);
  assert.equal(lookSampleOnScreen({ kind: 'row', key: 'f:hero' }, 'background'), false, 'Stages is showing — the canvas must redraw');
  assert.equal(lookSampleOnScreen(null, 'background'), false);

  const sample = read(`${L}/look-sample.tsx`);
  assert.match(
    sample,
    /const onScreen = lookSampleOnScreen\(maker\?\.selection \?\? null, maker\?\.detailsItem \?\? null\);\s*useEffect\(\(\) => \{\s*holdCanvasRedraw\(onScreen\);\s*return \(\) => holdCanvasRedraw\(false\);\s*\}, \[onScreen\]\);/,
    'the sample does not hold the canvas redraw while it is the screen — or never lets go',
  );
  // With the sample as the screen, a pick is on screen at the tap: the line never waits for a hidden page.
  const panel = read(`${E}/main-background-panel.tsx`);
  assert.match(panel, /const sampleNode = useMaker\(\)\?\.lookPages\?\.look\?\.sample;\s*const onSample = studio && Boolean\(sampleNode\);/);
  assert.match(panel, /shown: heard === 0 \|\| Boolean\(!lay && !fresh && was && was\.seq === seq && was\.shown\) \|\| onSample,/, 'a pick waits for a page nobody sees before its line clears');
});
