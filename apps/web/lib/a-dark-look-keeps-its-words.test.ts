/**
 * a-dark-look-keeps-its-words.test.ts — A GUEST CAN READ THE BUTTON ON A DARK LOOK.
 *
 * Measured on the live page (`maria-and-jose`, 375 px, 2026-10-08): a Mood Board
 * on a light paper, wearing a DARK ombré. The page's own ink had flipped light,
 * as it should — and these had not followed it:
 *
 *   · "Reply to the invitation", "Get inside", "Upload your QR · Sign in"
 *     (`.button-primary`)            rgb(30 34 41) on rgb(55 59 49) — 1.4 : 1
 *   · the footer's "See you soon."   rgb(42 45 37) on the dark page — 1.1 : 1
 *   · the host's ribbon label        the page's pale ink on the gold plate
 *
 * `.button-primary` is `bg-mulberry text-cream`: its LABEL is the page's paper
 * and its FILL is "the colour that paper reads on". The Mood Board (and every
 * theme) sizes that fill, and the accent's deeper steps, against its OWN paper.
 * The couple's background then replaced the paper — and nothing else.
 *
 * 🔑 A TOKEN CANNOT SEE THE PIXELS. This file never asks "is the token set?" —
 * it runs the REAL composition (`guestLookFrom`, the function the guest layout
 * calls), resolves the cascade the browser resolves (`:root` → the theme's block
 * in `globals.css` → the inline bag) and measures the pair that is painted:
 *
 *   (1) the button's label on its fill, at rest and on hover — ≥ 4.5 : 1 on
 *       EVERY theme × every colour source, dark and light;
 *   (2) the measured page itself, with and without the fix (the guard can see
 *       the bug it exists for);
 *   (3) every coloured word — never harder to read than before the couple's
 *       background, up to AA; and over the WHOLE ramp where an ombré took the
 *       page to the other side;
 *   (4) a look that already reads is not repainted, and a couple's own button
 *       colour is never moved;
 *   (5) the two stylesheet tables the rule reads are the stylesheet's;
 *   (6) the page paints with the tokens measured here;
 *   (7) a DARK SHADE on the main background flips the paper the same way
 *       (`shadeWordVars`) — the same words follow it, over the veiled footage;
 *   (8) NO WORD TOKEN IS LEFT BEHIND: every colour the Mood Board sizes against
 *       its own paper is accounted for when the paper moves. Measured live on
 *       2026-10-11: `--color-gild-text` (the "and" between the names, the
 *       programme's times, "Our colours") had become a word token on 2026-10-05
 *       and was never added to the followers — 1.4 : 1 on the dark sample event;
 *   (9) A WORD FOLLOWS THE GROUND IT IS DRAWN ON, NOT THE PAGE'S. The fix for (8) moved the
 *       gild words for the dark page — and the same token is drawn on the sample event's GOLD
 *       date card, where "WHEN" went from 4.58 : 1 to 1.01 : 1 (measured on the preview of
 *       that fix). So this one draws the REAL guest page (`lib/site-body-fixture-render.ts`),
 *       finds every gild word on Welcome and on Details, and measures each against the ground
 *       of its NEAREST surface — the plate, the veil row, the page — on every Look.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
/* FIRST, before anything that draws the guest page: this import installs the fixture's seam ((9) draws the REAL page). */
import { renderSiteBodyFixture } from './site-body-fixture-render';
import { FIXTURE_EVENT } from './site-body-fixture';
import { anonymousIdentity } from '../app/[slug]/_lib/site-identity';
import { withheldVenue } from './venue-disclosure';

import { stripComments } from './strip-comments';
import { INVITE_THEME_IDS, type InviteThemeId } from './invite-themes';
import { compositeOver } from './hub-legibility';
import { ombreLook, ombreRamp, parseSiteBackground } from './ombre';
import { dressedTheme, paletteColourVars } from './theme-colours';
import { pagePaperAndInk } from './adaptive-theme';
import { mainGroundShade, shadeWordVars } from './main-ground-shade';
import {
  CANDLELIGHT_WORD_TOKENS,
  GILD_SURFACES,
  HOUSE_WORD_TOKENS,
  WORD_INK_TOKENS,
  blendOver,
  contrastOf,
  pageWordBase,
  pinWordInks,
  plateInkReads,
  proSiteVarsFor,
  shadeWordInks,
} from '../app/[slug]/_lib/pro-site-vars';

/* ── `server-only` shim (same as the-discover-card-wears-the-cover.test.ts) ──
   so the REAL look composition (`guestLookFrom`, `app/[slug]/_lib/loaders.ts`)
   is what these tests measure — never a copy of it. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(__filename)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_dark_look_words__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
const { guestLookFrom } = require('../app/[slug]/_lib/loaders') as typeof import('../app/[slug]/_lib/loaders');

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CSS = read('app/globals.css');

/** Every block for `selector` (top level or inside `@layer`), merged in source order (later wins). */
function cssVars(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const esc = selector.replace(/[[\]'().*]/g, (c) => `\\${c}`);
  const re = new RegExp(`^[ \\t]*${esc}\\s*\\{([^}]*)\\}`, 'gm');
  for (const m of CSS.matchAll(re)) {
    for (const d of m[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim();
  }
  return out;
}
const ROOT = cssVars(':root');

/**
 * One token, through any `var(--other)` it points at — and, for the WORDS' gild,
 * through the fallback `text-gild` itself carries: `var(--color-gild-text,
 * var(--color-gild))` (`tailwind.config.ts`, asserted in (8)). House and the
 * themes' stylesheet blocks name only the ornament; their words are it.
 */
function resolved(v: Record<string, string>, key: string, depth = 0): string | undefined {
  if (v[key] === undefined && key === '--color-gild-text') return resolved(v, '--color-gild', depth);
  const x = v[key];
  const m = x ? /^var\((--[\w-]+)\)$/.exec(x) : null;
  return m && depth < 4 ? resolved(v, m[1]!, depth + 1) : x;
}

const AA = 4.5;
const MULBERRY = '--color-mulberry';
const HOVER = '--color-mulberry-600';

type Event = Record<string, unknown>;
const hubOf = (theme: InviteThemeId) => ({ theme, accent: '#a9834b', monogram: 'M & J' });
const row = (event: Event) =>
  ({
    role_palette: null,
    site_bg_color: null,
    site_button_color: null,
    site_button_style: null,
    site_font_key: null,
    site_art_direction: null,
    ...event,
  }) as never;

/** What the page scope resolves for one theme and one event — the REAL composition over the REAL stylesheet. */
function page(themeId: InviteThemeId, event: Event) {
  const look = guestLookFrom(row(event), hubOf(themeId), false);
  // House stamps no `data-hub-theme` (loaders.ts: `theme: 'house' ? null`).
  const theme = themeId === 'house' ? {} : cssVars(`[data-hub-theme='${themeId}']`);
  const v = { ...ROOT, ...theme, ...(look.vars ?? {}) };
  const get = (k: string) => {
    const x = resolved(v, k);
    assert.ok(x && /^\d+ \d+ \d+$/.test(x), `${themeId}: ${k} does not resolve to channels (got ${x})`);
    return x!;
  };
  return { get, vars: look.vars, plateInk: resolved(v, '--color-ink-on-plate') ?? get('--color-ink') };
}

/** Everything an ombré paints behind the words: its ramp under the veil it baked in. `[]` for a plain colour. */
function rampOf(themeId: InviteThemeId, event: Event): string[] {
  const bg = parseSiteBackground(event.site_bg_color);
  if (bg?.kind !== 'ombre') return [];
  const { color, opacity } = ombreLook(dressedTheme(themeId, event.role_palette), bg.ombre).legibility.scrim;
  return ombreRamp(bg.ombre).map((stop) => compositeOver(color, opacity, stop));
}

/** Black reads better than white on it — a light page. */
const isLight = (paper: string) => contrastOf('0 0 0', paper) > contrastOf('255 255 255', paper);

/** maria-and-jose's shape: a board whose paper is a dusty rose and whose Accent is a near-black olive. */
const ROSE_BOARD = { reception: ['#525252', '#C5A059', '#373B31', '#C9A9A6', '#E8D9BD'] };
/** cale-ice's shape: a terracotta board on a near-white paper. */
const PINK_BOARD = { reception: ['#C97B4B', '#CEA7AE', '#FAF7F2'], ceremony: ['#D3AE93'] };

/** A couple's board, with and without each kind of background they can lay over it. */
const BOARDS: Record<string, Event> = {
  'no board': {},
  'a light board (cale-ice)': { role_palette: PINK_BOARD },
  'a rose board (maria-and-jose)': { role_palette: ROSE_BOARD },
};
const BACKGROUNDS: Record<string, Event> = {
  'no background': {},
  'white': { site_bg_color: '#ffffff' },
  'a light background': { site_bg_color: '#f5efe6' },
  'a tan background': { site_bg_color: '#d9c7a8' },
  'a mid sage background': { site_bg_color: '#8fa58a' },
  'a dark background': { site_bg_color: '#1a1410' },
  'a light ombré': { site_bg_color: 'ombre:glow:#f3e2d8' },
  'a dark ombré (maria-and-jose)': { site_bg_color: 'ombre:dawn:#1e2229' },
  'a dark diagonal ombré': { site_bg_color: 'ombre:diagonal:#1a1410' },
};

function everyLook(fn: (where: string, themeId: InviteThemeId, board: Event, background: Event) => void) {
  let n = 0;
  for (const themeId of INVITE_THEME_IDS) {
    for (const [boardName, board] of Object.entries(BOARDS)) {
      for (const [bgName, background] of Object.entries(BACKGROUNDS)) {
        n++;
        fn(`${themeId} · ${boardName} · ${bgName}`, themeId, board, background);
      }
    }
  }
  return n;
}
const LOOKS = INVITE_THEME_IDS.length * Object.keys(BOARDS).length * Object.keys(BACKGROUNDS).length;

test('(1) a primary button’s label reads on its fill (≥ 4.5 : 1), at rest and on hover, on every theme × every colour source', () => {
  const failures: string[] = [];
  let dark = 0;
  let light = 0;
  const looks = everyLook((where, themeId, board, background) => {
    const p = page(themeId, { ...board, ...background });
    // `.button-primary`: `bg-mulberry … text-cream … hover:bg-mulberry-600` (asserted in (6)).
    const label = p.get('--color-cream');
    if (isLight(label)) light++;
    else dark++;
    for (const [state, token] of [['at rest', MULBERRY], ['on hover', HOVER]] as const) {
      const c = contrastOf(label, p.get(token));
      if (c < AA) failures.push(`${where} · ${state}: ${c.toFixed(2)} : 1 (label ${label} on ${p.get(token)})`);
    }
  });
  assert.equal(looks, LOOKS, `only ${looks} looks were measured`);
  assert.ok(dark >= 60 && light >= 120, `the sweep must hold dark AND light pages (dark ${dark} · light ${light})`);
  assert.deepEqual(failures, [], `unreadable button labels:\n  ${failures.join('\n  ')}`);
});

test('(2) the measured page: unreadable without the fix, readable with it', () => {
  const event = { role_palette: ROSE_BOARD, site_bg_color: 'ombre:dawn:#1e2229' };
  const themeId: InviteThemeId = 'cyber';

  // As it shipped: the board, then the ombré laid over it — and nothing re-measured.
  const board = paletteColourVars(event.role_palette, themeId)!;
  const background = parseSiteBackground(event.site_bg_color);
  assert.ok(background?.kind === 'ombre', 'the measured background is an ombré');
  const ombre = ombreLook(dressedTheme(themeId, event.role_palette), background.ombre).vars;
  const shipped = { ...board, ...ombre };
  const paper = shipped['--color-cream']!;
  assert.equal(paper, '30 34 41', 'the ombré’s middle is the page’s paper');
  assert.ok(!isLight(paper), 'the measured page is dark');
  assert.ok(isLight(board['--color-cream']!), 'the board it was laid over is light');
  assert.ok(contrastOf(paper, shipped[MULBERRY]!) < 1.5, `the label should reproduce at ~1.4 : 1 (got ${contrastOf(paper, shipped[MULBERRY]!).toFixed(2)})`);
  assert.ok(contrastOf(shipped['--color-terracotta-700']!, paper) < 1.5, 'the sign-off should reproduce at ~1.1 : 1');
  // 2026-10-11: the "and" between the names, the programme's times, "Our colours" — `text-gild`.
  assert.ok(isLight(board['--color-cream']!) && contrastOf(board['--color-gild-text']!, board['--color-cream']!) >= AA, 'the board sized its gild words for its own light paper');
  assert.equal(ombre['--color-gild-text'], undefined, 'the ombré names the ornament’s gild, never its words');
  const gildWords = contrastOf(shipped['--color-gild-text']!, paper);
  assert.ok(gildWords < 1.5, `the gild words should reproduce at ~1.4 : 1 (got ${gildWords.toFixed(2)})`);

  // As the guest page composes it now.
  const p = page(themeId, event);
  const ramp = rampOf(themeId, event);
  assert.equal(ramp.length, 9, 'the whole ramp is measured');
  assert.ok(contrastOf(p.get('--color-cream'), p.get(MULBERRY)) >= AA, 'the label still cannot be read on its fill');
  for (const token of [MULBERRY, HOVER, '--color-terracotta-600', '--color-terracotta-700', '--color-gild-text']) {
    for (const ground of [p.get('--color-cream'), ...ramp]) {
      const c = contrastOf(p.get(token), ground);
      assert.ok(c >= AA, `${token} reads ${c.toFixed(2)} : 1 on ${ground}`);
    }
  }
});

test('(3) no coloured word is harder to read than before the couple’s background — up to AA', () => {
  const failures: string[] = [];
  let measured = 0;
  let acrossARamp = 0;
  everyLook((where, themeId, board, background) => {
    if (Object.keys(background).length === 0) return;
    const before = page(themeId, board);
    const after = page(themeId, { ...board, ...background });
    const paper = after.get('--color-cream');
    // The page changed sides under its words: they are held over everything the ombré paints.
    const changedSides = isLight(paper) !== isLight(before.get('--color-cream'));
    const ramp = changedSides ? rampOf(themeId, { ...board, ...background }) : [];
    for (const token of WORD_INK_TOKENS) {
      // The ombré names its own accent; that is its answer, measured in `lib/ombre.test.ts`.
      if (token === '--color-terracotta' && parseSiteBackground(background.site_bg_color)?.kind === 'ombre') continue;
      const target = Math.min(AA, contrastOf(before.get(token), before.get('--color-cream')));
      for (const ground of [paper, ...ramp]) {
        measured++;
        if (ground !== paper) acrossARamp++;
        const c = contrastOf(after.get(token), ground);
        if (c < target - 1e-9) failures.push(`${where} · ${token}: ${c.toFixed(2)} : 1 on ${ground} (it read ${target.toFixed(2)} before)`);
      }
    }
  });
  assert.ok(measured >= 1500 && acrossARamp >= 500, `only ${measured} measurements ran (${acrossARamp} across a ramp)`);
  assert.deepEqual(failures, [], `words a background made harder to read:\n  ${failures.join('\n  ')}`);
});

test('(4) a look that already reads is not repainted — and a button colour stored before the ruling is no longer worn', () => {
  // The paper did not move → the very same object.
  for (const themeId of INVITE_THEME_IDS) {
    for (const board of Object.values(BOARDS)) {
      const palette = paletteColourVars(board.role_palette, themeId);
      const vars = { ...(palette ?? {}), '--pahina-face': 'var(--font-x)' };
      assert.equal(pinWordInks(vars, pageWordBase(themeId, palette)), vars, `${themeId}: a look with no background was repainted`);
    }
  }
  assert.equal(pinWordInks(null, pageWordBase('house', null)), null);

  // A light board on a white background: every word reads as it did, so every word token is the board's own.
  const board = page('house', { role_palette: PINK_BOARD });
  const onWhite = page('house', { role_palette: PINK_BOARD, site_bg_color: '#ffffff' });
  for (const token of WORD_INK_TOKENS) assert.equal(onWhite.get(token), board.get(token), `${token} moved on a light look that already read`);

  /* 🔘 RE-AIMED 2026-10-08 (owner, round 3: "button color will be taken from their 5 palette"). This used to hold
     "their own button colour is their answer — never moved". There is no button colour of their own any more: a
     colour stored before the ruling is NOT read, so the fill is the page's own — and is moved, like every other
     word ink, until its label reads on the paper the page ends with. The page with the stored colour IS the page
     without it. */
  const stored = page('house', { site_bg_color: '#1a1410', site_button_color: '#2a1d14' });
  const none = page('house', { site_bg_color: '#1a1410' });
  assert.notEqual(stored.get(MULBERRY), '42 29 20', 'a stored button colour is worn again');
  assert.equal(stored.get(MULBERRY), none.get(MULBERRY), 'a stored button colour still changes the button’s fill');
  assert.deepEqual(stored.vars, none.vars);
});

test('(5) the stylesheet tables the rule reads ARE the stylesheet’s', () => {
  for (const [token, channels] of Object.entries(HOUSE_WORD_TOKENS)) {
    assert.equal(resolved(ROOT, token), channels, `:root ${token} drifted from HOUSE_WORD_TOKENS`);
  }
  const candle = { ...ROOT, ...cssVars("[data-art='candlelight']") };
  for (const [token, channels] of Object.entries(CANDLELIGHT_WORD_TOKENS)) {
    assert.equal(resolved(candle, token), channels, `[data-art='candlelight'] ${token} drifted from CANDLELIGHT_WORD_TOKENS`);
  }
  // Every token candlelight re-points is in its table (one it leaves alone stays House's).
  for (const token of [...WORD_INK_TOKENS, '--color-cream']) {
    assert.equal(
      resolved(candle, token),
      pageWordBase('house', null, 'candlelight')[token],
      `candlelight ${token} is not what pageWordBase answers`,
    );
  }
  // A theme's block is `themeBlockVars` (held channel-for-channel by lib/invite-themes.test.ts).
  for (const themeId of INVITE_THEME_IDS) {
    if (themeId === 'house') continue;
    const block = cssVars(`[data-hub-theme='${themeId}']`);
    const base = pageWordBase(themeId, null);
    for (const token of [...WORD_INK_TOKENS, '--color-cream']) {
      assert.equal(resolved(base, token), resolved({ ...ROOT, ...block }, token), `${themeId} ${token}: pageWordBase is not the cascade`);
    }
    // The stylesheet's block names the ornament and not its words — and so does the model of it.
    assert.equal(block['--color-gild-text'], undefined, `${themeId}: the stylesheet now names the words’ gild — carry it in pageWordBase`);
    assert.equal(base['--color-gild-text'], undefined, `${themeId}: pageWordBase names a words’ gild the stylesheet does not set`);
  }
});

test('(6) the page paints with the tokens measured above', () => {
  // The button: its fill is `--color-mulberry`, its hover `-600`, and its LABEL is the paper.
  const button = /^[ \t]*\.button-primary \{\s*@apply ([^;]+);/m.exec(CSS);
  assert.ok(button, '.button-primary is gone from globals.css');
  const classes = button[1]!.split(/\s+/);
  for (const c of ['bg-mulberry', 'text-cream', 'hover:bg-mulberry-600']) {
    assert.ok(classes.includes(c), `.button-primary no longer wears ${c} — (1) measures a pair the page does not paint`);
  }
  assert.equal(classes.filter((c) => /^text-(?!sm$|xs$|base$|lg$)/.test(c)).join(' '), 'text-cream', 'the label takes a second colour');

  // The footer's sign-off, and the door's buttons.
  const shell = stripComments(read('app/[slug]/_components/invitation-shell.tsx'));
  assert.match(shell, /backdrop \? 'text-cream\/90' : 'text-terracotta-700'/);
  const door = stripComments(read('app/[slug]/_components/get-inside.tsx'));
  assert.match(door, /<summary className="button-primary [^"]*">\s*<span className="text-base">Get inside<\/span>/);

  // The host's ribbon is the PLATE's paper, so its label takes the plate's ink.
  const ribbon = stripComments(read('app/[slug]/_components/owner-ribbon.tsx'));
  assert.match(ribbon, /bg-paper-deep\/95/);
  assert.match(ribbon, /text-ink-on-plate\/70">\s*Your Event Hub — as a guest sees it/);
  assert.match(
    read('tailwind.config.ts'),
    /'on-plate': 'rgb\(var\(--color-ink-on-plate, var\(--color-ink\)\) \/ <alpha-value>\)'/,
    '`text-ink-on-plate` must fall back to the page ink, or House paints it blank',
  );
  // Measured: on the live page the PAGE ink there is the pale rose (1.3 : 1 on the gold plate); the plate's reads.
  const live = page('cyber', { role_palette: ROSE_BOARD, site_bg_color: 'ombre:dawn:#1e2229' });
  const gold = live.get('--color-paper-deep');
  assert.ok(contrastOf(blendOver(live.get('--color-ink'), gold, 0.7), gold) < 2, 'the page ink should reproduce the pale-on-gold label');
  assert.ok(contrastOf(blendOver(live.plateInk, gold, 0.7), gold) >= AA, 'the plate ink does not read on the measured plate');
  // Everywhere: wherever the plate holds a readable ink at all (`pinPlateInk`'s own bar), the label reads at AA.
  const failures: string[] = [];
  let held = 0;
  everyLook((where, themeId, board, background) => {
    const p = page(themeId, { ...board, ...background });
    const plate = p.get('--color-paper-deep');
    if (!plateInkReads(p.plateInk, plate)) return; // a mid-tone plate: best effort, pinPlateInk's own limit
    held++;
    const c = contrastOf(blendOver(p.plateInk, plate, 0.7), plate);
    if (c < AA) failures.push(`${where}: ${c.toFixed(2)} : 1 (ink ${p.plateInk} on ${plate})`);
  });
  assert.ok(held >= LOOKS / 2, `only ${held} of ${LOOKS} looks hold a readable plate ink — the ribbon claim is nearly vacuous`);
  assert.deepEqual(failures, [], `the ribbon label cannot be read:\n  ${failures.join('\n  ')}`);

  // The composition: the words are re-measured AFTER the ombré is spread, with its ramp, and before the plate pin.
  const loaders = stripComments(read('app/[slug]/_lib/loaders.ts'));
  const start = loaders.indexOf('export function guestLookFrom(');
  const body = loaders.slice(start, loaders.indexOf('\n}\n', start));
  const ombre = body.search(/vars = \{ \.\.\.\(vars \?\? \{\}\), \.\.\.look\.vars \}/);
  const words = body.search(/vars = pinWordInks\(\s*vars,\s*pageWordBase\(hub\.theme, palette, [^)]*\),\s*ramp,\s*\)/);
  const plate = body.search(/const painted = /);
  assert.ok(ombre > 0 && words > ombre && plate > words, `guestLookFrom no longer re-measures the words after the ombré (positions ${ombre}, ${words}, ${plate})`);
  assert.match(body, /ramp = ombreRamp\(background\.ombre\)\.map\(\(stop\) => compositeOver\(color, opacity, stop\)\)/);

  // …and what `proSiteVarsFor` leaves for it: the paper and the ink, never the button.
  const plain = proSiteVarsFor({ site_bg_color: '#1a1410' }, false, 'house')!;
  assert.deepEqual(Object.keys(plain).sort(), ['--color-cream', '--color-ink', '--color-ink-on-plate']);
});

test('(7) a dark shade on the main background: the label reads on its fill and the words read over the veiled footage', () => {
  /** A bright frame and a dark one — the veil is measured over both, so are the words. */
  const FRAME = ['#f4efe6', '#3a2f28'];
  const failures: string[] = [];
  let measured = 0;
  let reproduced = 0;
  for (const themeId of INVITE_THEME_IDS) {
    for (const [boardName, board] of Object.entries(BOARDS)) {
      const palette = paletteColourVars(board.role_palette, themeId);
      const paperAndInk = pagePaperAndInk(dressedTheme(themeId, board.role_palette));
      const theme = themeId === 'house' ? {} : cssVars(`[data-hub-theme='${themeId}']`);
      const before = { ...ROOT, ...theme, ...(palette ?? {}) };
      for (const step of ['dark', 'darker'] as const) {
        const shade = mainGroundShade(step, paperAndInk, FRAME);
        const flip = shadeWordVars(shade, paperAndInk);
        assert.ok(flip['--color-cream'], `${themeId}: a ${step} shade must flip the paper`);
        const veiled = FRAME.map((c) => compositeOver(shade.veil, shade.opacity, c));
        const followers = shadeWordInks(flip, pageWordBase(themeId, palette), veiled);
        const where = `${themeId} · ${boardName} · ${step}`;
        // The page changed sides under its words — or the theme was dark already and nothing had to move.
        const label = flip['--color-cream']!;
        const changedSides = isLight(label) !== isLight(resolved(before, '--color-cream')!);
        if (contrastOf(label, resolved(before, MULBERRY)!) < AA) reproduced++;
        const after = { ...before, ...flip, ...followers };
        for (const token of [MULBERRY, HOVER]) {
          measured++;
          const c = contrastOf(label, resolved(after, token)!);
          if (c < AA) failures.push(`${where} · label on ${token}: ${c.toFixed(2)} : 1 (${label} on ${resolved(after, token)})`);
        }
        for (const token of WORD_INK_TOKENS) {
          const target = Math.min(AA, contrastOf(resolved(before, token)!, resolved(before, '--color-cream')!));
          for (const ground of changedSides ? [label, ...veiled] : [label]) {
            measured++;
            const c = contrastOf(resolved(after, token)!, ground);
            if (c < target - 1e-9) failures.push(`${where} · ${token}: ${c.toFixed(2)} : 1 on ${ground} (it read ${target.toFixed(2)} before)`);
          }
        }
      }
    }
  }
  assert.ok(measured >= 1000, `only ${measured} measurements ran`);
  assert.ok(reproduced >= 20, `the flip alone should leave the label unreadable on most light looks (it did on ${reproduced})`);
  assert.deepEqual(failures, [], `words a dark shade left unreadable:\n  ${failures.join('\n  ')}`);

  // House, as it shipped: the flip makes the label the dark ink, on the terracotta sized for a white one.
  const house = pagePaperAndInk(dressedTheme('house', null));
  const dark = shadeWordVars(mainGroundShade('dark', house, FRAME), house);
  assert.ok(contrastOf(dark['--color-cream']!, HOUSE_WORD_TOKENS[MULBERRY]!) < AA, 'House under a dark shade should reproduce the label under AA');
  // A paper veil flips nothing, so nothing follows.
  const lighter = shadeWordVars(mainGroundShade('lighter', house, FRAME), house);
  assert.deepEqual(shadeWordInks(lighter, pageWordBase('house', null)), {});
  // The couple's own button colour stands (Look › Buttons measures its label).
  const own = { [MULBERRY]: '42 29 20', [HOVER]: '36 25 17', '--color-mulberry-700': '30 21 14' };
  const kept = shadeWordInks(dark, pageWordBase('house', null), [], own);
  assert.ok(!(MULBERRY in kept) && !(HOVER in kept), 'the couple’s own button colour was moved under a shade');
  assert.ok('--color-terracotta-700' in kept, 'the accent’s steps still follow the flipped paper');

  // The layer spreads the followers AFTER the flip, in the one stylesheet that carries it.
  const layer = stripComments(read('app/[slug]/_lib/main-ground-layer.tsx'));
  assert.match(
    layer,
    /\.\.\.\(shade \? shadeWordVars\(shade, page\) : \{\}\),\s*\.\.\.\(shade \? shadeFollowers\(shade, page, mainGround, theme, event, adaptive\) : \{\}\),/,
  );
  assert.match(layer, /return shadeWordInks\(\s*shadeWordVars\(shade, page\),/);
  assert.match(layer, /\.map\(\(sample\) => compositeOver\(shade\.veil, shade\.opacity, sample\)\)/);
});

test('(8) no word token is left behind: every colour the Mood Board sizes against its paper has a follower when the paper moves', () => {
  /** What keeps each of the board's tokens readable once a background replaces the paper under it. */
  const FOLLOWER: Record<string, string> = {
    '--color-cream': 'the paper itself — the background replaces it',
    '--color-ink': 'the background names its own ink (`proSiteVarsFor` · `ombreLook`)',
    '--color-ink-on-plate': '`pinPlateInk` — measured on the plate that paints',
    '--color-paper-deep': 'the plate keeps its own paper; its words are `--color-ink-on-plate`',
    '--color-veil': 'a wash behind the masthead, never a word',
    '--color-gild': 'ORNAMENT ONLY (rules, rings, seals) — no contrast pull by design; its words are `--color-gild-text`',
    '--hub-heading': 'the theme’s own hex set; the ombré measures its heading over the ramp',
  };
  const board = paletteColourVars(ROSE_BOARD, 'house')!;
  const unaccounted = Object.keys(board).filter(
    (k) => k.startsWith('--color-') && !(k in FOLLOWER) && !WORD_INK_TOKENS.includes(k),
  );
  assert.deepEqual(
    unaccounted,
    [],
    `the Mood Board sizes ${unaccounted.join(', ')} against its own paper and nothing moves it when a background replaces that paper — add it to WORD_INK_TOKENS (a word) or name its follower here`,
  );
  // …and a token cannot be both an ornament and a word.
  for (const k of Object.keys(FOLLOWER)) assert.ok(!WORD_INK_TOKENS.includes(k), `${k} is listed as followed AND as a word token`);

  // `text-gild` is the WORDS' token first, the ornament's only where no layer names one — the fallback `resolved` models.
  assert.match(
    read('tailwind.config.ts'),
    /textColor: \{\s*gild: 'rgb\(var\(--color-gild-text, var\(--color-gild\)\) \/ <alpha-value>\)',/,
  );
  // The three places measured live on 2026-10-11 set their words in it.
  // (The card's joiner is drawn by `stackedPair` since 2026-10-11 — one call for the names and for the canvas's pair.)
  const masthead = stripComments(read('app/[slug]/_components/pahina-masthead.tsx'));
  assert.match(masthead, /\{\.\.\.joinerStamp\(forCanvas\)\} className=\{`block font-pahina \$\{size\} italic text-gild`\}/);
  assert.match(masthead, /const cardPair = \([^)]*\) => stackedPair\('text-\[0\.5em\]', joiner, second, forCanvas\);/);
  assert.match(stripComments(read('app/[slug]/_components/schedule-widget.tsx')), /data-schedule-time[\s\S]{0,400}text-gild|text-gild[\s\S]{0,400}data-schedule-time/);
  assert.match(stripComments(read('app/[slug]/_components/dress-code-widget.tsx')), /text-gild/);

  // On EVERY look whose page changed sides, the gild words read at AA on the paper the page ends with.
  const failures: string[] = [];
  let flipped = 0;
  everyLook((where, themeId, board2, background) => {
    if (Object.keys(background).length === 0) return;
    const before = page(themeId, board2);
    const after = page(themeId, { ...board2, ...background });
    if (isLight(after.get('--color-cream')) === isLight(before.get('--color-cream'))) return;
    flipped++;
    const target = Math.min(AA, contrastOf(before.get('--color-gild-text'), before.get('--color-cream')));
    const c = contrastOf(after.get('--color-gild-text'), after.get('--color-cream'));
    if (c < target - 1e-9) failures.push(`${where}: ${c.toFixed(2)} : 1 (it read ${target.toFixed(2)} before the background)`);
  });
  assert.ok(flipped >= 40, `only ${flipped} looks changed sides — the sweep went thin`);
  assert.deepEqual(failures, [], `gild words a background left unreadable:\n  ${failures.join('\n  ')}`);
});

/* ── (9) EVERY GILD WORD ON THE REAL PAGE, AGAINST THE GROUND OF ITS NEAREST SURFACE ──────────────── */

/** The page itself, or one of the surfaces that keep a ground of their own (`GILD_SURFACES`). */
type Surface = (typeof GILD_SURFACES)[number] | null;
type GildWord = { text: string; tab: string; tag: string; surface: Surface; where: string };
const surfaceName = (x: Surface) => (x ? x.key : 'page');

/** Every element set in `text-gild` on a rendered page, with the tab it is on and the nearest surface that paints under it. */
function gildWords(html: string, page: string): GildWord[] {
  // HTML's void elements only: the renderer closes every SVG element explicitly (`<path …></path>`).
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const stack: Array<{ surface: Surface; tab: string | null }> = [];
  const out: GildWord[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const [whole, close, tag, attrs, selfClose] = m as unknown as [string, string, string, string, string];
    if (tag === 'style' || tag === 'script') {
      // Skip the raw text AND its closing tag — neither is an element of the page.
      if (!close) re.lastIndex = html.indexOf(`</${tag}>`, re.lastIndex) + tag.length + 3;
      continue;
    }
    if (close) { stack.pop(); continue; }
    const classes = (/\sclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/);
    const tab = /\sdata-hub-tab="([^"]*)"/.exec(attrs)?.[1] ?? null;
    const own: Surface = GILD_SURFACES.find((x) => (x.classes as readonly string[]).some((c) => classes.includes(c))) ?? null;
    const surface: Surface = own ?? [...stack].reverse().find((f) => f.surface)?.surface ?? null;
    const onTab = tab ?? [...stack].reverse().find((f) => f.tab)?.tab ?? '(none)';
    if (classes.includes('text-gild')) {
      const text = html.slice(m.index + whole.length, m.index + whole.length + 60).replace(/<[^>]*>?/g, ' ').trim().split(/\s{2,}/)[0]!.slice(0, 24);
      out.push({ text: text || `<${tag}>`, tab: onTab, tag, surface, where: page });
    }
    if (!selfClose && !VOID.has(tag)) stack.push({ surface: own, tab });
  }
  assert.equal(stack.length, 0, `${page}: the page's tags did not balance (${stack.length} left open) — the surfaces above a word cannot be trusted`);
  return out;
}

/** One colour of the words' gild, as the stylesheet resolves it on a surface (`globals.css`, the shadow rules held below). */
function gildOn(v: Record<string, string>, surface: Surface, honourSurfaces = true): string {
  const pageWords = resolved(v, '--color-gild-text')!;
  return surface && honourSurfaces ? (v[surface.token] ?? pageWords) : pageWords;
}
/** The colour that surface paints behind its words. */
function groundOf(v: Record<string, string>, surface: Surface): string {
  const paper = resolved(v, '--color-cream')!;
  if (!surface) return paper;
  return surface.veil === null ? resolved(v, '--color-paper-deep')! : blendOver(resolved(v, '--color-veil')!, paper, surface.veil);
}
/** The cascade one Look resolves: `:root` → the theme's block → the inline bag. */
function cascade(themeId: InviteThemeId, event: Event): Record<string, string> {
  const look = guestLookFrom(row(event), hubOf(themeId), false);
  return { ...ROOT, ...(themeId === 'house' ? {} : cssVars(`[data-hub-theme='${themeId}']`)), ...(look.vars ?? {}) };
}

test('(9) every gild word on the REAL page reads on the ground of its nearest surface — Welcome and Details, every Look', async () => {
  // ── The pages: a listed guest (Welcome · Details · the story), and a stranger whose Details opens with the
  //    "THE DETAILS · WHEN" plate — the gold date card measured on the preview.
  const stranger = anonymousIdentity({ reason: null, publicCandidCameraActive: false, publicAlbumHref: null });
  const pages: Record<string, string> = {
    'a guest': await renderSiteBodyFixture({ event: { ...FIXTURE_EVENT, love_story: { how_we_met: 'On a jeepney in Cubao.' } } as never }),
    'a stranger': await renderSiteBodyFixture({ identity: stranger, event: { ...withheldVenue(FIXTURE_EVENT), website_open_browse: true } as never }),
  };
  const words = Object.entries(pages).flatMap(([page, html]) => gildWords(html, page));
  const kinds = new Map<string, GildWord>();
  for (const w of words) kinds.set(`${w.where}|${w.tab}|${surfaceName(w.surface)}|${w.tag}|${w.text}`, w);
  const list = [...kinds.values()];
  const PLATE = GILD_SURFACES[0];
  // Not vacuous: both tabs, the plate the fault was on, a veil row, and the page itself.
  assert.ok(list.length >= 12, `only ${list.length} gild words were found on the real page`);
  for (const tab of ['home', 'details']) assert.ok(list.some((w) => w.tab === tab), `no gild word was found on the ${tab} tab`);
  const when = list.find((w) => w.text === 'When' && w.surface === PLATE && w.tab === 'details');
  assert.ok(when, 'the "When" label on the details plate is not on the rendered page — the measured fault is no longer drawn here');
  assert.ok(list.some((w) => w.tag === 'svg' && w.surface === PLATE), 'the calendar icon on the plate is not found');
  assert.ok(list.some((w) => w.surface?.veil), 'no gild word on a veil row was found');
  assert.ok(list.some((w) => w.surface === null && w.tab === 'home'), 'the "and" between the names is not found');

  // ── The measured page, three ways: live (before any fix) · the first fix alone · now.
  const SAMPLE = { role_palette: ROSE_BOARD, site_bg_color: 'ombre:dawn:#1e2229' };
  const now = cascade('cyber', SAMPLE);
  const board = paletteColourVars(ROSE_BOARD, 'cyber')!;
  const gold = groundOf(now, PLATE);
  assert.equal(gold, '197 160 89', 'the sample event’s date card is gold');
  const live = contrastOf(board['--color-gild-text']!, gold);
  const firstFixAlone = contrastOf(gildOn(now, PLATE, false), gold);
  const fixed = contrastOf(gildOn(now, PLATE), gold);
  assert.ok(live >= AA, `live, "WHEN" read ${live.toFixed(2)} : 1 on the gold card`);
  assert.ok(firstFixAlone < 1.2, `the first fix alone should reproduce "WHEN" at ~1.0 : 1 on gold (got ${firstFixAlone.toFixed(2)})`);
  assert.ok(fixed >= live - 1e-9, `"WHEN" reads ${fixed.toFixed(2)} : 1 on gold — it read ${live.toFixed(2)} live`);
  assert.equal(now[PLATE.token], board['--color-gild-text'], 'the plate keeps the very colour the Mood Board sized for it');
  // …and the page's own words keep the first fix.
  assert.ok(contrastOf(gildOn(now, null), groundOf(now, null)) >= AA);

  // ── Every Look: no gild word, on any surface, is harder to read than before the couple's background — up to AA —
  //    and none reads worse than it did LIVE, before either fix.
  const failures: string[] = [];
  const worse: string[] = [];
  let measured = 0;
  let pinnedLooks = 0;
  let better = 0;
  const table: string[] = [];
  const looks = everyLook((where, themeId, boardEvent, background) => {
    const before = cascade(themeId, boardEvent);
    const after = cascade(themeId, { ...boardEvent, ...background });
    if (GILD_SURFACES.some((x) => after[x.token])) pinnedLooks++;
    // What the page drew LIVE: the words' gild exactly as the layers left it, read through the stylesheet's own
    // fallback — the board's (or a seed's) where one names it, else the ornament's as the background left that.
    const liveWords = paletteColourVars(boardEvent.role_palette, themeId)?.['--color-gild-text'] ?? after['--color-gild']!;
    for (const w of list) {
      measured++;
      const ground = groundOf(after, w.surface);
      const c = contrastOf(gildOn(after, w.surface), ground);
      const target = Math.min(AA, contrastOf(gildOn(before, w.surface), groundOf(before, w.surface)));
      const what = `${where} · ${w.where} › ${w.tab} › "${w.text}" on ${surfaceName(w.surface)}`;
      if (c < target - 1e-9) failures.push(`${what}: ${c.toFixed(2)} : 1 on ${ground} (it read ${target.toFixed(2)} before the background)`);
      const wasLive = contrastOf(liveWords, ground);
      if (c < Math.min(AA, wasLive) - 1e-9) worse.push(`${what}: ${wasLive.toFixed(2)} live → ${c.toFixed(2)}`);
      if (c > wasLive + 1e-9) better++;
      if (where === 'cyber · a rose board (maria-and-jose) · a dark ombré (maria-and-jose)') {
        table.push(`${w.where} › ${w.tab} › ${w.tag === 'svg' ? 'icon' : `"${w.text}"`} · on ${surfaceName(w.surface)} (${ground}): live ${wasLive.toFixed(2)} → first fix ${contrastOf(gildOn(after, w.surface, false), ground).toFixed(2)} → now ${c.toFixed(2)}`);
      }
    }
  });
  assert.equal(looks, LOOKS);
  assert.ok(measured >= LOOKS * 12 && pinnedLooks >= 40, `the sweep went thin (${measured} measurements, ${pinnedLooks} Looks with a surface pinned)`);
  if (process.env.GILD_TABLE) writeFileSync(process.env.GILD_TABLE, [`${LOOKS} Looks × ${list.length} gild words = ${measured} measurements · ${pinnedLooks} Looks pin a surface · read better than live: ${better} · worse than live: ${worse.length}`, '', 'the sample event (cyber · rose board · dark dawn ombré):', ...table.map((t) => `  ${t}`)].join('\n'));
  assert.deepEqual(failures, [], `gild words that cannot be read on the surface they are drawn on:\n  ${failures.slice(0, 25).join('\n  ')}`);
  assert.deepEqual(worse, [], `gild words that read WORSE than they did live:\n  ${worse.slice(0, 25).join('\n  ')}`);

  // ── The stylesheet is what `gildOn` models: each surface shadows the words' gild with its own token, and falls
  //    back to the PAGE's value under a second name (a property cannot name itself).
  assert.match(CSS, /--color-gild-text-page: var\(--color-gild-text, var\(--color-gild\)\);/);
  const ruled = new Set<string>();
  for (const surface of GILD_SURFACES) {
    const rule = new RegExp(`\\.sn-editorial (?::is\\(([^)]*)\\)|(\\.[^ {]+)) \\{\\s*--color-gild-text: var\\(${surface.token}, var\\(--color-gild-text-page\\)\\);`).exec(CSS);
    assert.ok(rule, `no rule shadows the words’ gild on the ${surface.key} surface`);
    const named = (rule[1] ?? rule[2]!).split(',').map((c) => c.trim().replace(/^\./, '').replace(/\\/g, ''));
    assert.deepEqual(named.sort(), [...surface.classes].sort(), `the ${surface.key} rule and GILD_SURFACES name different classes`);
    for (const c of named) ruled.add(c);
  }
  // Every class a guest component paints a plate or a veil ROW with is named by a rule (derived from the components).
  const used = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) {
        for (const m of stripComments(read(`${dir}/${e.name}`)).matchAll(/(?<![\w:-])bg-(?:paper-deep|veil)(?:\/\d+)?(?![\w/-])/g)) used.add(m[0]);
      }
    }
  };
  walk('app/[slug]');
  assert.ok(used.size >= 4, `only ${[...used].join(', ')} found in the guest components — the scan went blind`);
  // The opaque veil is a picture well (a map, a portrait): no word sits on it on the rendered page.
  const unruled = [...used].filter((c) => !ruled.has(c) && c !== 'bg-veil');
  assert.deepEqual(unruled, [], `a guest component paints ${unruled.join(', ')} and no rule shadows the words’ gild there`);
});
