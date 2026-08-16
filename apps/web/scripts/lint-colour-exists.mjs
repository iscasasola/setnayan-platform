#!/usr/bin/env node
/**
 * lint-colour-exists.mjs
 *
 * Fails when a Tailwind COLOUR UTILITY names a palette entry that does not
 * exist — `text-gold-deep` when there is no `gold` key, `bg-brand/20` when there
 * is no `brand`.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * 🚨 Tailwind DROPS a class whose colour it cannot resolve. No error, no
 * warning, no build failure — the rule is simply absent from the stylesheet.
 * The element then falls back to whatever it inherits, which for a `border-*`
 * utility is preflight's cool grey `#e5e7eb`, on a palette that contains no
 * grey. **Rejected, not thrown; the only symptom is an absence** — the same
 * disease as the phantom column, the phantom enum value, the phantom RPC
 * argument and the blocked iframe, and this repo has now paid for it in CSS
 * too.
 *
 * Measured 2026-08-15: `gold` was used in **78 class names across 12+ files** —
 * `text-gold-deep` · `bg-gold/15` · `border-gold/40` and 19 other forms — and
 * had never been a key in `tailwind.config.ts`. Generating the stylesheet with
 * the shipped config emitted **ZERO** gold rules (control: `border-ink/10` → 1).
 * It went unseen for months because the affected rows were the *highlighted*
 * ones, and nothing produced a highlight for an ordinary account until the
 * own-birthday moment shipped.
 *
 * ── HOW IT DECIDES ──────────────────────────────────────────────────────────
 * A colour utility is `<prefix>-<name>` where prefix ∈ the colour-taking
 * utilities below. `<name>`'s FIRST segment must be a key in the project
 * palette (config `theme.extend.colors` + `theme.colors`) or in Tailwind's own
 * default palette, or be one of the keyword values a colour utility accepts
 * (`transparent`, `current`, `inherit`, `white`, `black`).
 *
 * ⚠ IT ONLY JUDGES NAMES IT CAN BE SURE ABOUT. Anything with an arbitrary value
 * (`text-[color:var(--x)]`), a bare number (`border-2`), or a known non-colour
 * value for that prefix (`text-sm`, `bg-cover`, `divide-y`) is skipped rather
 * than guessed at. **A guard that cries wolf teaches you to skim past the one
 * time it is right** — so the rule is: unknown shape ⇒ silent, unknown COLOUR
 * NAME ⇒ fail.
 *
 * Exit 0 = every colour utility resolves. Exit 1 = at least one cannot.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
// 🪤 THE SAME STRING-AWARE LEXER THE PORT-CONTROL GUARD USES — imported, not
// re-written. A className expression can contain a COMMENT, and this guard's
// first run flagged `text-shadow` from a `// text-shadow INHERITS…` note inside
// one. That is the FIFTH time a text-searching guard in this repo has matched
// its own explanation, so the fix is the shared lexer rather than a fourth
// hand-rolled regex (see lib/strip-comments.ts for why a regex cannot do it).
import { stripComments } from './port-controls.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'lib'].map((d) => join(WEB, d));

/** Utility prefixes whose value is a colour. */
const COLOUR_PREFIXES = [
  'text', 'bg', 'border', 'ring', 'fill', 'stroke', 'divide', 'outline',
  'decoration', 'accent', 'caret', 'shadow', 'from', 'via', 'to', 'placeholder',
];

/**
 * Values these prefixes legitimately take that are NOT colours. Anything here
 * is skipped — the point is to judge colour NAMES, not to police spacing.
 */
const NON_COLOUR = new Set([
  // text-*
  'xs', 'sm', 'base', 'lg', 'xl', 'left', 'center', 'right', 'justify', 'start', 'end',
  'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip', 'opacity',
  // bg-*
  'cover', 'contain', 'auto', 'fixed', 'local', 'scroll', 'repeat', 'no', 'origin',
  'bottom', 'top', 'gradient', 'none', 'blend', 'clip',
  // border-* / divide-* / ring-*
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'collapse', 'separate', 'x', 'y',
  'inset', 'offset', 'reverse', 't', 'r', 'b', 'l', 's', 'e',
  // shadow-* / outline-* / decoration-*
  'inner', 'md', 'underline', 'overline', 'through', 'line',
  // misc
  'transparent', 'current', 'inherit', 'white', 'black',
]);

/** Tailwind v3's default palette keys. */
const TW_DEFAULT = new Set([
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose', 'white', 'black', 'transparent', 'current',
  'inherit',
]);

/** Palette keys declared by this project's config, read as TEXT. */
function projectColours() {
  // The config is TypeScript with comments; a real import needs a TS loader that
  // the lint scripts deliberately do not have (they run under plain `node`, same
  // constraint recorded in lib/strip-comments.ts). Reading the keys textually is
  // enough: a key is `name: {` or `name: '#hex'` inside a `colors: {` block.
  const src = readFileSync(join(WEB, 'tailwind.config.ts'), 'utf8');
  const keys = new Set();
  const blocks = [...src.matchAll(/colors\s*:\s*\{/g)];
  for (const b of blocks) {
    let i = b.index + b[0].length;
    let depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    const body = src.slice(start, i);
    // Top-level keys only: at nesting depth 0 within this block.
    let d = 0;
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (d === 0) {
        const m = trimmed.match(/^'?([a-z][a-z0-9-]*)'?\s*:/);
        if (m) keys.add(m[1]);
      }
      d += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    }
  }
  return keys;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e)) out.push(p);
  }
  return out;
}

const known = new Set([...projectColours(), ...TW_DEFAULT]);
const prefixes = COLOUR_PREFIXES.join('|');

/**
 * ⚠ THE WHOLE TOKEN MUST MATCH — this is the difference between a guard and
 * noise. A first cut matched the pattern as a SUBSTRING anywhere in the file and
 * reported **1484 failures**, every one of them a CSS PROPERTY NAME inside a
 * style string: `border-radius`, `text-transform`, `text-align`, `stroke-width`,
 * `border-color`. Requiring the entire whitespace-delimited token to be the
 * utility drops all of them, because in CSS those are followed by a colon
 * (`border-radius:`) and in JSX they are camelCase props, not strings.
 *
 * A guard that cries wolf teaches you to skim past the one time it is right.
 */
const TOKEN = new RegExp(`^(${prefixes})-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:\\/[\\d.]+)?$`);

/**
 * Only the text a CLASS actually lives in. Scoped to `className=` / `class=`
 * values because the two earlier cuts of this guard proved the alternatives are
 * noise: a substring scan reported **1484** CSS property names
 * (`border-radius`, `text-transform`, `stroke-width`), and whole-token matching
 * over the raw file still reported **191** — quoted CSS keys in style objects
 * (`'border-color': …`) and ordinary English in content files (*"text-only"*,
 * *"to-scale"*). Neither is a class, and neither can ever be dropped by
 * Tailwind, so neither belongs in a guard about dropped classes.
 */
function classNameRegions(src) {
  const out = [];
  const re = /\bclass(?:Name)?\s*=\s*/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    const open = src[i];
    if (open === '"' || open === "'" || open === '`') {
      const end = src.indexOf(open, i + 1);
      if (end === -1) continue;
      out.push([i + 1, src.slice(i + 1, end)]);
      re.lastIndex = end;
    } else if (open === '{') {
      // Balanced braces — covers cn(...), template literals, ternaries, arrays.
      let depth = 0;
      const start = i;
      while (i < src.length) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        i += 1;
      }
      out.push([start, src.slice(start, i)]);
      re.lastIndex = i;
    }
  }
  return out;
}

const failures = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (file.endsWith('.css.ts')) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const [offset, region] of classNameRegions(src)) {
      const lineNo = src.slice(0, offset).split('\n').length;
      // 🪤 STRIP ARBITRARY VALUES FIRST. `transition-[background-color,border-color]`
      // is a transition-property list, not two colour utilities — it was the last
      // false positive this guard produced. Removing `[...]` also silently skips
      // `text-[color:var(--sn-gold-700)]`, which is the correct behaviour: an
      // arbitrary value cannot name a missing palette key.
      const scrubbed = region.replace(/\[[^\]]*\]/g, ' ');
      for (const raw of scrubbed.split(/[\s"'`{}(),;:]+/)) {
        const m = raw.match(TOKEN);
        if (!m) continue;
        const [, prefix, value] = m;
        const first = value.split('-')[0];
        if (NON_COLOUR.has(first) || NON_COLOUR.has(value)) continue;
        if (/^\d/.test(first)) continue; // border-2, ring-1
        if (known.has(first)) continue;
        failures.push({
          file: file.slice(WEB.length + 1),
          line: lineNo,
          cls: `${prefix}-${value}`,
          name: first,
        });
      }
    }
  }
}

if (failures.length === 0) {
  console.log(`✓ every colour utility resolves (${known.size} palette keys known)`);
  process.exit(0);
}

const byName = new Map();
for (const f of failures) {
  if (!byName.has(f.name)) byName.set(f.name, []);
  byName.get(f.name).push(f);
}

console.error(
  `✗ ${failures.length} colour utility/utilities name a palette entry that does not exist.\n` +
    '  Tailwind DROPS these silently — the rule never reaches the stylesheet and the\n' +
    '  element falls back to inherited or preflight styling. Add the key to\n' +
    "  tailwind.config.ts, or use a colour that exists.\n",
);
for (const [name, hits] of [...byName.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  "${name}" — ${hits.length} occurrence(s), e.g.`);
  for (const h of hits.slice(0, 4)) console.error(`    ${h.file}:${h.line}  ${h.cls}`);
  if (hits.length > 4) console.error(`    …and ${hits.length - 4} more`);
}
process.exit(1);
