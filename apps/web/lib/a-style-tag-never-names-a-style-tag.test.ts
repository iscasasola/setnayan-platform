/**
 * A <style> TAG'S TEXT NEVER CONTAINS "<style" OR "</style" — NOT EVEN INSIDE A CSS COMMENT.
 *
 * Found by the W5 signed-out walk (B3) and pinned down 2026-11-18 on live www.setnayan.com:
 * `/u/icecasa` threw React hydration error #418 (`args[]=text`) on 6 of 6 loads, phone and
 * desktop, signed out, with every POST aborted (so no beacon or server action was involved). An
 * instrumented walk recorded every `textContent` read during hydration: the only one before the
 * throw was the page's `<style>{UPROF_CSS}</style>`, whose CSS comment ended "…rather than
 * shipping a second <style> block."
 *
 * ── WHY THAT THROWS ─────────────────────────────────────────────────────────────────────────────
 * React's server renderer protects a <style> element from being closed early by its own text: it
 * rewrites every `<style` / `</style` (any case) in the children to the CSS escape `<\73 tyle`
 * (react-dom-server `styleRegex` / `styleReplacer`). The browser keeps that text verbatim, so the
 * element's `textContent` is no longer the string the client renders, and hydration compares the
 * two: a TEXT mismatch, React discards the server's tree and redraws the page, on every load.
 * Harmless to the CSS (it was a comment) and invisible on screen, which is why nobody saw it.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ─────────────────────────────────────────────────────────────
 * 1. The mechanism is real in the React this repo ships (so the rule is not superstition, and the
 *    day React stops rewriting, this test says so).
 * 2. Every `<style …>{NAME}</style>` in app/, lib/ and components/ whose NAME is a `const NAME =
 *    \`…\`` template literal — in the same file, or imported from one by name — has a value free
 *    of `<style` and `</style`. A detector self-test and a population floor keep it from going
 *    vacuous. ⚠ It does NOT reach CSS built by a FUNCTION call (`blockLooksCss(…)`) — those values
 *    exist only at run time; a function that could emit the text needs its own test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMES_A_STYLE_TAG = /<\/?style/i;

test('React rewrites "<style" inside <style> children, so server HTML ≠ the client string', () => {
  const css = '/* a second <style> block */ .x{color:red} /* </style> */';
  const html = renderToString(createElement('style', null, css));
  assert.ok(!html.includes(css), 'React no longer rewrites <style inside <style> children — this guard may be retired');
  assert.match(html, /<\\73 tyle/, 'expected the CSS escape React writes for "<style"');
  // and a value without the text survives untouched, which is what the fix relies on
  const clean = '/* a second style block */ .x{color:red}';
  assert.ok(renderToString(createElement('style', null, clean)).includes(clean));
});

/** The body of the template literal that starts at `src[open]` (a backtick), `${…}` nesting included. */
function templateAt(src: string, open: number): string | null {
  let i = open + 1;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (depth === 0 && c === '`') return src.slice(open + 1, i);
    if (c === '$' && src[i + 1] === '{') {
      depth++;
      i++;
    } else if (c === '}' && depth > 0) depth--;
  }
  return null;
}

/** `const NAME = \`…\`` (optionally exported / typed) in `src` → the literal's body. */
function constTemplate(src: string, name: string): string | null {
  const m = new RegExp(`(?:^|[\\s;])(?:export\\s+)?const\\s+${name}\\b\\s*(?::[^=]+)?=\\s*\``, 'm').exec(src);
  return m ? templateAt(src, m.index + m[0].length - 1) : null;
}

/** The NAMEs used as `<style …>{NAME}</style>` children. Attributes may hold `{…}` spreads. */
function styleChildNames(src: string): string[] {
  return [...src.matchAll(/<style\b(?:[^>{]|\{[^}]*\})*>\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*<\/style>/g)].map((m) => m[1]!);
}

function resolveImport(from: string, name: string, src: string): string | null {
  const m = new RegExp(`import\\s*(?:type\\s*)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`).exec(src);
  if (!m) return null;
  const spec = m[1]!;
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(c)) return c;
  return null;
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.tsx') && !n.includes('.test.')) out.push(p);
    }
  };
  for (const r of ['app', 'lib', 'components']) walk(join(WEB, r));
  return out;
}

/** Every <style> child this file renders that resolves to a const template: [where, value]. */
function resolvedStyleValues(file: string, src: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const name of new Set(styleChildNames(src))) {
    let value = constTemplate(src, name);
    let where = relative(WEB, file);
    if (value === null) {
      const def = resolveImport(file, name, src);
      if (def) {
        value = constTemplate(readFileSync(def, 'utf8'), name);
        where = `${where} ← ${relative(WEB, def)}`;
      }
    }
    if (value !== null) out.push([`${where} · ${name}`, value]);
  }
  return out;
}

test('the detector catches the shape that threw #418 on /u/<slug>', () => {
  const fixture = [
    'const UPROF_CSS = `',
    '  /* keep them here rather than shipping a second',
    '     <style> block. */',
    '  .uprof-md { margin-top: ${GAP}; }',
    '`;',
    'export default function P() { return <main><style>{UPROF_CSS}</style></main>; }',
  ].join('\n');
  const found = resolvedStyleValues(join(WEB, 'app/fixture.tsx'), fixture);
  assert.equal(found.length, 1, 'the resolver no longer resolves a same-file const passed to <style>');
  assert.ok(NAMES_A_STYLE_TAG.test(found[0]![1]), 'the detector no longer sees "<style" in a CSS comment');
});

test('no <style> child in app/, lib/ or components/ contains "<style" or "</style"', () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('<style')) continue;
    for (const [where, value] of resolvedStyleValues(file, src)) {
      checked++;
      const hit = value.match(/.{0,40}<\/?style.{0,20}/is);
      if (hit) offenders.push(`${where}: …${hit[0].replace(/\s+/g, ' ')}…`);
    }
  }
  // Population floor (measured 2026-11-18: 23). Far below it means the resolver broke, not that the tree is clean.
  assert.ok(checked >= 12, `only ${checked} <style> children resolved — the resolver has stopped resolving`);
  assert.deepEqual(
    offenders,
    [],
    `React rewrites "<style"/"</style" inside <style> text (to "<\\73 tyle"), so the server HTML stops matching the ` +
      `client string — hydration error #418 on every load. Reword the CSS (e.g. "style block"):\n  ${offenders.join('\n  ')}`,
  );
});
