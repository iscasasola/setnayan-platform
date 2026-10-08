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
 *       (`shadeWordVars`) — the same words follow it, over the veiled footage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { INVITE_THEME_IDS, type InviteThemeId } from './invite-themes';
import { compositeOver } from './hub-legibility';
import { ombreLook, ombreRamp, parseSiteBackground } from './ombre';
import { dressedTheme, paletteColourVars } from './theme-colours';
import { pagePaperAndInk } from './adaptive-theme';
import { mainGroundShade, shadeWordVars } from './main-ground-shade';
import {
  CANDLELIGHT_WORD_TOKENS,
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

/** One token, through any `var(--other)` it points at. */
function resolved(v: Record<string, string>, key: string, depth = 0): string | undefined {
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

  // As the guest page composes it now.
  const p = page(themeId, event);
  const ramp = rampOf(themeId, event);
  assert.equal(ramp.length, 9, 'the whole ramp is measured');
  assert.ok(contrastOf(p.get('--color-cream'), p.get(MULBERRY)) >= AA, 'the label still cannot be read on its fill');
  for (const token of [MULBERRY, HOVER, '--color-terracotta-600', '--color-terracotta-700']) {
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

test('(4) a look that already reads is not repainted, and the couple’s own button colour is never moved', () => {
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

  // Their own button colour is their answer — even where it does not carry the paper as a label
  // (Look › Buttons paints `.button-primary` with a label measured for it: `resolveHubButtons`).
  const own = page('house', { site_bg_color: '#1a1410', site_button_color: '#2a1d14' });
  assert.equal(own.get(MULBERRY), '42 29 20', 'the couple’s own button colour was moved');
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
      assert.equal(base[token], resolved({ ...ROOT, ...block }, token), `${themeId} ${token}: pageWordBase is not the cascade`);
    }
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
