/**
 * 🌫 ONE SCRIM — SAME DARKNESS EVERYWHERE, NO EDGE, A CLEAN FADE, ONE PARTIAL BLUR.
 *
 * Owner 2026-10-29, verbatim: *"I noticed our scrim when tapped sometime show that the corners/edges brighten showing it
 * is a frame of the screen that pressed. And the darkness of each scrims from different places are different."* · *"And
 * also make sure future scrims are connected to our design. So i dont want it to show edges. Tapping on it will just
 * fade cleanly. When the scrim is on, i want a partial blur to keep focus on the pop up. As well"*.
 *
 * What was wrong, measured: (a) the scrim is a full-screen <button>, and `PressFeel` dipped it to .93 on the tap — the
 * shrunken dark bared an undimmed frame of the page round the screen; (b) seventeen pop-ups drew their own dark —
 * `bg-ink/25` … `bg-ink/50`, `rgba(18,16,22,.45)`, `rgba(25,25,25,.28)`, `rgba(15,17,21,.6)` … — beside the house 42 %.
 *
 * The property, held here so a new scrim cannot drift:
 *   1 · the darkness, the blur and the fade are TOKENS (`--sn-scrim`, `--sn-scrim-solid`, `--sn-scrim-blur`,
 *       `--sn-scrim-fade`) on `:root`, flipped for dark mode on `html.dark` — and `.sn-popup-dark` reads them;
 *   2 · nothing can outline the screen: a scrim is never dipped (`SCRIM_SELECTOR` in `PressFeel`), and the stylesheet
 *       strips the press scale, the dimming, a focus ring, a tap highlight, a border, a radius, a shadow;
 *   3 · `<OverlayBackdrop>` — THE way to draw one — fades out cleanly, skips the fade under "reduce motion", and blurs
 *       only once when two are stacked;
 *   4 · no stylesheet scrim (a `*scrim*` / `*backdrop*` / `*-peek` rule, or any `position: fixed; inset: 0` rule with a
 *       see-through dark) carries a colour or a blur of its own — only the tokens;
 *   5 · no full-screen close layer in a component carries a dark of its own (`bg-ink/40`, `backdrop-blur-sm` …) — it is
 *       `<OverlayBackdrop>`; and nothing that wears `.sn-popup-dark` adds an edge (`rounded-*`, `border`, `ring`,
 *       `shadow`, `outline`).
 * Recorded: corpus `INTERACTION_RULES.md` § 9, "Anything popped up over the page" → "One scrim (2026-10-29)".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SCRIM_SELECTOR, scrimFadeMs } from '@/lib/scrim';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CSS = stripComments(read('app/globals.css'));

function walk(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.test(p) && !p.includes('.test.')) out.push(p);
  }
  return out;
}
const FILES = (ext: RegExp) => [...walk(join(WEB, 'app'), ext), ...walk(join(WEB, 'components'), ext)];

/** The value of a custom property in the first block whose selector is exactly `sel`. */
function tokenIn(css: string, sel: string, name: string): string | undefined {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1]!.trim() !== sel) continue;
    const v = new RegExp(`(?:^|;|\\s)${name}:\\s*([^;]+);`).exec(m[2]!)?.[1]?.trim();
    if (v) return v;
  }
  return undefined;
}

test('1 · the darkness, the blur and the fade are tokens — light on :root, dark mode on html.dark — and the one class reads them', () => {
  const light = tokenIn(CSS, ':root', '--sn-scrim');
  const lightSolid = tokenIn(CSS, ':root', '--sn-scrim-solid');
  const a = Number(/rgb\(var\(--color-ink\) \/ (0?\.\d+)\)/.exec(light ?? '')?.[1]);
  const aSolid = Number(/rgb\(var\(--color-ink\) \/ (0?\.\d+)\)/.exec(lightSolid ?? '')?.[1]);
  assert.ok(a >= 0.35 && a <= 0.6, `--sn-scrim is ${light} — not the house dark (the page's ink, 35–60 %)`);
  assert.ok(aSolid > a, 'the no-blur dark is not deeper than the blurred one');
  const blur = Number(/^(\d+)px$/.exec(tokenIn(CSS, ':root', '--sn-scrim-blur') ?? '')?.[1]);
  assert.ok(blur >= 4 && blur <= 6, `--sn-scrim-blur is ${blur}px — the owner asked for a PARTIAL blur (4–6 px)`);
  const fade = scrimFadeMs(tokenIn(CSS, ':root', '--sn-scrim-fade') ?? '');
  assert.ok(fade >= 150 && fade <= 300, `--sn-scrim-fade is ${fade}ms — a clean fade is ~200 ms`);
  /* Dark mode: ink turns LIGHT there, so the dark is black (deeper), on the tokens themselves. */
  const dark = tokenIn(CSS, 'html.dark', '--sn-scrim');
  const darkSolid = tokenIn(CSS, 'html.dark', '--sn-scrim-solid');
  assert.match(dark ?? '', /^rgb\(0 0 0 \/ 0?\.\d+\)$/, 'dark mode has no scrim of its own — the ink-based dark would LIGHTEN the page');
  assert.match(darkSolid ?? '', /^rgb\(0 0 0 \/ 0?\.\d+\)$/);
  /* The one class, and the two panels' scrims, read nothing but the tokens. */
  const base = /\.sn-popup-dark \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(base, /background-color: var\(--sn-scrim\);/);
  assert.match(base, /(?:^|\s)backdrop-filter: blur\(var\(--sn-scrim-blur\)\);/);
  assert.match(base, /-webkit-backdrop-filter: blur\(var\(--sn-scrim-blur\)\);/, 'iOS Safari would not blur');
  for (const cls of ['.sn-side-panel-scrim', '.sn-inspector-peek']) {
    const body = new RegExp(`(?:^|\\})\\s*\\${cls} \\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
    assert.match(body, /background: var\(--sn-scrim\);/, `${cls} has a dark of its own`);
    assert.match(body, /-webkit-backdrop-filter: blur\(var\(--sn-scrim-blur\)\);/, `${cls} has a blur of its own`);
  }
  /* No dark-mode rule paints a scrim of its own any more — the tokens flip. */
  assert.doesNotMatch(CSS, /html\.dark \.(?:sn-popup-dark|sn-side-panel-scrim|sn-inspector-peek)[^{]*\{[^}]*background/, 'a dark-mode scrim colour beside the token');
});

test('2 · nothing outlines the screen: a scrim is never dipped, ringed, highlighted, bordered, rounded or shadowed', async () => {
  const classes = SCRIM_SELECTOR.split(',').map((s) => s.trim()).filter((s) => s.startsWith('.'));
  assert.deepEqual(classes, ['.sn-popup-dark', '.sn-side-panel-scrim', '.sn-inspector-peek']);
  const rest = new RegExp(`${classes.map((c) => `\\${c}`).join(',\\s*')}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
  for (const rule of [
    /-webkit-tap-highlight-color: transparent;/,
    /(?:^|\s)user-select: none;/,
    /-webkit-user-select: none;/,
    /border: 0;/,
    /border-radius: 0;/,
    /outline: none;/,
    /box-shadow: none;/,
  ]) assert.match(rest, rule, `the one scrim's resting rule lost ${rule}`);
  const pressed = new RegExp(`${classes.map((c) => `\\${c}:is\\(:active, :focus, :focus-visible\\)`).join(',\\s*')}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
  for (const rule of [/scale: none !important;/, /filter: none !important;/, /outline: none !important;/, /box-shadow: none !important;/]) {
    assert.match(pressed, rule, `a pressed or focused scrim can paint again — ${rule}`);
  }
  /* The listener that dips every control skips a scrim. */
  const { pressable } = await import('../app/_components/press-feel');
  const asScrim = (sel: string) => ({ closest: () => null, matches: (s: string) => s === SCRIM_SELECTOR && sel !== '' });
  assert.equal(pressable(asScrim('[data-overlay-backdrop]')), false, 'the press feel dips the scrim — its edges flash as a frame of the page');
  assert.equal(pressable({ closest: () => null, matches: () => false }), true, 'anti-vacuity: an ordinary control no longer presses');
  assert.match(stripComments(read('app/_components/press-feel.tsx')), /!el\.matches\(SCRIM_SELECTOR\)/);
  /* Two stacked scrims blur once. */
  assert.match(CSS, /\.sn-popup-dark\[data-scrim-stacked\] \{\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;\s*\}/, 'a second scrim blurs again — two blurred layers on a phone');
});

test('3 · <OverlayBackdrop> wears the one class, fades out cleanly (not under reduce-motion) and blurs only once when stacked', () => {
  const src = stripComments(read('app/_components/overlay-backdrop.tsx'));
  assert.match(src, /className=\{`sn-popup-dark fixed inset-0 /, 'the backdrop does not wear the one scrim');
  assert.match(src, /data-overlay-backdrop=""/);
  assert.match(src, /document\.querySelectorAll\(SCRIM_SELECTOR\)/, 'it cannot see a scrim already up');
  assert.match(src, /setAttribute\('data-scrim-stacked', ''\)/, 'a stacked scrim blurs again');
  assert.match(src, /return \(\) => fadeOutCopy\(el, z\);/, 'the dark cuts out instead of fading');
  assert.match(src, /prefers-reduced-motion: reduce/, 'the fade plays under "reduce motion"');
  assert.match(src, /getPropertyValue\('--sn-scrim-fade'\)/, 'the fade has a length of its own, not the token');
  assert.match(src, /\[\{ opacity: 1 \}, \{ opacity: 0 \}\]/, 'the leaving dark is not an opacity fade');
  assert.match(src, /setAttribute\('data-scrim-leaving', ''\)/);
  assert.match(CSS, /\.sn-popup-dark\[data-scrim-leaving\] \{\s*pointer-events: none;\s*\}/, 'the fading copy swallows the next tap');
  assert.doesNotMatch(src, /bg-|rounded|ring-|shadow|outline|border/, 'the backdrop carries a colour or an edge of its own');
});

/* ── 4 · stylesheets ───────────────────────────────────────────────────────────────────────────────────────────── */

const LITERAL = /rgba?\(\s*(?!var)[\d.]|#[0-9a-f]{3,8}\b|hsla?\(/i;
const NAMED = /scrim|backdrop(?!-filter)|-peek\b/i;
/** Legibility scrims over a photo (a gradient, or the Event Hub's own measured `--hub-scrim`) are not pop-up scrims. */
const LEGIBILITY = /gradient|var\(--hub-scrim/;
/** A see-through dark on a full-screen layer: every channel low, alpha below 1. */
function seeThroughDark(v: string): boolean {
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*[,/]\s*(0?\.\d+|\d+%)\s*\)/.exec(v);
  if (!m) return /rgb\(var\(--color-ink\)\s*\/\s*0?\.\d+\)/.test(v);
  const [r, g, b] = [m[1], m[2], m[3]].map(Number);
  return r! < 80 && g! < 80 && b! < 80;
}

/**
 * CSS has BLOCK comments only. `stripComments` (the JS/TS one) would read an unquoted `url(https://…)` as a line
 * comment and blank the rest of the line — so for stylesheets, block comments alone, and an unclosed one is kept.
 */
function stripCssComments(css: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const open = css.indexOf('/*', i);
    const close = open < 0 ? -1 : css.indexOf('*/', open + 2);
    if (open < 0 || close < 0) return out + css.slice(i);
    out += css.slice(i, open) + ' ';
    i = close + 2;
  }
}

/** Every stylesheet rule that paints a scrim of its own. `src` is CSS (a .css file or a `<style>` string in a .tsx). */
export function privateScrims(src: string): string[] {
  const bad: string[] = [];
  const css = stripCssComments(src);
  for (const m of css.matchAll(/([^{}`;]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim().replace(/\s+/g, ' ');
    const body = m[2]!;
    if (!/(?:^|;|\s)(?:background|background-color|box-shadow|backdrop-filter|-webkit-backdrop-filter)\s*:/.test(body)) continue;
    const named = NAMED.test(sel);
    const fullScreen = /position\s*:\s*fixed/.test(body) && /(?:^|;|\s)inset\s*:\s*0(?:px)?\s*(?:;|$)/.test(body);
    if (!named && !fullScreen) continue;
    /* An unnamed full-screen layer is a scrim only if it is a see-through DARK — a light veil (a loader's paper wash)
       is not one, blur or no blur. */
    if (!named && ![...body.matchAll(/(?:^|;|\s)(?:background|background-color)\s*:\s*([^;]+)/g)].some((d) => seeThroughDark(d[1]!))) continue;
    for (const d of body.matchAll(/(?:^|;|\s)(background|background-color|box-shadow|backdrop-filter|-webkit-backdrop-filter)\s*:\s*([^;]+)/g)) {
      const [prop, value] = [d[1]!, d[2]!.trim()];
      if (LEGIBILITY.test(value)) continue;
      if (/backdrop-filter/.test(prop)) {
        if (/blur\(\s*\d/.test(value)) bad.push(`${sel} { ${prop}: ${value} } — the blur is var(--sn-scrim-blur)`);
        continue;
      }
      if (named ? LITERAL.test(value) || /rgb\(var\(--color-ink\)/.test(value) : seeThroughDark(value)) {
        bad.push(`${sel} { ${prop}: ${value} } — the dark is var(--sn-scrim)`);
      }
    }
  }
  return bad;
}

/**
 * Stylesheet "scrims" that are deliberately NOT the pop-up scrim — each with its reason. Only ever shrinks.
 */
const NOT_A_POPUP_SCRIM = new Map<string, string>([]);

test('4 · no stylesheet scrim paints a dark or a blur of its own — only the tokens', () => {
  const bad: string[] = [];
  let seenCss = 0;
  for (const f of FILES(/\.css$/)) {
    seenCss += 1;
    const rel = relative(WEB, f);
    for (const b of privateScrims(readFileSync(f, 'utf8'))) if (!NOT_A_POPUP_SCRIM.has(`${rel} ${b}`)) bad.push(`${rel}: ${b}`);
  }
  /* CSS kept in a component (`<style>{`…`}</style>`, a `const X_CSS = \`…\``): its template strings. */
  for (const f of FILES(/\.tsx$/)) {
    const rel = relative(WEB, f);
    for (const t of readFileSync(f, 'utf8').matchAll(/`([^`]*\{[^`]*\}[^`]*)`/g)) {
      for (const b of privateScrims(t[1]!)) if (!NOT_A_POPUP_SCRIM.has(`${rel} ${b}`)) bad.push(`${rel}: ${b}`);
    }
  }
  assert.ok(seenCss > 5, 'anti-vacuity: the stylesheets were not found');
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('4b · the stylesheet check sees the scrims it was written for — and not a photo’s legibility gradient', () => {
  assert.equal(privateScrims('.x-scrim{position:fixed;inset:0;background:rgba(18,16,22,.45)}').length, 1);
  assert.equal(privateScrims('.ug-backdrop { background: rgba(25, 25, 25, 0.28); }').length, 1);
  assert.equal(privateScrims('.sn-x-peek { background: rgb(var(--color-ink) / 0.42); backdrop-filter: blur(6px); }').length, 2);
  assert.equal(privateScrims('.anything{position:fixed;inset:0;background:rgba(15,17,21,.6)}').length, 1, 'an unnamed full-screen dark');
  assert.equal(privateScrims('.ring{box-shadow:0 0 0 9999px rgba(15,17,21,.64)}').length, 0, 'not a scrim by name or by shape');
  assert.equal(privateScrims('.x-scrim{background:var(--sn-scrim);backdrop-filter:blur(var(--sn-scrim-blur))}').length, 0);
  assert.equal(privateScrims('.svc-scrim{background:linear-gradient(to top,rgba(18,16,14,.92),transparent)}').length, 0);
  assert.equal(privateScrims('.sheet{position:fixed;inset:0;background:var(--paper)}').length, 0, 'an opaque full-screen page');
  assert.equal(privateScrims('.reel{position:fixed;inset:0;background:#000}').length, 0, 'an opaque black stage is not see-through');
  assert.equal(privateScrims('.veil{position:fixed;inset:0;background:color-mix(in srgb,var(--paper) 86%,transparent);backdrop-filter:blur(7px)}').length, 0, 'a loader’s light veil');
  assert.equal(privateScrims('.dim{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(7px)}').length, 2, 'an unnamed dark and its blur');
});

/* ── 5 · components ────────────────────────────────────────────────────────────────────────────────────────────── */

const DIM = /(?:^|\s)(?:bg-(?:black|ink|stone-9\d\d|neutral-9\d\d|zinc-9\d\d|gray-9\d\d|slate-9\d\d)\/(?:\d+|\[[^\]]+\])|bg-\[rgba?\([^\]]*\)\]|backdrop-blur(?:-[a-z0-9[\].]+)?)(?=\s|$)/;
const EDGE = /(?:^|\s)(?:rounded(?:-[a-z0-9[\]]+)?|border(?:-[a-z0-9/[\]]+)?|ring(?:-[a-z0-9/[\]]+)?|shadow(?:-[a-z0-9[\]]+)?|outline(?:-[a-z0-9]+)?)(?=\s|$)/;

/** Full-screen close layers with a dark of their own, and one-scrim layers given an edge. */
export function handMadeScrims(src: string): string[] {
  const bad: string[] = [];
  const code = stripComments(src);
  for (const m of code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const cls = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
    const tagStart = code.lastIndexOf('<', m.index);
    const tag = code.slice(tagStart, m.index);
    const closer = /^<button\b/.test(tag) || /\sonClick=/.test(tag);
    if (/\binset-0\b/.test(cls) && DIM.test(cls) && (closer || /\bfixed\b/.test(cls))) bad.push(`a dark of its own — "${cls.trim()}" → <OverlayBackdrop>`);
    if (/\bsn-popup-dark\b/.test(cls) && EDGE.test(cls)) bad.push(`an edge on the scrim — "${cls.trim()}"`);
  }
  return bad;
}

test('5 · no full-screen close layer draws a dark of its own, and nothing that wears the one scrim gets an edge', () => {
  const bad: string[] = [];
  for (const f of FILES(/\.tsx$/)) {
    if (relative(WEB, f) === 'app/_components/overlay-backdrop.tsx') continue;
    for (const b of handMadeScrims(readFileSync(f, 'utf8'))) bad.push(`${relative(WEB, f)}: ${b}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('5b · the component check sees the scrims it was written for — and not a tile’s own shade', () => {
  assert.equal(handMadeScrims('<button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />').length, 1);
  assert.equal(handMadeScrims('<div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />').length, 1);
  assert.equal(handMadeScrims('<div className="fixed inset-0 z-50 bg-ink/35" />').length, 1);
  assert.equal(handMadeScrims('<button className={`absolute inset-0 ${x ? "a" : "b"} bg-ink/30`} onClick={c} />').length, 1);
  assert.equal(handMadeScrims('<span className="sn-popup-dark absolute inset-0 rounded-2xl" />').length, 1, 'an edge on the scrim');
  assert.equal(handMadeScrims('<OverlayBackdrop onClose={onClose} className="lg:hidden" />').length, 0);
  assert.equal(handMadeScrims('<span className="absolute inset-0 flex items-center justify-center bg-ink/45">3</span>').length, 0, 'a tile’s countdown shade');
  assert.equal(handMadeScrims('<button className="absolute inset-0 hidden cursor-default lg:block" onClick={c} />').length, 0, 'a clear catcher');
});
