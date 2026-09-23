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
 *  - Light mode only. The dark block in `globals.css` is dormant by design
 *    (its own comment: "a future re-enable is a one-file revert"), and it uses
 *    INK labels on the accent rather than cream, so its pairings differ. If
 *    dark is ever re-enabled, extend RESOLVERS to the dark `:root` too — the
 *    dark accent `#A88340` carrying cream would score 3.39:1.
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
function readCssVars() {
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
function classPairing(className, palette) {
  const tokens = className.split(/\s+/);
  let fill = null;
  let label = null;
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
    if (fg && palette.has(fg[1])) {
      if (label && label.name !== fg[1]) return null;
      label = { name: fg[1], rgb: palette.get(fg[1]) };
    }
  }
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
function resolveColor(raw) {
  const v = raw.trim();
  const hex = v.match(/^#[0-9a-f]{3,6}$/i);
  if (hex) return parseHex(hex[0]);
  const varRef = v.match(/^var\(\s*--([a-z0-9-]+)/i);
  if (varRef) return cssVars.get(varRef[1]) ?? null;
  const rgba = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
    if (a > 0.6) return [r, g, b]; // effectively opaque
    return [r, g, b].map((c, i) => Math.round(a * c + (1 - a) * PAGE[i]));
  }
  return null;
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
function cssRulePairings(rawCss, resolveColor) {
  // Comments first, or a `/* ... { ... } ... */` block is parsed as a rule and
  // its prose becomes a selector. The first cut reported three "failures" whose
  // selector was the inside of a comment explaining an unrelated fix.
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const BLOCK = /([^{}]+)\{([^{}]*)\}/g;
  const decl = (body, prop) => {
    const m = body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i'));
    return m ? m[1].trim() : null;
  };
  const colorOf = new Map();
  let m;
  while ((m = BLOCK.exec(css))) {
    const c = decl(m[2], 'color');
    if (!c) continue;
    for (const sel of m[1].split(',')) colorOf.set(sel.trim(), c);
  }
  const out = [];
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(css))) {
    const body = m[2];
    const bgRaw = decl(body, 'background') ?? decl(body, 'background-color');
    if (!bgRaw) continue;
    if (/gradient|url\(|transparent|none|inherit|currentcolor/i.test(bgRaw)) continue;
    // A TRANSLUCENT fill cannot be measured from the stylesheet alone: what shows
    // through is whatever the element happens to sit on, which this file cannot
    // know. `resolveColor` composites low alpha onto the PAGE, and a white 8%
    // hover over a dark navbar then reads as white-on-white — a confident 1.00:1
    // that is pure artefact. Skipping is honest; guessing the backdrop is not.
    if (/rgba?\([^)]*,\s*0?\.\d+\s*\)|\/\s*0?\.\d+\s*\)/.test(bgRaw)) continue;
    for (const selRaw of m[1].split(',')) {
      const sel = selRaw.trim();
      if (!sel || sel.startsWith('@') || sel.startsWith('%')) continue;
      // WCAG 1.4.3 exempts INACTIVE controls, so a greyed-out button is not a
      // failure — measuring it would bury the real ones under noise that can
      // never legitimately be fixed. (`.m-btn-primary:disabled` reads 1.63:1 and
      // is CORRECT: that is what "you cannot press this" looks like.)
      if (/:disabled\b|\[disabled\]|\[aria-disabled=/i.test(sel)) continue;
      let labelRaw = decl(body, 'color');
      let via = '';
      if (!labelRaw) {
        const base = sel.replace(/:(hover|focus|focus-visible|active|disabled)\b/g, '').trim();
        if (base === sel) continue;
        labelRaw = colorOf.get(base);
        if (!labelRaw) continue;
        via = ' (label inherited from ' + base + ')';
      }
      const fill = resolveColor(bgRaw);
      const label = resolveColor(labelRaw);
      if (!fill || !label) continue;
      out.push({
        index: m.index,
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

// `node lint-label-on-fill-contrast.mjs --write-baseline` after fixing some, so
// the list shrinks deliberately rather than by hand-editing.
if (process.argv.includes('--write-baseline')) {
  const keys = [...new Set([...baselineSeen, ...failures.filter((f) => f.key).map((f) => f.key)])].sort();
  writeFileSync(
    BASELINE_FILE,
    '# CSS-rule label-on-fill pairings that already failed when the CSS scan was\n' +
      '# added (2026-09-23). Keyed `file · selector` — NEVER a line number.\n' +
      '# This list may only SHRINK. Regenerate with --write-baseline after fixing.\n' +
      keys.join('\n') + '\n',
  );
  console.log(`baseline written: ${keys.length} known CSS-rule failure(s)`);
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

console.log(`✓ label-on-fill contrast: ${checked} pairing(s) checked, all ≥ ${AA_NORMAL_TEXT}:1`);
