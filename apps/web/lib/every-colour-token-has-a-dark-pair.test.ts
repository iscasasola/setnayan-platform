/**
 * EVERY SHARED COLOUR TOKEN HAS A DARK PAIR (dark mode PR 1, 2026-10-13).
 *
 * WHY THIS EXISTS. The owner approved how dark mode is turned on ("approve all", DECISION_LOG
 * 2026-10-13: tokens + colour scales first, then the dark contrast check, then the switch). The
 * measured map (`DARK_MODE_MAP_2026-10-13.md` § 2) found 88 colour tokens at `:root` in globals.css
 * and 13 in the shell (`front-door.css .fd`) with NO dark value — 3,659 `var()` reads in 308 files —
 * plus the success / warn / danger / info ramps hard-coded as hex in `tailwind.config.ts` (≈3,500
 * class uses). Every one of those would have stayed LIGHT on a dark page: white cards, espresso
 * words, pale chips. This file is what stops the next `--m-paper`.
 *
 * WHAT IT CHECKS, read from the real sources (never a hand-typed list of values):
 *   1. every `:root` / `html` token in globals.css whose value is a literal colour (hex, rgb/rgba,
 *      an `R G B` triple, color-mix, or a shadow made of them) is redeclared under `html.dark` —
 *      or sits in ALLOW below with its reason;
 *   2. every `.fd` colour token in the shell's front-door.css is redeclared under `html.dark .fd`;
 *   3. `tailwind.config.ts`'s `colors` block holds NO literal colour any more — each entry reads a
 *      token — and every token it reads has a dark pair (directly, or through a `var()` alias whose
 *      target has one), or is in ALLOW.
 *
 * WHAT IT DOES NOT CHECK: whether a dark value READS. That is arithmetic on pairs of tokens in use,
 * and it is `lint:contrast`'s job in both themes (PR 2). A pair being present is the precondition.
 *
 * ⚠ A dark pair may equal its light value on purpose (`--sn-ink-black`, ink on a light-gold fill
 * that stays light-gold). Write it out anyway — an explicit "same" is a decision; a missing one is
 * an accident nobody can tell apart from a decision.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

/**
 * Tokens that stay the same in both themes ON PURPOSE. Each needs a reason a reviewer can check.
 * Keys are token names without the leading `--`.
 */
const ALLOW: Record<string, string> = {
  // The gallery's obsidian SURFACE (archetype 02): dark in both themes by design — photographs carry
  // the colour and the chrome recedes. It is a surface, not a mode (globals.css explains why).
  'sn-ob-page': 'obsidian surface — dark in both themes',
  'sn-ob-card': 'obsidian surface — dark in both themes',
  'sn-ob-text': 'obsidian surface — dark in both themes',
  'sn-ob-soft': 'obsidian surface — dark in both themes',
  'sn-ob-cta': 'obsidian surface — dark in both themes',
  'sn-ob-gold': 'obsidian surface — dark in both themes',
  'sn-ob-link': 'obsidian surface — dark in both themes',
  // Glass OVER PHOTOS — already dark glass with a light hairline; the photo, not the theme, is under it.
  'sn-glass-dark-bg': 'glass over photos — the same in both themes',
  'sn-glass-dark-line': 'glass over photos — the same in both themes',
  // The guest Event Hub's own material tokens. The couple's design (their palette overrides these);
  // dark never changes the Hub (owner call 5, 2026-10-13).
  'color-gild': "the guest Hub's own — overridden by the couple's palette",
  'color-paper-deep': "the guest Hub's own — overridden by the couple's palette",
  'color-veil': "the guest Hub's own — overridden by the couple's palette",
  'color-ink-on-light': 'set only by dark Event Hub looks; falls back to --color-ink, which is paired',
  // The story's candle — the same colour at every wedding (owner ruling 2026-09-09); painted per
  // light-stage on the story's wrapper by lib/story-light.ts.
  'color-candle': 'the story candle — same at every wedding, painted by lib/story-light.ts',
  'color-candle-ink': 'the story candle rim — painted per light-stage by lib/story-light.ts',
};

const COLOUR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\bcolor-mix\(|^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/i;

type Block = { sel: string; body: string; ctx: string[] };

/** Innermost-first list of every rule block, with the at-rules it sits inside. */
function blocks(css: string): Block[] {
  const out: Block[] = [];
  const stack: string[] = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') {
      stack.push(buf.trim());
      buf = '';
    } else if (ch === '}') {
      const sel = stack.pop() ?? '';
      out.push({ sel, body: buf, ctx: [...stack] });
      buf = '';
    } else buf += ch;
  }
  return out;
}

const isDarkBlock = (b: Block) =>
  /(^|[\s,])html\.dark\b/.test(b.sel) || b.ctx.some((c) => /prefers-color-scheme:\s*dark/.test(c));

/** `{ light: name→value at the root selector, dark: names redeclared in a dark block }`. */
function tokens(file: string, rootSel: RegExp, darkSel: RegExp) {
  const light = new Map<string, string>();
  const dark = new Set<string>();
  for (const b of blocks(read(file))) {
    const inMediaOrSupports = b.ctx.some((c) => /^@(media|supports|container)/.test(c));
    for (const [, name = '', value = ''] of b.body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      if (isDarkBlock(b) && darkSel.test(b.sel)) dark.add(name);
      else if (rootSel.test(b.sel) && !inMediaOrSupports && !light.has(name)) light.set(name, value.trim());
    }
  }
  return { light, dark };
}

const G = tokens('app/globals.css', /^(:root|html)$/, /^html\.dark$/);
const FD = tokens('app/_components/frontdoor/front-door.css', /^\.fd$/, /^html\.dark \.fd$/);

test('the readers find what they are meant to find (a zero is a measurement, not a silence)', () => {
  // Fixed points that must be read, or the scan has gone blind.
  assert.equal(G.light.get('m-paper'), '#FFFFFF', 'globals.css --m-paper not read at :root');
  assert.equal(G.light.get('color-cream'), '255 255 255', 'globals.css --color-cream not read at :root');
  assert.ok(G.dark.has('color-cream'), 'the html.dark block of --color-cream was not read');
  assert.equal(FD.light.get('fd-cream'), '#ffffff', 'front-door.css .fd --fd-cream not read');
  const colourTokens = [...G.light].filter(([, v]) => COLOUR.test(v)).length;
  assert.ok(colourTokens > 150, `only ${colourTokens} colour tokens read at :root in globals.css — the parser broke`);
});

test('every colour token at :root in globals.css has a dark pair (or a reason not to)', () => {
  const missing = [...G.light]
    .filter(([n, v]) => COLOUR.test(v) && !G.dark.has(n) && !(n in ALLOW))
    .map(([n, v]) => `  --${n}: ${v}`);
  assert.deepEqual(
    missing,
    [],
    `\n${missing.length} colour token(s) at :root have no html.dark value — they will stay LIGHT on a dark page:\n` +
      missing.join('\n') +
      '\n\nAdd the dark value in the html.dark block right after its :root block (the approved warm set: ' +
      'page #17160F, card #232019, ink #FBFAF7), or — only if it is the same in both themes ON PURPOSE — ' +
      'add it to ALLOW in this file with the reason.\n',
  );
});

test('every colour token of the shell (.fd) has a dark pair', () => {
  const missing = [...FD.light]
    .filter(([n, v]) => COLOUR.test(v) && !FD.dark.has(n) && !(n in ALLOW))
    .map(([n, v]) => `  --${n}: ${v}`);
  assert.deepEqual(missing, [], `\nshell tokens with no html.dark .fd value:\n${missing.join('\n')}\n`);
});

test('an allowlisted token is really there and really unpaired (the list cannot rot)', () => {
  const twVars = tailwindVars();
  for (const name of Object.keys(ALLOW)) {
    const known = G.light.has(name) || twVars.has(name);
    assert.ok(known, `ALLOW names --${name}, which neither globals.css :root nor tailwind.config.ts reads — remove it`);
    assert.ok(!G.dark.has(name), `--${name} is in ALLOW but now HAS a dark value — take it out of ALLOW`);
  }
});

/** The `colors: { … }` block of tailwind.config.ts, comments stripped. */
function tailwindColours(): string {
  const tw = read('tailwind.config.ts');
  const start = tw.indexOf('colors: {');
  assert.ok(start !== -1, 'no `colors: {` block in tailwind.config.ts');
  let depth = 0;
  for (let i = tw.indexOf('{', start); i < tw.length; i++) {
    if (tw[i] === '{') depth++;
    else if (tw[i] === '}' && --depth === 0) return tw.slice(start, i + 1);
  }
  throw new Error('unbalanced colors block');
}

/** Every `--x` the colours block reads (the first var() of each value — the one that is not a fallback). */
function tailwindVars(): Set<string> {
  const out = new Set<string>();
  for (const [, value = ''] of tailwindColours().matchAll(/'([^']+)'/g)) {
    const v = value.match(/var\(\s*--([a-z0-9-]+)/i);
    if (v?.[1]) out.add(v[1]);
  }
  return out;
}

test('tailwind.config.ts colours hold no literal colour — each reads a token', () => {
  const literals: string[] = [];
  for (const line of tailwindColours().split('\n')) {
    const m = line.match(/^\s*'?([A-Za-z0-9-]+)'?\s*:\s*'([^']+)'/);
    if (!m) continue;
    const [, key = '', value = ''] = m;
    // A literal INSIDE a var() fallback (`var(--color-candle, 217 164 65)`) is a fallback, not the value.
    const withoutVars = value.replace(/var\([^()]*\)/g, '');
    if (/#[0-9a-f]{3,8}\b|\brgba?\(\s*\d/i.test(withoutVars)) literals.push(`  ${key}: '${value}'`);
  }
  assert.deepEqual(
    literals,
    [],
    `\n${literals.length} Tailwind colour(s) are literal again — they cannot follow the theme:\n${literals.join('\n')}\n` +
      'Give it a `--ramp-…` triple in globals.css (light = the hex, plus an html.dark value) and write ' +
      "`'rgb(var(--ramp-…) / <alpha-value>)'`.\n",
  );
});

test('every token the Tailwind palette reads has a dark pair', () => {
  /** Paired directly, or a `var(--y)` alias whose target is paired. */
  const paired = (name: string, seen = new Set<string>()): boolean => {
    if (G.dark.has(name) || name in ALLOW) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    const alias = G.light.get(name)?.match(/^var\(\s*--([a-z0-9-]+)\s*\)$/);
    return alias?.[1] ? paired(alias[1], seen) : false;
  };
  const vars = tailwindVars();
  assert.ok(vars.size > 80, `only ${vars.size} tokens read from the Tailwind colours — the reader broke`);
  const missing = [...vars].filter((n) => !paired(n)).map((n) => `  --${n}`);
  assert.deepEqual(missing, [], `\nTailwind reads token(s) with no dark value:\n${missing.join('\n')}\n`);
});
