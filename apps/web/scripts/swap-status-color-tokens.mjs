#!/usr/bin/env node
/*
 * Wave-3 semantic status-token swap (2026-06-19).
 *
 * Replaces the de-facto status palette (emerald / amber / rose Tailwind
 * utilities) with the new canonical semantic families:
 *
 *     emerald → success   (sage-green brand family)
 *     amber   → warn       (champagne-gold brand family)
 *     rose    → danger     (blush / terracotta brand family)
 *
 * SAFETY — className-scoped. The token is only rewritten when it is the
 * tail of a Tailwind utility class, i.e. preceded by a known utility prefix
 * (optionally behind a variant chain like `hover:` / `md:` / `group-hover:`).
 * This guarantees prose, comments, TS string literals (e.g. `tone="emerald"`),
 * variable names, palette/monogram copy, and the `--m-*` token definitions are
 * NEVER touched — only `bg-emerald-50`, `hover:text-rose-600/80`, etc. flip.
 *
 * The shade number and any `/opacity` suffix are preserved verbatim.
 *
 * Usage:  node scripts/swap-status-color-tokens.mjs            (apply)
 *         node scripts/swap-status-color-tokens.mjs --dry      (count only)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname; // apps/web
const DRY = process.argv.includes('--dry');

const FAMILY_MAP = { emerald: 'success', amber: 'warn', rose: 'danger' };

// Tailwind color utility prefixes that take a color-family token.
const UTILITY_PREFIXES = [
  'bg',
  'text',
  'border',
  'border-x',
  'border-y',
  'border-t',
  'border-r',
  'border-b',
  'border-l',
  'border-s',
  'border-e',
  'ring',
  'ring-offset',
  'from',
  'to',
  'via',
  'divide',
  'outline',
  'fill',
  'stroke',
  'decoration',
  'placeholder',
  'caret',
  'accent',
  'shadow',
];

const SHADES = '(?:50|100|200|300|400|500|600|700|800|900|950)';

/*
 * Match: an optional variant chain (any number of `word:` or `word[..]:` or
 * `[..]:` segments), then a required utility prefix, then `-`, then the color
 * family, then `-shade`, then an optional `/opacity` suffix.
 *
 * We capture the prefix + family so we can swap ONLY the family. The
 * `(?<=[\s"'\`{(\[:])` style boundary isn't used because the utility-prefix
 * itself is the boundary guarantee; instead we require the prefix to be
 * preceded by a non-class char (start, whitespace, quote, brace, paren,
 * backtick, or a variant colon) so we don't match mid-identifier text like
 * `myamber-500` — though such identifiers don't exist in the codebase.
 */
const PREFIX_ALT = UTILITY_PREFIXES.join('|');
const VARIANT = '(?:[a-z0-9-]+(?:\\[[^\\]]*\\])?:|\\[[^\\]]*\\]:)*';
const BOUNDARY = "(^|[\\s\"'`{(\\[:])"; // char before the variant/prefix
const FAMILY_ALT = Object.keys(FAMILY_MAP).join('|');

const RE = new RegExp(
  `${BOUNDARY}(${VARIANT}(?:${PREFIX_ALT})-)(${FAMILY_ALT})(-${SHADES}(?:/[0-9]{1,3})?)`,
  'g',
);

const counts = { emerald: 0, amber: 0, rose: 0 };
let filesTouched = 0;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

for (const file of walk(ROOT)) {
  // never rewrite this codemod itself
  if (file.endsWith('swap-status-color-tokens.mjs')) continue;
  const src = readFileSync(file, 'utf8');
  let changed = false;
  const next = src.replace(RE, (_m, boundary, prefix, family, tail) => {
    counts[family]++;
    changed = true;
    return `${boundary}${prefix}${FAMILY_MAP[family]}${tail}`;
  });
  if (changed) {
    filesTouched++;
    if (!DRY) writeFileSync(file, next);
  }
}

console.log(DRY ? '[DRY RUN — no files written]' : '[APPLIED]');
console.log(`emerald → success : ${counts.emerald}`);
console.log(`amber   → warn    : ${counts.amber}`);
console.log(`rose    → danger  : ${counts.rose}`);
console.log(`total replacements: ${counts.emerald + counts.amber + counts.rose}`);
console.log(`files touched     : ${filesTouched}`);
