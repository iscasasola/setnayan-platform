/**
 * css-colour-tokens.ts — read a colour token's REAL value out of the stylesheets, following pointers.
 *
 * WHY (the one colour set, owner 18 Nov 2026). Until 18 Nov a guard could read `--m-paper: #FFFFFF;` with one regex,
 * because every family held its own literal copy. Since the one colour set, `--m-*`, `--sn-*` and `--fd-*` POINT at the
 * `--color-*` tokens (`--m-paper: rgb(var(--color-raised))`), so a reader has to follow the pointer the way the browser
 * does. This is that reader, written once, for the guards that measure colours: it layers `:root` then (for dark)
 * `html.dark`, in file order, and resolves `var(--x)`, `var(--x, fallback)`, `rgb(var(--x))`, `R G B` triples and hex.
 *
 * It answers with a 6-digit lowercase hex, or `null` when the value is not ONE OPAQUE colour (an alpha, a gradient, a
 * shadow, `color-mix`) — a caller that needs a number must not be handed a guess.
 *
 * Test-only by use (it reads files from disk); pure and dependency-free apart from the repo's one comment stripper.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBALS = 'app/globals.css';
const FRONT_DOOR = 'app/_components/frontdoor/front-door.css';

export type Theme = 'light' | 'dark';
export type TokenMap = Record<string, string>;

const cache = new Map<string, string>();
function css(rel: string): string {
  let s = cache.get(rel);
  if (s === undefined) {
    s = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    cache.set(rel, s);
  }
  return s;
}

/** Every custom property declared in the rule blocks whose selector is exactly one of `selectors`, later blocks winning. */
function declared(source: string, selectors: readonly string[], into: TokenMap): void {
  // A hand scanner, not a regex: the comment stripper leaves long runs of blank space, and a `\s*…+?\s*\{` pattern
  // backtracks quadratically over them (measured: the regex version did not finish in two minutes on globals.css).
  let segStart = 0; // just after the last `{`, `}` or `;`
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === ';' || c === '}') {
      segStart = i + 1;
    } else if (c === '{') {
      const sel = source.slice(segStart, i).replace(/\s+/g, ' ').trim();
      const close = source.indexOf('}', i + 1);
      const nested = source.indexOf('{', i + 1);
      segStart = i + 1;
      if (close < 0 || (nested >= 0 && nested < close)) continue; // not an innermost block
      if (!selectors.includes(sel)) continue;
      for (const d of source.slice(i + 1, close).split(';')) {
        const k = d.indexOf(':');
        if (k < 0) continue;
        const name = d.slice(0, k).trim();
        if (name.startsWith('--')) into[name] = d.slice(k + 1).trim();
      }
    }
  }
}

/**
 * The raw (unresolved) token table a theme paints with. `scope: 'fd'` adds the shell's own tokens (`.fd`, and
 * `html.dark .fd` in dark) on top of the root ones, the way the cascade does inside the shell.
 */
export function rawTokens(theme: Theme, scope: 'root' | 'fd' = 'root'): TokenMap {
  const out: TokenMap = {};
  declared(css(GLOBALS), [':root'], out);
  if (theme === 'dark') declared(css(GLOBALS), ['html.dark'], out);
  if (scope === 'fd') {
    declared(css(FRONT_DOOR), ['.fd'], out);
    if (theme === 'dark') declared(css(FRONT_DOOR), ['html.dark .fd'], out);
  }
  return out;
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** Split `var(--a, fallback)` at its top-level comma. */
function varParts(inner: string): [string, string | null] {
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
  }
  return [inner.trim(), null];
}

/** Replace every `var(…)` in `value` with what it points at (textually, as the browser substitutes). */
export function substitute(value: string, table: TokenMap, depth = 0): string | null {
  if (depth > 12) return null;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf('var(', i);
    if (at < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    let d = 1;
    let j = at + 4;
    while (j < value.length && d > 0) {
      if (value[j] === '(') d++;
      else if (value[j] === ')') d--;
      j++;
    }
    const [name, fallback] = varParts(value.slice(at + 4, j - 1));
    const target = table[name];
    const next = target !== undefined ? substitute(target, table, depth + 1) : fallback !== null ? substitute(fallback, table, depth + 1) : null;
    if (next === null) return null;
    out += next;
    i = j;
  }
  return out.trim();
}

/** One opaque colour as `#rrggbb`, or null. Accepts hex, `R G B`, `rgb(R G B)`, `rgb(R, G, B)`. */
export function toHex(resolved: string): string | null {
  const v = resolved.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return `#${m[1]!.toLowerCase()}`;
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
  m = /^(?:rgb\(\s*)?(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/i.exec(v);
  if (m) return `#${hex2(Number(m[1]))}${hex2(Number(m[2]))}${hex2(Number(m[3]))}`;
  return null;
}

/** The token's colour in this theme as `#rrggbb`, or null when it is unset or not one opaque colour. */
export function tokenHex(name: string, theme: Theme, scope: 'root' | 'fd' = 'root'): string | null {
  const table = rawTokens(theme, scope);
  const raw = table[name.startsWith('--') ? name : `--${name}`];
  if (raw === undefined) return null;
  const s = substitute(raw, table);
  return s === null ? null : toHex(s);
}

/** Any CSS colour expression (`var(--x)`, `rgb(var(--x))`, a hex …) as `#rrggbb` in this theme, or null. */
export function colourHex(value: string, theme: Theme, scope: 'root' | 'fd' = 'root'): string | null {
  const s = substitute(value, rawTokens(theme, scope));
  return s === null ? null : toHex(s);
}

/** The token as an `[r, g, b]` triple, or null. */
export function tokenRgb(name: string, theme: Theme, scope: 'root' | 'fd' = 'root'): [number, number, number] | null {
  const h = tokenHex(name, theme, scope);
  return h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : null;
}
