#!/usr/bin/env node
/**
 * lint-label-on-fill-contrast.mjs
 *
 * Fails when a piece of TEXT is placed on a SOLID FILL that it cannot be read
 * against — contrast below the WCAG AA floor of 4.5:1 for normal-size text.
 *
 * WHY THIS GUARD EXISTS (2026-08-08 · the gold ruling):
 * The owner ruled "stick to gold to all first", which moved every primary
 * action onto the standard gold `#A9834B`. Measured against it:
 *
 *     cream  #FDFBF7 on gold-500 #A9834B  →  3.37:1   FAILS
 *     white  #FFFFFF on gold-500 #A9834B  →  3.48:1   FAILS
 *     cream  #FDFBF7 on gold-700 #8C6932  →  4.86:1   passes
 *
 * That is why the palette lock says gold is "UI only" — eyebrows, bars, dots,
 * borders, where nothing sits ON it. The moment a word lands on gold-500 it
 * becomes unreadable, and NOTHING in the stack notices: it compiles, it
 * renders, it looks broadly right in a screenshot, and only a person with
 * ordinary eyesight in ordinary light discovers it. The near-fix is worse than
 * the bug — a first pass here was going to swap `text-white` for `text-cream`
 * on 34 buttons, which moves 3.48 → 3.37 and makes legibility marginally WORSE
 * while looking like a fix in the diff.
 *
 * 🔑 A COLOUR PAIRING IS AN ARITHMETIC CLAIM, SO CHECK THE ARITHMETIC. Every
 * previous defence of this was a sentence in a doc ("gold is UI only"), and a
 * sentence is not a mechanism — the same lesson as the CSP frame-src list that
 * said "new embed origins later extend this one list" while our own map stayed
 * blocked for months.
 *
 * 🔑 DERIVED, NEVER RE-TYPED. Both sides of every comparison are read out of
 * the real sources — `globals.css` `:root` for the CSS custom properties and
 * `tailwind.config.ts` for the palette scales. A guard that compares two
 * hand-typed hexes only proves that someone typed the same thing twice; when
 * the token moves, this guard moves with it.
 *
 * 🔑 THIS IS THE CALL-SITE HALF OF A PAIR. `lib/palette-lock.test.ts` already
 * computes contrast, and correctly — but it checks the TOKEN DEFINITIONS: is
 * the CTA readable against the label the app renders, does gold have a
 * text-safe escalation, and so on. It was green throughout, and it was right
 * to be: every token here is fine in isolation. What it cannot see is which
 * pairs of tokens a developer actually put together in a file, which is where
 * all 76 failures lived — including a 1.93:1 badge that used gold-300 on
 * gold-100, two tokens the lock test approves individually. Keep both: the
 * lock test guards the palette, this guards the usage.
 *
 * NOT A BRAND CHECK. `text-white` on the deep gold measures 5.02:1 and passes
 * here, though the palette lock says labels are cream and never pure white.
 * That is a brand rule, not a legibility one; it lives in
 * `lib/palette-lock.test.ts`. Do not fold it in — a guard that fails for two
 * unrelated reasons gets read as noise.
 *
 * SCOPE / DELIBERATE LIMITS
 *  - BOTH THEMES since 2026-10-13 (dark mode PR 2, owner "approve all"). Light
 *    is judged exactly as before and stays blocking with no baseline. DARK is a
 *    second pass: the palette is resolved again with the `html.dark` token
 *    blocks layered on top, a `dark:` class OVERRIDES its base instead of being
 *    stripped, and an `html.dark <selector>` rule overrides that selector's own
 *    rule. Dark keeps its own ratchet (`label-contrast-dark.baseline.json`,
 *    counts per `file · pair`) that may only go DOWN — it is the to-do list the
 *    area PRs work through. The guest Event Hub is not judged in dark: dark
 *    never reaches it (owner call 5) — `app/[slug]` and the Hub-scoped CSS.
 *  - Only pairings where BOTH sides resolve to an opaque colour are judged.
 *    An alpha modifier (`bg-terracotta/10`) composites against an unknown
 *    parent, so it is skipped rather than guessed at — guessing would cry wolf,
 *    and a guard that cries wolf teaches you to skim past the time it is right.
 *  - 4.5:1 is applied uniformly. AA permits 3:1 for large text, but every
 *    fill+label pairing in this codebase is a button, badge or pill at normal
 *    size, so the stricter floor costs nothing and removes a judgement call.
 *
 * NO BASELINE, ON PURPOSE. Every site in the tree passes as of 2026-08-08, so
 * this starts at zero and stays there. A baseline is a bill, not a decision:
 * adding a line to one means deciding that somebody reads unreadable text until
 * further notice.
 *
 * Usage:
 *   pnpm lint:contrast
 *   node scripts/lint-label-on-fill-contrast.mjs
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { stripComments } from './port-controls.mjs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];
const AA_NORMAL_TEXT = 4.5;

/* ── colour maths (WCAG 2.1 relative luminance + contrast ratio) ─────────── */

function srgbToLinear(channel8bit) {
  const c = channel8bit / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrast(rgbA, rgbB) {
  const a = luminance(rgbA);
  const b = luminance(rgbB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function parseHex(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)].map((p) => parseInt(p, 16));
}

/* ── read the real tokens out of the real sources ───────────────────────── */

/**
 * `--color-terracotta-700: 140 105 50;`, `--sn-gold-700: #8A6B39;`, and the
 * aliases — `--ug-lock: var(--m-orange-2, #a88340);`.
 *
 * 🪤 ALIASES ARE WHY THIS READS EVERY STYLESHEET AND RESOLVES INDIRECTION.
 * A first cut read only `globals.css` and only literal values, and it passed a
 * pairing that is 4.21:1 — the admin UGAT console paints `--ug-lock` on
 * `--ug-gold-soft`, both declared in its own `ugat-console.css` as `var()`
 * aliases pointing at the very gold/wash pair that was failing everywhere else.
 * Same defect, one level of indirection and one file away, and the guard was
 * silent about it. A guard that only understands values it can read literally
 * reports "all clear" for everything it cannot parse.
 */
function readCssVars(mode = 'light') {
  const files = [];
  const collectCss = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) collectCss(full);
      else if (entry.endsWith('.css')) files.push(full);
    }
  };
  for (const dir of ['app', 'components', 'styles']) collectCss(join(WEB_ROOT, dir));

  // Pass 1 — collect raw declarations. First definition wins, which is what the
  // cascade does for :root and keeps us in light mode (the dark block is later).
  const raw = new Map();
  for (const file of files.sort()) {
    const css = readFileSync(file, 'utf8');
    const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m;
    while ((m = re.exec(css))) if (!raw.has(m[1])) raw.set(m[1], m[2].trim());
  }

  // Pass 1b (DARK only) — layer the theme's dark blocks on top: `html.dark { … }`
  // and the shell's `html.dark .fd { … }` (the shell scope is read as global in
  // light too). First dark definition wins, the same as light. A SCOPED dark
  // block (`html.dark .sn-tile-dark { --sn-gold-100: … }`) is a local island,
  // not the theme, so it is deliberately NOT read here.
  if (mode === 'dark') {
    const darkSeen = new Set();
    for (const file of files) {
      const css = stripComments(readFileSync(file, 'utf8'));
      for (const b of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/^\s*html\.dark(\s+\.fd)?\s*$/.test(b[1])) continue;
        for (const d of b[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
          if (darkSeen.has(d[1])) continue;
          darkSeen.add(d[1]);
          raw.set(d[1], d[2].trim());
        }
      }
    }
  }

  // Pass 2 — resolve to rgb, following `var(--x)` / `var(--x, fallback)` chains.
  const vars = new Map();
  const resolve = (name, seen = new Set()) => {
    if (vars.has(name)) return vars.get(name);
    if (seen.has(name)) return null; // cycle
    seen.add(name);
    const value = raw.get(name);
    if (!value) return null;
    const triple = value.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
    if (triple) {
      const rgb = [Number(triple[1]), Number(triple[2]), Number(triple[3])];
      vars.set(name, rgb);
      return rgb;
    }
    const literal = value.match(/^#[0-9a-f]{3,6}$/i);
    if (literal) {
      const rgb = parseHex(literal[0]);
      if (rgb) vars.set(name, rgb);
      return rgb;
    }
    // `var(--other)` or `var(--other, #fallback)` — prefer the alias target,
    // fall back to the literal default the same way a browser would.
    const alias = value.match(/^var\(\s*--([a-z0-9-]+)\s*(?:,\s*(#[0-9a-f]{3,6})\s*)?\)$/i);
    if (alias) {
      const viaTarget = resolve(alias[1], seen);
      const rgb = viaTarget ?? (alias[2] ? parseHex(alias[2]) : null);
      if (rgb) vars.set(name, rgb);
      return rgb;
    }
    return null; // color-mix, rgba with alpha, gradients — see SCOPE
  };
  for (const name of raw.keys()) resolve(name);
  return vars;
}

/**
 * Flatten the tailwind `colors: { … }` block into `terracotta-700 → rgb`,
 * following `rgb(var(--x) / <alpha-value>)` indirection through the CSS vars.
 * Brace-depth walk rather than a regex over the whole block, because the block
 * is nested and heavily commented.
 */
function readTailwindPalette(cssVars) {
  const src = readFileSync(join(WEB_ROOT, 'tailwind.config.ts'), 'utf8');
  const start = src.indexOf('colors: {');
  if (start === -1) throw new Error('lint-contrast: no `colors: {` block in tailwind.config.ts');

  const palette = new Map();
  const stack = [];
  let depth = 0;
  let i = src.indexOf('{', start);
  let line = '';

  const resolve1 = (value) => {
    const viaVar = value.match(/rgb\(\s*var\(--([a-z0-9-]+)\)/i);
    if (viaVar) return cssVars.get(viaVar[1]) ?? null;
    const hex = value.match(/#[0-9a-f]{3,6}/i);
    return hex ? parseHex(hex[0]) : null;
  };

  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\n') {
      // A `key: 'value',` line at the current depth.
      const kv = line.match(/^\s*'?([A-Za-z0-9-]+)'?\s*:\s*'([^']+)'\s*,?\s*(?:\/\/.*)?$/);
      if (kv) {
        const [, key, value] = kv;
        const rgb = resolve1(value);
        if (rgb) {
          const name = key === 'DEFAULT' ? stack.join('-') : [...stack, key].join('-');
          if (name) palette.set(name, rgb);
        }
      }
      // A `key: {` line opens a scale.
      const open = line.match(/^\s*'?([A-Za-z0-9-]+)'?\s*:\s*\{\s*$/);
      if (open) stack.push(open[1]);
      line = '';
      continue;
    }
    line += ch;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (stack.length) stack.pop();
      if (depth === 0) break;
    }
  }

  // Tailwind's own always-available literals.
  palette.set('white', [255, 255, 255]);
  palette.set('black', [0, 0, 0]);
  return palette;
}

/* ── find the pairings ──────────────────────────────────────────────────── */

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Pull `bg-X` / `text-X` out of one className. An alpha modifier (`bg-x/40`)
 * or an arbitrary value (`bg-[#fff]`) yields nothing — see SCOPE above.
 */
function classPairing(className, palette, mode = 'light') {
  const tokens = className.split(/\s+/);
  let fill = null;
  let label = null;
  // DARK: a bare `dark:bg-x` / `dark:text-x` is what dark paints, so it REPLACES
  // the base class of its kind (read after the base, below). A stacked variant
  // (`dark:hover:`, `md:dark:`) is a state, left out the same as `hover:`.
  let darkFill = null;
  let darkLabel = null;
  if (mode === 'dark') {
    for (const raw of tokens) {
      const d = raw.match(/^dark:(bg|text)-([a-z0-9-]+)$/);
      if (!d || !palette.has(d[2])) continue;
      if (d[1] === 'bg') darkFill = { name: 'dark:bg-' + d[2], rgb: palette.get(d[2]) };
      else darkLabel = { name: 'dark:text-' + d[2], rgb: palette.get(d[2]) };
    }
  }
  for (const raw of tokens) {
    const t = raw.replace(/^(hover|focus|active|group-hover|disabled|dark|sm|md|lg|xl):.*/, '');
    if (!t) continue;
    if (t.includes('/') || t.includes('[')) continue;
    const bg = t.match(/^bg-([a-z0-9-]+)$/);
    if (bg && palette.has(bg[1])) {
      if (fill && fill.name !== bg[1]) return null; // two fills → can't tell
      fill = { name: bg[1], rgb: palette.get(bg[1]) };
    }
    const fg = t.match(/^text-([a-z0-9-]+)$/);
    // `text-terracotta` paints the accent's deepest step (tailwind textColor) in
    // BOTH themes, so dark reads that step's DARK value (merge of #6499 + PR 2).
    const textOver = mode === 'dark' ? DARK_TEXT_PALETTE : TEXT_PALETTE;
    const fgRgb = fg ? (textOver.get(fg[1]) ?? palette.get(fg[1])) : null;
    if (fg && fgRgb) {
      if (label && label.name !== fg[1]) return null;
      label = { name: fg[1], rgb: fgRgb };
    }
  }
  if (darkFill) fill = darkFill;
  if (darkLabel) label = darkLabel;
  return fill && label ? { fill, label } : null;
}

/**
 * `{ bg: 'rgba(169,131,75,.12)', fg: 'var(--m-orange-2)' }` — a colour PAIR held
 * in an object and applied later through a variable (`style={{ background:
 * chip.bg, color: chip.fg }}`).
 *
 * 🪤 THIS WAS A BLIND SPOT, AND IT LET ME SHIP THE VERY BUG I HAD JUST SWEPT.
 * Recolouring the vendor calendar's chip map put THREE labels back on a wash of
 * their own colour — 4.25:1, 4.14:1 and 4.04:1 — and this guard reported all
 * clear, because it only understood a literal `background:…, color:…` adjacency
 * and a Tailwind className. A style OBJECT names the same two colours; only the
 * keys differ.
 *
 * 🔑 THE PATTERN A GUARD CANNOT SEE IS THE PATTERN PEOPLE WILL USE. Named colour
 * maps are the natural way to write a six-state chip table, so the most
 * structured colour code in the repo was the least protected.
 *
 * ALPHA IS COMPOSITED AGAINST THE PAGE, not skipped as it is for Tailwind
 * classes. A chip wash is `rgba(gold, .12)` on the cream page essentially
 * everywhere, and skipping it would leave exactly this table unchecked again.
 * The composite is an assumption, so it is only made for a low-alpha fill —
 * above 0.6 the parent dominates and this stays out of it.
 */
function objectPairings(src, resolveColor) {
  const out = [];
  const re =
    /\bbg\s*:\s*'([^']+)'\s*,\s*fg\s*:\s*'([^']+)'|\bfg\s*:\s*'([^']+)'\s*,\s*bg\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    const rawFill = m[1] ?? m[4];
    const rawLabel = m[2] ?? m[3];
    const fill = resolveColor(rawFill);
    const label = resolveColor(rawLabel);
    if (!fill || !label) continue;
    out.push({
      index: m.index,
      fill: { name: rawFill, rgb: fill },
      label: { name: rawLabel, rgb: label },
    });
  }
  return out;
}

/** `background: 'var(--sn-gold-700)', color: '#FDFBF7'` — inline-styled buttons. */
function inlinePairings(src, cssVars) {
  const out = [];
  const re = /background:\s*'(?:var\(--([a-z0-9-]+)\)|(#[0-9a-f]{3,6}))'\s*,\s*color:\s*'(?:var\(--([a-z0-9-]+)\)|(#[0-9a-f]{3,6}))'/gi;
  let m;
  while ((m = re.exec(src))) {
    const fillRgb = m[1] ? cssVars.get(m[1]) : parseHex(m[2]);
    const labelRgb = m[3] ? cssVars.get(m[3]) : parseHex(m[4]);
    if (!fillRgb || !labelRgb) continue;
    out.push({
      index: m.index,
      fill: { name: m[1] ?? m[2], rgb: fillRgb },
      label: { name: m[3] ?? m[4], rgb: labelRgb },
    });
  }
  return out;
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

/* ── run ────────────────────────────────────────────────────────────────── */

const cssVars = readCssVars();

const PAGE = cssVars.get('m-paper') ?? cssVars.get('color-cream') ?? [253, 251, 247];

/** hex · `var(--x)` · low-alpha `rgba(r,g,b,a)` composited on the page. */
const resolveColor = makeResolveColor(cssVars, PAGE);
function makeResolveColor(cssVars, PAGE) {
  return function resolveColor(raw) {
    const v = raw.trim();
    const hex = v.match(/^#[0-9a-f]{3,6}$/i);
    if (hex) return parseHex(hex[0]);
    const varRef = v.match(/^var\(\s*--([a-z0-9-]+)/i);
    if (varRef) return cssVars.get(varRef[1]) ?? null;
    // `rgb(var(--x))` — a token held as three numbers (`--color-mulberry: 194 78 37`, `--sn-accent`), the way every
    // Tailwind-facing token in globals.css is written. Until 2026-10-08 this form was unreadable here, so a rule
    // that paired two such tokens was skipped in silence — the very blind spot the note above `readCssVars` names.
    // Opaque only: `rgb(var(--x) / .4)` is translucent and is skipped before it reaches this function.
    const rgbVar = v.match(/^rgb\(\s*var\(\s*--([a-z0-9-]+)\s*\)\s*\)$/i);
    if (rgbVar) return cssVars.get(rgbVar[1]) ?? null;
    const rgba = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)$/i);
    if (rgba) {
      const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
      const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
      if (a > 0.6) return [r, g, b]; // effectively opaque
      return [r, g, b].map((c, i) => Math.round(a * c + (1 - a) * PAGE[i]));
    }
    return null;
  };
}
/** Every `.css` under the scanned trees — `walk` is hardcoded to `.tsx`. */
function walkCss(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (entry.endsWith('.css')) out.push(full);
  }
  return out;
}

/** Split a selector list on its TOP-LEVEL commas (not the ones inside `:is(…)`). */
function splitSelectors(list) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Selectors that only ever paint inside the guest Event Hub — never in dark (owner call 5, 2026-10-13). */
const HUB_SCOPED = /\.sn-editorial|\[data-hub-theme|\.hub-|\.pahina|\[data-hero-design|\[data-part-look|\[data-maker-guest/;

/**
 * PAIRINGS DECLARED IN CSS ITSELF — `.x { background: var(--gold); color: #fff }`.
 *
 * WHY THIS EXISTS. Until 2026-09-23 this guard read Tailwind classes, style
 * objects and inline styles, all of them in `.tsx`. A pairing written as a CSS
 * RULE was invisible to it, and one sat in the tree the whole time:
 * `.app-surface .button-primary` painted #FFFDF8 on --sn-gold-500, 3.42:1, on
 * every primary button in the supplier dashboard. It was found by eye, months
 * late. Reading `.css` for VARIABLES while never reading it for PAIRINGS was the
 * blind spot.
 *
 * AND THE STATE RULE INHERITS ITS LABEL. `.x:hover { background: … }` sets no
 * colour; the text still comes from `.x`. That button failed at rest (3.42) AND
 * on hover (4.39), so a scan reading only blocks that declare BOTH properties
 * would have caught one of the two - and would pass a button that reads at rest
 * and fails the moment a thumb lands on it, which nobody screenshots. So a
 * background-only state rule is paired with its base selector's colour.
 *
 * Innermost-block matching steps over `@media` and `@layer` wrappers without
 * needing to understand them.
 */
function cssRulePairings(rawCss, resolveColor, mode = 'light') {
  // Comments first, or a block comment containing braces is parsed as a rule and
  // its prose becomes a selector. The first cut reported three "failures" whose
  // selector was the inside of a comment explaining an unrelated fix.
  //
  // 🔑 THE REPO'S ONE STRIPPER, not a private regex — `lint-one-comment-stripper`
  // blocks a second copy, and this file had grown one. It is also more accurate:
  // a `.replace(…, '')` DELETES the comment and shifts every index after it, so
  // the reported line was wrong by however much comment preceded it —
  // `.m-btn-orange` was announced at :399 and lives at :1370. `stripComments`
  // blanks in place, so a character offset still points at the same character in
  // the RAW file.
  //
  // ⚠ THE SCAN HAS A BLIND SPOT, AND IT IS RULE-SHAPED, NOT TEXT-SHAPED.
  // A rule whose background carries `url(...)` is dropped entirely by the
  // `gradient|url\(|transparent|...` skip below, because the `background`
  // shorthand then no longer resolves to a single colour. **Quoted or
  // unquoted makes no difference** — the rule never reaches the measurement,
  // so its colour pair is never checked.
  //
  // 🔑 THIS IS NOT A STRIPPER PROBLEM, AND AN EARLIER VERSION OF THIS NOTE SAID
  // IT WAS. The tempting theory is that a JS stripper eats an unquoted
  // `url(https://…)` as a line comment. It does not explain anything here: a
  // QUOTED url is skipped too, which no stripper touches. Isolated 2026-09-23
  // with a four-case fixture — `color`+`background-color` convicts, adding an
  // unquoted url does not, adding a QUOTED url does not, plain hex convicts
  // again. A language-correct CSS stripper would not close this hole.
  //
  // Today NO rule in the tree both carries a `url()` and sets a colour pair, so
  // nothing is being missed. It fails silently the day one does. Re-measure —
  // this prints 0 today and finds a seeded one, so a zero here is a
  // measurement and not a silence:
  //
  //   node -e '
  //     const {readFileSync}=require("fs"),{execSync}=require("child_process");
  //     for (const f of execSync("find apps/web/app apps/web/components -name \"*.css\"")
  //            .toString().split("\n").filter(Boolean)) {
  //       const css=readFileSync(f,"utf8").replace(/\/\*[\s\S]*?\*\//g,"");
  //       for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
  //         if (/background(-color)?\s*:[^;]*url\(/i.test(m[2]) &&
  //             /(^|;)\s*color\s*:/i.test(m[2])) console.log(f+" \u00b7 "+m[1].trim());
  //     }'
  //
  //
  // And it is quote-aware, which matters here: the `http://` inside globals.css's
  // quoted `url("data:image/svg+xml,…")` survives. A naive line-comment pass
  // would have eaten the rest of that line.
  const css = stripComments(rawCss);
  const BLOCK = /([^{}]+)\{([^{}]*)\}/g;
  const decl = (body, prop) => {
    const m = body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i'));
    return m ? m[1].trim() : null;
  };
  const colorOf = new Map();
  let m;
  // DARK: `html.dark <sel> { background / color }` overrides <sel>'s own rule. Read
  // them first, keyed by the selector they override (an `:is(a, b)` list is
  // expanded to its members), and fold them into that selector below.
  const darkOver = new Map();
  if (mode === 'dark') {
    while ((m = BLOCK.exec(css))) {
      for (const part of splitSelectors(m[1])) {
        const d = part.trim().match(/^html\.dark\s+(.+)$/);
        if (!d) continue;
        const rest = d[1].trim();
        const isList = rest.match(/^:is\((.*)\)$/);
        for (const target of isList ? splitSelectors(isList[1]) : [rest]) {
          const key = target.trim();
          const prev = darkOver.get(key) ?? {};
          const bg = decl(m[2], 'background') ?? decl(m[2], 'background-color');
          const c = decl(m[2], 'color');
          darkOver.set(key, { bg: bg ?? prev.bg, color: c ?? prev.color });
        }
      }
    }
    BLOCK.lastIndex = 0;
  }
  while ((m = BLOCK.exec(css))) {
    const c = decl(m[2], 'color');
    if (!c) continue;
    for (const sel of splitSelectors(m[1])) colorOf.set(sel.trim(), c);
  }
  if (mode === 'dark') for (const [sel, o] of darkOver) if (o.color) colorOf.set(sel, o.color);
  const out = [];
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(css))) {
    const body = m[2];
    if (mode === 'dark' && /html\.dark/.test(m[1])) continue; // folded into the selector it overrides
    const bgRaw = decl(body, 'background') ?? decl(body, 'background-color');
    if (!bgRaw && mode !== 'dark') continue;
    if (/gradient|url\(|transparent|none|inherit|currentcolor/i.test(bgRaw)) continue;
    // A TRANSLUCENT fill cannot be measured from the stylesheet alone: what shows
    // through is whatever the element happens to sit on, which this file cannot
    // know. `resolveColor` composites low alpha onto the PAGE, and a white 8%
    // hover over a dark navbar then reads as white-on-white — a confident 1.00:1
    // that is pure artefact. Skipping is honest; guessing the backdrop is not.
    if (/rgba?\([^)]*,\s*0?\.\d+\s*\)|\/\s*0?\.\d+\s*\)/.test(bgRaw)) continue;
    /*
     * ⚠ `m.index` IS NOT THE RULE. The selector group is `[^{}]+`, so it starts
     * at the character after the PREVIOUS rule's `}` and swallows the blanked
     * comment block in between. Reporting it puts the reader 24 lines above the
     * rule, inside the comment explaining it. Offset to the first non-space
     * character — the selector itself — which is exact because the stripper
     * blanks in place.
     */
    const selIndex = m.index + Math.max(0, m[1].search(/\S/));
    // Paren-aware: `:is(button, a).ab.ab-main` is ONE selector. A plain
    // split(',') cut it into `:is(button` + `a).ab.ab-main`, so its `html.dark`
    // override (keyed whole, above) never reached it and dark read white-on-ink.
    for (const selRaw of splitSelectors(m[1])) {
      const sel = selRaw.trim();
      if (!sel || sel.startsWith('@') || sel.startsWith('%')) continue;
      // DARK: the guest Event Hub keeps the couple's design — dark never reaches it.
      if (mode === 'dark' && HUB_SCOPED.test(sel)) continue;
      const over = mode === 'dark' ? darkOver.get(sel) : undefined;
      const selBg = over?.bg ?? bgRaw;
      if (!selBg) continue;
      if (mode === 'dark' && (/gradient|url\(|transparent|none|inherit|currentcolor/i.test(selBg) ||
        /rgba?\([^)]*,\s*0?\.\d+\s*\)|\/\s*0?\.\d+\s*\)/.test(selBg))) continue;
      // WCAG 1.4.3 exempts INACTIVE controls, so a greyed-out button is not a
      // failure — measuring it would bury the real ones under noise that can
      // never legitimately be fixed. (`.m-btn-primary:disabled` reads 1.63:1 and
      // is CORRECT: that is what "you cannot press this" looks like.)
      if (/:disabled\b|\[disabled\]|\[aria-disabled=/i.test(sel)) continue;
      let labelRaw = over?.color ?? decl(body, 'color');
      let via = '';
      if (!labelRaw) {
        const base = sel.replace(/:(hover|focus|focus-visible|active|disabled)\b/g, '').trim();
        if (base === sel) continue;
        labelRaw = colorOf.get(base);
        if (!labelRaw) continue;
        via = ' (label inherited from ' + base + ')';
      }
      const fill = resolveColor(selBg);
      const label = resolveColor(labelRaw);
      if (!fill || !label) continue;
      out.push({
        index: selIndex,
        fill: { name: sel + via + ' background', rgb: fill },
        label: { name: labelRaw.trim(), rgb: label },
      });
    }
  }
  return out;
}

/**
 * KNOWN CSS-RULE PAIRINGS THAT ALREADY FAIL, one `file · selector` per line.
 *
 * The `.tsx` side of this guard has always been green and stays BLOCKING with no
 * baseline. The CSS-rule scan is new (2026-09-23) and found 50 pre-existing
 * failures across eight files nobody was asked to fix. Failing the build on all
 * of them would have got the scan reverted within a day, and a reverted guard
 * catches nothing — so they are recorded instead, and the list may only SHRINK.
 *
 * ⚠ KEYED ON SELECTOR, NEVER ON LINE NUMBER. A line number rots the moment the
 * file is edited and takes the entry's meaning with it.
 */
const BASELINE_FILE = join(__dirname, 'label-contrast.baseline.txt');
const baseline = new Set();
try {
  for (const line of readFileSync(BASELINE_FILE, 'utf8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) baseline.add(t);
  }
} catch {
  /* absent baseline = everything blocks, which is the safe direction */
}
const baselineSeen = new Set();

/* ── BRAND COLOURS USED AS WORDS (2026-10-13 · quality sweep item 9) ─────────
 *
 * The live sweep measured, on almost every public page, three brand colours
 * carrying WORDS under 4.5:1 — straight on the page, no fill, so nothing above
 * could see them:
 *     gold #A9834B 3.48:1 (`text-terracotta`), grey #8B8A89 3.45:1 (`text-ink/55`),
 *     grey #969594 3.01:1 (`text-ink/50`).
 * The fix is TEXT-ONLY, in `tailwind.config.ts`: `theme.extend.textColor` points
 * `text-terracotta` at the accent's deepest step and renders ink tints from
 * INK_TEXT_FLOOR_FROM up to INK_TEXT_FLOOR at the floor. This reads those same
 * numbers back out of the config (never re-typed here) and fails if:
 *   - `text-terracotta` stops resolving through textColor, or resolves under 4.5:1;
 *   - the ink floor is gone, or a tint it lifts would still read under 4.5:1;
 *   - a page spells the raw gold as a word (`text-[var(--m-orange)]`,
 *     `text-[#A9834B]`) on an element — a capitalised JSX tag is a component
 *     (an icon), which only needs 3:1, and is left alone; `app/dev/` is not shipped.
 */
function readTextColours(cssVars) {
  const src = readFileSync(join(WEB_ROOT, 'tailwind.config.ts'), 'utf8');
  const num = (name) => {
    const m = src.match(new RegExp(`const ${name}\\s*=\\s*([0-9.]+);`));
    return m ? Number(m[1]) : null;
  };
  const start = src.indexOf('textColor: {');
  const block = start === -1 ? '' : src.slice(start, src.indexOf('\n      },', start));
  const terra = block.match(/terracotta:\s*\{\s*(?:\/\/[^\n]*\n\s*)*DEFAULT:\s*'rgb\(var\(--([a-z0-9-]+)\)/);
  return {
    floor: num('INK_TEXT_FLOOR'),
    floorFrom: num('INK_TEXT_FLOOR_FROM'),
    inkIsFloored: /\bink:\s*\{\s*DEFAULT:\s*inkText\b/.test(block),
    terracottaVar: terra ? terra[1] : null,
    terracottaRgb: terra ? cssVars.get(terra[1]) ?? null : null,
  };
}
const TEXT = readTextColours(cssVars);
/** Labels the text palette overrides — what `text-<name>` really paints. */
const TEXT_PALETTE = new Map();
if (TEXT.terracottaRgb) {
  TEXT_PALETTE.set('terracotta', TEXT.terracottaRgb);
  TEXT_PALETTE.set('terracotta-500', TEXT.terracottaRgb);
}
/** The alpha a `text-ink/<pct>` class actually renders at. */
function inkTextAlpha(pct) {
  const a = pct / 100;
  if (TEXT.inkIsFloored && TEXT.floor != null && TEXT.floorFrom != null && a >= TEXT.floorFrom && a < TEXT.floor) return TEXT.floor;
  return a;
}
const brandWordFailures = [];
{
  const ink = cssVars.get('color-ink');
  const mixInk = (a) => ink.map((c, i) => Math.round(a * c + (1 - a) * PAGE[i]));
  if (!TEXT.terracottaRgb) {
    brandWordFailures.push(
      'tailwind.config.ts: `text-terracotta` no longer resolves through theme.extend.textColor — it paints the brand gold #A9834B (3.48:1) as words again',
    );
  } else if (contrast(TEXT.terracottaRgb, PAGE) < AA_NORMAL_TEXT) {
    brandWordFailures.push(`tailwind.config.ts: text-terracotta → --${TEXT.terracottaVar} reads ${contrast(TEXT.terracottaRgb, PAGE).toFixed(2)}:1 on the page`);
  }
  if (!TEXT.inkIsFloored || TEXT.floor == null || TEXT.floorFrom == null) {
    brandWordFailures.push(
      'tailwind.config.ts: the ink text floor is gone — text-ink/55 paints #8B8A89 (3.45:1) and text-ink/50 #969594 (3.01:1) as words again',
    );
  } else {
    for (const pct of [50, 55]) {
      const r = contrast(mixInk(inkTextAlpha(pct)), PAGE);
      if (r < AA_NORMAL_TEXT) brandWordFailures.push(`tailwind.config.ts: text-ink/${pct} renders at ${r.toFixed(2)}:1 — the floor (${TEXT.floor}) is too faint`);
    }
  }
  const RAW_GOLD_WORD = /<([a-z][a-z0-9]*)\b[^<>]*?className=(?:"|\{`)[^"`]*\btext-\[(?:color:)?(?:var\(--m-orange\)|#[aA]9834[bB])\](?![/\w])/g;
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(WEB_ROOT, dir))) {
      const rel = relative(WEB_ROOT, file);
      if (rel.startsWith('app/dev/') || /\.test\.tsx?$/.test(rel)) continue;
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(RAW_GOLD_WORD)) {
        brandWordFailures.push(`${rel}:${lineOf(src, m.index)} <${m[1]}> sets words in the raw brand gold #A9834B (3.48:1) — use --m-orange-2 / text-terracotta`);
      }
    }
  }
}

const palette = readTailwindPalette(cssVars);
const failures = [];
let checked = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(WEB_ROOT, dir))) {
    const src = readFileSync(file, 'utf8');
    const rel = relative(WEB_ROOT, file);

    const classRe = /className="([^"]*)"/g;
    let m;
    while ((m = classRe.exec(src))) {
      const pair = classPairing(m[1], palette);
      if (!pair) continue;
      checked++;
      const ratio = contrast(pair.fill.rgb, pair.label.rgb);
      if (ratio < AA_NORMAL_TEXT) {
        failures.push({ rel, line: lineOf(src, m.index), ratio, ...pair });
      }
    }

    for (const pair of objectPairings(src, resolveColor)) {
      checked++;
      const ratio = contrast(pair.fill.rgb, pair.label.rgb);
      if (ratio < AA_NORMAL_TEXT) {
        failures.push({ rel, line: lineOf(src, pair.index), ratio, ...pair });
      }
    }

    for (const pair of inlinePairings(src, cssVars)) {
      checked++;
      const ratio = contrast(pair.fill.rgb, pair.label.rgb);
      if (ratio < AA_NORMAL_TEXT) {
        failures.push({ rel, line: lineOf(src, pair.index), ratio, ...pair });
      }
    }
  }
}

// The CSS rules themselves - the blind spot that hid a 3.42:1 button for months.
for (const dir of ['app', 'components', 'styles']) {
  for (const file of walkCss(join(WEB_ROOT, dir))) {
    const css = readFileSync(file, 'utf8');
    const rel = relative(WEB_ROOT, file);
    for (const pair of cssRulePairings(css, resolveColor)) {
      checked++;
      const ratio = contrast(pair.fill.rgb, pair.label.rgb);
      if (ratio >= AA_NORMAL_TEXT) continue;
      const key = `${rel} · ${pair.fill.name.replace(/ background$/, '')}`;
      if (baseline.has(key)) {
        baselineSeen.add(key);
        continue;
      }
      failures.push({ rel, line: lineOf(css, pair.index), ratio, key, ...pair });
    }
  }
}

const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();

/* ── GUEST TEXT ON THE PAGE — a faint ink, in EVERY theme (2026-10-12) ──────────
 *
 * WHY THIS EXISTS. Everything above judges text on a FILL it sits on in the same
 * class list. The guest walk of 2026-10-11 (N22) measured 78 pieces of text under
 * 4.5:1 on the Event Hub — and none of them were on a fill. They were a tint of the
 * ink straight on the page: `text-ink/60` is 3.98:1 on the house paper, `/55` 3.45,
 * `/50` 3.01 — "Full invitation to follow…", "Show this at the door.", the "FACE
 * TAGGING" eyebrow. This guard reported all clear the whole time, because a tint
 * of ink on the page is not a pairing it could see.
 *
 * WHAT IT JUDGES. In the guest-facing trees only (`app/[slug]`, `app/join` — what a
 * guest reads cold, on a phone, often outdoors), every bare `text-ink/NN` class.
 * Its colour is composited on the page paper of the house look AND of every Event
 * Hub theme that sets its own ink and paper (`[data-hub-theme='…']` in globals.css —
 * velvet, gatsby and cyber are the dark ones), and the WORST of those is the
 * number. So "light and dark" is one measurement, read from the real tokens: when
 * a theme is added or a token moves, this moves with it. A prefixed class
 * (`hover:`, `placeholder:`, `disabled:` …) is a state, not the resting text, and
 * is left to the checks above.
 *
 * A RATCHET, PER FILE, BECAUSE THE TAIL IS REAL. On the day this was added the
 * guest trees held ~300 such classes — some on icons (3:1 is their floor), most on
 * words. Fixing all of them in one pass would be a hundred unreviewed visual
 * changes, so the count per file is recorded (`guest-faint-ink.baseline.json`) and
 * may only go DOWN: a file that gains one fails, and a file that loses one fails
 * until the record is regenerated (`--write-baseline`), so the record never keeps
 * a number that is no longer true. The walked pages themselves are pinned row by
 * row in `app/[slug]/_lib/the-walked-pages-read-and-press.test.ts`.
 */
const GUEST_DIRS = ['app/[slug]', 'app/join'];
const FAINT_BASELINE_FILE = join(__dirname, 'guest-faint-ink.baseline.json');

/** [name, ink, paper] for the house look and every hub theme that sets both, read from globals.css. */
function guestLooks() {
  const css = stripComments(readFileSync(join(WEB_ROOT, 'app/globals.css'), 'utf8'));
  const tok = (body, name) => {
    const m = body.match(new RegExp('--color-' + name + ':\\s*(\\d{1,3})\\s+(\\d{1,3})\\s+(\\d{1,3})\\s*;'));
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const looks = [['house', cssVars.get('color-ink'), PAGE]];
  for (const m of css.matchAll(/\[data-hub-theme='([a-z0-9-]+)'\]\s*\{([^{}]*)\}/g)) {
    const ink = tok(m[2], 'ink');
    const paper = tok(m[2], 'cream');
    if (ink && paper) looks.push([m[1], ink, paper]);
  }
  if (!looks[0][1]) throw new Error('lint-contrast: --color-ink was not found — the guest-text check cannot measure anything');
  if (looks.length < 2) throw new Error('lint-contrast: no [data-hub-theme] sets --color-ink and --color-cream — the dark themes are no longer read');
  return looks;
}

/** The worst ratio of `text-ink/<pct>` on the page across every look. */
function worstInkTint(pct, looks) {
  // What the class RENDERS at — the text floor in tailwind.config.ts lifts /50–/65.
  const a = inkTextAlpha(pct);
  let worst = Infinity;
  for (const [, ink, paper] of looks) {
    const mixed = ink.map((c, i) => Math.round(a * c + (1 - a) * paper[i]));
    worst = Math.min(worst, contrast(mixed, paper));
  }
  return worst;
}

const looks = guestLooks();
const faintNow = {};
let faintChecked = 0;
for (const dir of GUEST_DIRS) {
  for (const file of walk(join(WEB_ROOT, dir))) {
    const rel = relative(WEB_ROOT, file);
    if (/\.test\.tsx$/.test(rel)) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    let n = 0;
    // A bare token only: start of the attribute or after whitespace / a quote / a backtick — never after `hover:`.
    for (const m of src.matchAll(/(?<=^|[\s"'`])text-ink\/(\d{1,3})(?=$|[\s"'`])/gm)) {
      faintChecked++;
      if (worstInkTint(Number(m[1]), looks) < AA_NORMAL_TEXT) n++;
    }
    if (n) faintNow[rel] = n;
  }
}
let faintBaseline = {};
try {
  faintBaseline = JSON.parse(readFileSync(FAINT_BASELINE_FILE, 'utf8')).files ?? {};
} catch {
  /* absent record = every faint tint blocks, the safe direction */
}
const faintGrew = [];
const faintShrank = [];
for (const rel of new Set([...Object.keys(faintNow), ...Object.keys(faintBaseline)])) {
  const now = faintNow[rel] ?? 0;
  const was = faintBaseline[rel] ?? 0;
  if (now > was) faintGrew.push(`  ${rel}: ${now} faint ink tint(s), the record allows ${was}`);
  else if (now < was) faintShrank.push(`  ${rel}: ${was} → ${now}`);
}

/* ── THE SAME PAIRS IN DARK (dark mode PR 2, 2026-10-13) ───────────────────────
 *
 * WHY THIS EXISTS. Everything above reads the FIRST definition of each token, which
 * is the light one, and strips `dark:` classes — so it was blind to dark by
 * construction (its own header said to extend it "when dark is re-enabled"). The
 * owner approved turning dark on (DECISION_LOG 2026-10-13, "approve all"); PR 1 gave
 * every shared token a dark value. This pass judges every pairing above AGAIN, as
 * dark resolves it:
 *   · tokens: the `html.dark` / `html.dark .fd` blocks layered over the light ones;
 *   · classes: a bare `dark:bg-x` / `dark:text-x` replaces its base class;
 *   · CSS rules: an `html.dark <sel>` rule replaces <sel>'s fill / label.
 * The guest Event Hub (`app/[slug]`, Hub-scoped CSS) is not judged: dark never
 * reaches it.
 *
 * A RATCHET, NOT A WALL. On the day it was added dark had never been designed
 * screen by screen, so there are real failures — that list IS the work of the area
 * PRs. It is recorded per `file · pair` with a count
 * (`label-contrast-dark.baseline.json`) and may only go DOWN: a new failing pair
 * fails, a count that grows fails, and a count that shrank fails until the record
 * is regenerated — so it never keeps a number that is no longer true. Regenerating
 * REFUSES to raise any count (`--allow-dark-growth` exists for a deliberate,
 * reviewed exception, and the diff of the record shows it).
 */
const DARK_BASELINE_FILE = join(__dirname, 'label-contrast-dark.baseline.json');
const darkVars = readCssVars('dark');
const DARK_PAGE = darkVars.get('m-paper') ?? darkVars.get('color-cream');
if (!DARK_PAGE || hex(DARK_PAGE) === hex(PAGE)) {
  throw new Error('lint-contrast: the dark --m-paper was not read (or equals light) — the dark pass cannot measure anything');
}
const darkResolve = makeResolveColor(darkVars, DARK_PAGE);
/** `TEXT_PALETTE` as dark resolves it: the same textColor step, its dark value. */
const DARK_TEXT_PALETTE = new Map();
if (TEXT.terracottaVar && darkVars.get(TEXT.terracottaVar)) {
  DARK_TEXT_PALETTE.set('terracotta', darkVars.get(TEXT.terracottaVar));
  DARK_TEXT_PALETTE.set('terracotta-500', darkVars.get(TEXT.terracottaVar));
}
const darkPalette = readTailwindPalette(darkVars);
const darkNow = {};
let darkChecked = 0;
const darkWorst = {};
const noteDark = (key, ratio) => {
  darkChecked++;
  if (ratio >= AA_NORMAL_TEXT) return;
  darkNow[key] = (darkNow[key] ?? 0) + 1;
  darkWorst[key] = Math.min(darkWorst[key] ?? Infinity, ratio);
};
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(WEB_ROOT, dir))) {
    const rel = relative(WEB_ROOT, file);
    if (rel.startsWith('app/[slug]/') || /\.test\.tsx$/.test(rel)) continue;
    const src = readFileSync(file, 'utf8');
    let m;
    const classRe = /className="([^"]*)"/g;
    while ((m = classRe.exec(src))) {
      const pair = classPairing(m[1], darkPalette, 'dark');
      if (pair) noteDark(`${rel} · ${pair.label.name} on ${pair.fill.name}`, contrast(pair.fill.rgb, pair.label.rgb));
    }
    for (const pair of objectPairings(src, darkResolve)) {
      noteDark(`${rel} · ${pair.label.name} on ${pair.fill.name}`, contrast(pair.fill.rgb, pair.label.rgb));
    }
    for (const pair of inlinePairings(src, darkVars)) {
      noteDark(`${rel} · ${pair.label.name} on ${pair.fill.name}`, contrast(pair.fill.rgb, pair.label.rgb));
    }
  }
}
for (const dir of ['app', 'components', 'styles']) {
  for (const file of walkCss(join(WEB_ROOT, dir))) {
    const rel = relative(WEB_ROOT, file);
    if (rel.startsWith('app/[slug]/')) continue;
    for (const pair of cssRulePairings(readFileSync(file, 'utf8'), darkResolve, 'dark')) {
      noteDark(`${rel} · ${pair.fill.name.replace(/ background$/, '')}`, contrast(pair.fill.rgb, pair.label.rgb));
    }
  }
}
let darkBaseline = null;
try {
  darkBaseline = JSON.parse(readFileSync(DARK_BASELINE_FILE, 'utf8')).pairs ?? {};
} catch {
  /* absent record = every dark failure blocks, the safe direction */
}
const darkGrew = [];
const darkShrank = [];
for (const key of new Set([...Object.keys(darkNow), ...Object.keys(darkBaseline ?? {})])) {
  const now = darkNow[key] ?? 0;
  const was = darkBaseline?.[key] ?? 0;
  if (now > was) darkGrew.push(`  ${key}: ${now} (worst ${darkWorst[key].toFixed(2)}:1), the record allows ${was}`);
  else if (now < was) darkShrank.push(`  ${key}: ${was} → ${now}`);
}

// `node lint-label-on-fill-contrast.mjs --write-baseline` after fixing some, so
// the list shrinks deliberately rather than by hand-editing.
if (process.argv.includes('--write-baseline')) {
  // Dark may only go DOWN — regenerating refuses to raise a count unless told to.
  if (darkBaseline && darkGrew.length && !process.argv.includes('--allow-dark-growth')) {
    console.error(
      `\n✖ the dark record was NOT rewritten: ${darkGrew.length} dark pair(s) would GROW it:\n${darkGrew.join('\n')}\n` +
        '\n  Fix them (the dark value of a token, or a dark: class), or — a deliberate, reviewed exception only —\n' +
        '  re-run with --allow-dark-growth.\n',
    );
    process.exit(1);
  }
  const keys = [...new Set([...baselineSeen, ...failures.filter((f) => f.key).map((f) => f.key)])].sort();
  writeFileSync(
    BASELINE_FILE,
    '# CSS-rule label-on-fill pairings that already failed when the CSS scan was\n' +
      '# added (2026-09-23). Keyed `file · selector` — NEVER a line number.\n' +
      '# This list may only SHRINK. Regenerate with --write-baseline after fixing.\n' +
      keys.join('\n') + '\n',
  );
  console.log(`baseline written: ${keys.length} known CSS-rule failure(s)`);
  const files = Object.fromEntries(Object.entries(faintNow).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(
    FAINT_BASELINE_FILE,
    JSON.stringify(
      {
        _about:
          'Guest-facing text-ink/NN classes under 4.5:1 on the page in the house look or any Event Hub theme, counted per file (lint-label-on-fill-contrast.mjs, "GUEST TEXT ON THE PAGE"). May only go DOWN. Regenerate with --write-baseline after a fix; never by hand.',
        total: Object.values(files).reduce((x, y) => x + y, 0),
        files,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`guest faint-ink record written: ${Object.keys(files).length} file(s)`);
  const pairs = Object.fromEntries(Object.entries(darkNow).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(
    DARK_BASELINE_FILE,
    JSON.stringify(
      {
        _about:
          'Text-on-fill pairs under 4.5:1 in DARK (lint-label-on-fill-contrast.mjs, "THE SAME PAIRS IN DARK"), counted per "file · pair". The area PRs\' to-do list. May only go DOWN; --write-baseline refuses to raise a count. Never edit by hand.',
        total: Object.values(pairs).reduce((x, y) => x + y, 0),
        pairs,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`dark record written: ${Object.keys(pairs).length} pair(s), ${Object.values(pairs).reduce((x, y) => x + y, 0)} use(s)`);
  process.exit(0);
}

// An entry that no longer fails is a fix nobody recorded — make it visible so the
// list cannot quietly keep entries that have already been repaired.
const stale = [...baseline].filter((k) => !baselineSeen.has(k));
if (stale.length) {
  console.error(
    `\n✖ ${stale.length} baseline entr(ies) no longer fail — they were fixed. ` +
      `Remove them so the list keeps meaning something:\n`,
  );
  for (const k of stale) console.error(`  ${k}`);
  console.error('\n  node apps/web/scripts/lint-label-on-fill-contrast.mjs --write-baseline\n');
  process.exit(1);
}

if (failures.length) {
  console.error(
    `\n✖ ${failures.length} place(s) put text on a fill it cannot be read against ` +
      `(WCAG AA needs ${AA_NORMAL_TEXT}:1 for normal text):\n`,
  );
  for (const f of failures) {
    console.error(
      `  ${f.rel}:${f.line}\n` +
        `      ${f.label.name} ${hex(f.label.rgb)} on ${f.fill.name} ${hex(f.fill.rgb)} ` +
        `→ ${f.ratio.toFixed(2)}:1\n`,
    );
  }
  console.error(
    'Fix the FILL, not the label. Swapping white for cream moves the ratio by\n' +
      'about 0.1 and changes nothing that matters — a light gold cannot carry a\n' +
      'word at any label colour. Use the deeper gold (terracotta-700), or keep\n' +
      'the light gold and take the text off it.\n',
  );
  process.exit(1);
}

let faintFailed = false;
if (faintGrew.length) {
  console.error(
    `\n✖ ${faintGrew.length} guest-facing file(s) gained a faint ink (text-ink/NN under ${AA_NORMAL_TEXT}:1 on the page, ` +
      `worst of the house look and ${looks.length - 1} Event Hub theme(s)):\n`,
  );
  for (const l of faintGrew) console.error(l);
  console.error(
    `\n  text-ink/65 is the faintest tint that reads in every look (${worstInkTint(65, looks).toFixed(2)}:1); /60 is ${worstInkTint(60, looks).toFixed(2)}:1.\n`,
  );
  faintFailed = true;
}
if (faintShrank.length) {
  console.error(`\n✖ ${faintShrank.length} guest-facing file(s) lost faint ink tints — a fix nobody recorded. Regenerate the record:\n`);
  for (const l of faintShrank) console.error(l);
  console.error('\n  node apps/web/scripts/lint-label-on-fill-contrast.mjs --write-baseline\n');
  faintFailed = true;
}

if (darkGrew.length) {
  console.error(
    `\n✖ ${darkGrew.length} text-on-fill pair(s) cannot be read in DARK (under ${AA_NORMAL_TEXT}:1, read with the html.dark tokens and dark: classes) and are not in the record:\n`,
  );
  for (const l of darkGrew) console.error(l);
  console.error(
    '\n  Fix the dark side: give the class its dark: partner (dark:bg-… / dark:text-…), or move to a token whose\n' +
      '  dark value reads (bg-raised, text-ink, the ramps). Light is judged separately above and is unaffected.\n',
  );
  faintFailed = true;
}
if (darkShrank.length) {
  console.error(`\n✖ ${darkShrank.length} dark pair(s) were fixed — record the fix so the list keeps meaning something:\n`);
  for (const l of darkShrank) console.error(l);
  console.error('\n  node apps/web/scripts/lint-label-on-fill-contrast.mjs --write-baseline\n');
  faintFailed = true;
}

if (brandWordFailures.length) {
  console.error(`\n✖ ${brandWordFailures.length} brand colour(s) used as words under ${AA_NORMAL_TEXT}:1 on the page:\n`);
  for (const l of brandWordFailures) console.error(`  ${l}`);
  console.error('');
  faintFailed = true;
}
if (faintFailed) process.exit(1);

console.log(`✓ label-on-fill contrast: ${checked} pairing(s) checked, all ≥ ${AA_NORMAL_TEXT}:1`);
console.log(
  `✓ dark: ${darkChecked} pairing(s) checked; ${Object.values(darkNow).reduce((x, y) => x + y, 0)} under ${AA_NORMAL_TEXT}:1 in ${Object.keys(darkNow).length} pair(s), all in the record, none new`,
);
console.log(`✓ brand words: text-terracotta → --${TEXT.terracottaVar} ${contrast(TEXT.terracottaRgb, PAGE).toFixed(2)}:1 · text-ink/50–/${Math.round(TEXT.floor * 100) - 5} render at ink/${Math.round(TEXT.floor * 100)} ${contrast(cssVars.get('color-ink').map((c, i) => Math.round(TEXT.floor * c + (1 - TEXT.floor) * PAGE[i])), PAGE).toFixed(2)}:1`);
console.log(`✓ guest text on the page: ${faintChecked} ink tint(s) in ${looks.length} look(s); ${Object.values(faintNow).reduce((x, y) => x + y, 0)} faint, none new`);
