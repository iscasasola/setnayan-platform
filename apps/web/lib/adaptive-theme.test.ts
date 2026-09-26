/**
 * lib/adaptive-theme.test.ts — THE THEME FOLLOWS THE COUPLE'S FOOTAGE, AND THE
 * WORDS STILL READ.
 *
 * Build plan §3 Phase 10: "tint keeps contrast ≥ 4.5 on the fixture frames or
 * raises the scrim". Every assertion below is a contrast ratio computed from what
 * the module RETURNS, over pixels the fixture actually paints — never a phrasing.
 *
 * The fixture frames are painted pixel by pixel (RGBA, as `getImageData` returns
 * them) and run through the SAME `measureFrame` the Maker runs in the browser, so
 * the measuring half is exercised too, not handed a convenient answer.
 *
 * Lives in `lib/` on purpose: node's test glob does not reach `[eventId]` folders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUB_THEMES, INVITE_THEMES } from '@/lib/invite-themes';
import { oklchOfHex } from '@/lib/color-space';
import { AA_BODY, compositeOver, contrastRatio } from '@/lib/hub-legibility';
import { hubThemePageTokens } from '@/lib/hub-theme-tokens';
import {
  CALMER_CLIP_SCRIM,
  adaptiveThemeVars,
  frameCast,
  mainGroundLegibility,
  measureFrame,
  pagePaperAndInk,
  resolveAdaptiveTheme,
  sanitizeHubTint,
  type HubTint,
} from '@/lib/adaptive-theme';

/* ── FIXTURE FRAMES ────────────────────────────────────────────────────────── */

type Px = [number, number, number];
const W = 48;
const H = 32;

/** Paint a W×H frame from a function of (x, y). */
function paint(fn: (x: number, y: number) => Px): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = fn(x, y);
      const i = (y * W + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  return out;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (p: Px, q: Px, t: number): Px => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];

const FIXTURES = {
  /** A warm sunset: amber sky into a rust horizon, a hot sun spot. */
  'warm sunset': paint((x, y) => {
    const sky = mix([244, 170, 92], [168, 72, 44], y / H);
    const sun = Math.hypot(x - 30, y - 10) < 5;
    return sun ? [255, 236, 190] : sky;
  }),
  /** A cool sea: deep blue to pale aqua. */
  'cool sea': paint((_x, y) => mix([22, 58, 104], [150, 206, 222], y / H)),
  /** A busy black-and-white stripe — the clip the scrim has to fight hardest. */
  'busy stripes': paint((x) => (Math.floor(x / 3) % 2 === 0 ? [8, 8, 8] : [248, 248, 248])),
  /** A grey, colourless frame — nothing to follow. */
  'grey fog': paint((x, y) => {
    const v = 120 + ((x + y) % 7) * 6;
    return [v, v, v];
  }),
  /** A night reception: near-black with warm fairy lights. */
  'night lights': paint((x, y) => ((x * 7 + y * 3) % 23 === 0 ? [255, 214, 140] : [18, 14, 20])),
  /** A bright garden: pale greens and whites. */
  'bright garden': paint((x, y) => mix([236, 244, 226], [120, 170, 96], ((x + y) % 10) / 20)),
} satisfies Record<string, Uint8ClampedArray>;
type Fixture = keyof typeof FIXTURES;

const frames = Object.fromEntries(
  Object.entries(FIXTURES).map(([name, px]) => [name, measureFrame(px, W, H)]),
) as Record<Fixture, string[]>;

/* ── MEASURING ─────────────────────────────────────────────────────────────── */

test('measureFrame keeps the extremes and never pads', () => {
  const stripes = frames['busy stripes'];
  assert.ok(stripes.length >= 2 && stripes.length <= 8, `stripes measured ${stripes.length} colours`);
  // The darkest and the lightest pixels are the ones words fail over — both must survive.
  assert.ok(stripes.includes('#080808'), `darkest stripe missing from ${stripes.join(' ')}`);
  assert.ok(stripes.includes('#f8f8f8'), `lightest stripe missing from ${stripes.join(' ')}`);
  // A flat frame is ONE colour — nothing invented beside it (the Mood Board picker pads with cream).
  const flat = measureFrame(paint(() => [90, 90, 90]), W, H);
  assert.deepEqual(flat, ['#5a5a5a']);
  // Transparent pixels are not the footage.
  const clear = new Uint8ClampedArray(W * H * 4);
  assert.deepEqual(measureFrame(clear, W, H), []);
});

test('the cast follows the footage — warm is warm, cool is cool, grey is nothing', () => {
  const warm = frameCast(frames['warm sunset']);
  const cool = frameCast(frames['cool sea']);
  assert.ok(warm && warm.H >= 20 && warm.H <= 90, `warm sunset cast hue ${warm?.H.toFixed(0)}`);
  assert.ok(cool && cool.H >= 180 && cool.H <= 270, `cool sea cast hue ${cool?.H.toFixed(0)}`);
  assert.equal(frameCast(frames['grey fog']), null);
  assert.equal(frameCast(frames['busy stripes']), null);
});

/* ── THE CONTRAST CONTRACT, EVERY THEME × EVERY FIXTURE ────────────────────── */

test('every theme × every fixture: body text reads at AA over the frame — the scrim rises until it does', () => {
  let checked = 0;
  for (const theme of HUB_THEMES) {
    const { paper, ink } = pagePaperAndInk(theme);
    for (const [name, frame] of Object.entries(frames)) {
      const leg = mainGroundLegibility(theme, frame);
      for (const s of frame) {
        const ratio = contrastRatio(ink, compositeOver(paper, leg.scrim, s));
        assert.ok(ratio >= AA_BODY - 1e-9, `${theme.name} × ${name}: ink over ${s} is ${ratio.toFixed(2)}:1 at scrim ${leg.scrim}`);
      }
      assert.ok(leg.bodyContrast >= AA_BODY - 1e-9);
      checked += 1;
    }
  }
  assert.equal(checked, HUB_THEMES.length * Object.keys(frames).length);
});

test('every theme × every fixture: a tinted button and accent keep 4.5:1, or the theme keeps its own', () => {
  let tinted = 0;
  for (const theme of HUB_THEMES) {
    const { paper } = pagePaperAndInk(theme);
    for (const [name, frame] of Object.entries(frames)) {
      const r = resolveAdaptiveTheme(theme, { match: true, frame });
      if (!r.tint) continue;
      tinted += 1;
      if (r.tint.button) {
        // The label on a button is the paper (`text-cream`).
        const ratio = contrastRatio(r.tint.button, paper);
        assert.ok(ratio >= AA_BODY - 1e-9, `${theme.name} × ${name}: button ${r.tint.button} label is ${ratio.toFixed(2)}:1`);
      }
      if (r.tint.accent) {
        assert.ok(contrastRatio(r.tint.accent, paper) >= AA_BODY - 1e-9, `${theme.name} × ${name}: accent on paper`);
        for (const s of frame) {
          const over = compositeOver(paper, r.scrim, s);
          const ratio = contrastRatio(r.tint.accent, over);
          assert.ok(ratio >= AA_BODY - 1e-9, `${theme.name} × ${name}: accent over ${s} is ${ratio.toFixed(2)}:1`);
        }
      }
      assert.ok(contrastRatio(r.tint.ornamentInk, r.tint.ornament) >= 3, `${theme.name} × ${name}: ornament ink`);
    }
  }
  // Three of the six fixtures have a hue worth following (sunset, sea, garden —
  // the night clip is near-black with a few specks); every theme must tint for them.
  assert.ok(tinted >= HUB_THEMES.length * 3, `only ${tinted} theme × fixture pairs tinted`);
});

test('a busy clip is told to calm down — a calm one is not', () => {
  const modern = INVITE_THEMES.galeriya;
  // Black-and-white stripes under a light theme's dark ink need a veil past half.
  const busy = mainGroundLegibility(modern, frames['busy stripes']);
  assert.equal(busy.calmer, true);
  assert.ok(busy.scrim >= CALMER_CLIP_SCRIM);
  // A pale garden and a warm sunset read under the same theme with a light touch.
  assert.equal(mainGroundLegibility(modern, frames['bright garden']).calmer, false);
  assert.equal(mainGroundLegibility(modern, frames['warm sunset']).calmer, false);
  // The veil is only as strong as THEIR frame needs — never the theme's own
  // spec panel (Modern's 0.86 would hide a calm clip as thoroughly as a busy one).
  assert.ok(mainGroundLegibility(modern, frames['bright garden']).scrim < (modern.scrim?.opacity ?? 1));
});

/* ── THE OWNER'S BROWSER CHECK, AS ARITHMETIC ──────────────────────────────── */

test('Modern + a warm clip: the buttons shift warm', () => {
  const modern = INVITE_THEMES.galeriya;
  const own = oklchOfHex(hubThemePageTokens(modern).cta);
  const r = resolveAdaptiveTheme(modern, { match: true, frame: frames['warm sunset'] });
  assert.ok(r.tint?.button, 'Modern did not tint its button for a warm clip');
  const next = oklchOfHex(r.tint.button);
  // Modern's own button is olive (hue ≈ 120); a sunset pulls it into the reds/ambers.
  assert.ok(own.H > 100, `Modern's own button hue ${own.H.toFixed(0)} is not the olive this test assumes`);
  assert.ok(next.H >= 20 && next.H <= 90, `tinted button hue ${next.H.toFixed(0)} is not warm`);
  const vars = adaptiveThemeVars(r);
  assert.ok(vars['--color-mulberry'], 'the button var was not emitted');
});

test('toggle off: "Keep the theme\'s colours" emits nothing, so the theme\'s own values stand', () => {
  for (const theme of HUB_THEMES) {
    const frame = frames['warm sunset'];
    const off = resolveAdaptiveTheme(theme, { match: false, frame });
    assert.equal(off.tint, null, `${theme.name}: tint survived the toggle`);
    assert.deepEqual(adaptiveThemeVars(off), {}, `${theme.name}: vars survived the toggle`);
    // …and the scrim is legibility, free and unconditional — it does NOT switch off.
    assert.equal(off.scrim, mainGroundLegibility(theme, frame).scrim);
    // Turning it back on needs no second upload: the frame was kept.
    const on = resolveAdaptiveTheme(theme, { match: true, frame });
    assert.notDeepEqual(adaptiveThemeVars(on), {}, `${theme.name}: back on, nothing tinted`);
  }
});

test('a couple\'s own button colour outranks the automatic tint', () => {
  const r = resolveAdaptiveTheme(INVITE_THEMES.galeriya, { match: true, frame: frames['warm sunset'] });
  const vars = adaptiveThemeVars(r, { ownButton: true });
  assert.equal(vars['--color-mulberry'], undefined);
  assert.ok(vars['--color-gild']);
});

test('neutral footage leaves the theme alone', () => {
  const r = resolveAdaptiveTheme(INVITE_THEMES.gatsby, { match: true, frame: frames['grey fog'] });
  assert.equal(r.tint, null);
  assert.deepEqual(adaptiveThemeVars(r), {});
});

/* ── THE STORED SHAPE ──────────────────────────────────────────────────────── */

test('sanitizeHubTint drops rather than repairs', () => {
  const ok: HubTint = { match: true, frame: ['#aa5533', '#ffffff'] };
  assert.deepEqual(sanitizeHubTint(ok), ok);
  assert.deepEqual(sanitizeHubTint({ frame: ['#AA5533'] }), { match: true, frame: ['#aa5533'] }, 'absent match is ON');
  assert.deepEqual(sanitizeHubTint({ match: false, frame: ['#aa5533'] }), { match: false, frame: ['#aa5533'] });
  assert.equal(sanitizeHubTint({ match: true, frame: ['#aa5533', 'red'] }), null, 'one bad colour is not a frame');
  assert.equal(sanitizeHubTint({ match: true, frame: [] }), null);
  assert.equal(sanitizeHubTint({ match: true, frame: Array(9).fill('#000000') }), null);
  assert.equal(sanitizeHubTint('#aa5533'), null);
  assert.equal(sanitizeHubTint(null), null);
  // The values that reach a stylesheet are hex only — never a string a couple typed.
  assert.equal(sanitizeHubTint({ frame: ['#aa5533;}body{display:none'] }), null);
});
