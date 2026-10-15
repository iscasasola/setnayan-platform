/**
 * nothing-touches-the-root-before-hydration.test.ts — NO INLINE SCRIPT CHANGES AN ATTRIBUTE REACT RENDERS ON
 * `<html>` OR `<body>`.
 *
 * Batch 8 tester, 2026-10-15 (W1, WRONG): since Cover Scene joined, EVERY guest page hydrated with
 * "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't
 * be patched up" — on `<html className>`. `CoverSceneMenuWaits` ran `classList.add('sn-cover-wait')` on the root
 * from an inline script, before React hydrated, and `app/layout.tsx` renders that `className` itself. The Veil's
 * builder had hit the identical fault in the same batch (`data-veiled` on `<html>`) and moved the signal to a
 * `<style>` in `<head>` (`lib/hub-veil.ts`). Two builders, one week, one fault — so it is held here, not remembered.
 *
 * ── The property ──────────────────────────────────────────────────────────────────────────────────────────────
 * An inline script is code carried as TEXT (a string or template literal handed to `dangerouslySetInnerHTML`, or a
 * script string a module exports). Runtime code in an effect runs after hydration and is not text, so it is not
 * read here. Every string/template literal in app/ lib/ components/ that reaches `document.documentElement` or
 * `document.body` (directly or through a local alias such as `var r=document.documentElement`) must not:
 *   · change the class list or `className` (React renders `className` on both — `app/layout.tsx`),
 *   · change `style` (React renders `style` on `<html>`),
 *   · set / remove / toggle any attribute React renders there (read from `app/layout.tsx`'s own `<html …>` and
 *     `<body …>`, so a new rendered attribute is covered the day it is added).
 * A data attribute React does NOT render (`data-sn-boot`, the STD film's seen mark) is fine — React leaves it.
 * The safe doors: a `<style data-…>` in `<head>` (React 19 skips unexpected head nodes) or such a data attribute.
 *
 * Pre-existing scripts that predate this guard are named, with a reason, in
 * `nothing-touches-the-root-before-hydration.allowlist.txt`; a stale row fails, so the list only shrinks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const WEB = join(__dirname, '..');
const ROOTS = ['app', 'lib', 'components'];
const ALLOWLIST = join(__dirname, 'nothing-touches-the-root-before-hydration.allowlist.txt');

/** The attributes `app/layout.tsx` renders on `<html>` and `<body>` (className → class). */
export function renderedRootAttrs(layoutSrc: string): { html: Set<string>; body: Set<string> } {
  /* The JSX element, not a comment's "<html>": the tag name is followed by whitespace and its attributes, and the
     tag closes on a line of its own (html) or at the first `>` outside a `{…}` (body). */
  const pick = (tag: string): Set<string> => {
    const m = layoutSrc.match(new RegExp(`<${tag}\\s+([A-Za-z][\\s\\S]*?)(?:\\n\\s*>|"\\s*>)`));
    const out = new Set<string>();
    if (!m) return out;
    for (const a of (m[1] ?? '').matchAll(/(?:^|\s)([A-Za-z][\w-]*)=/g)) out.add(a[1] === 'className' ? 'class' : (a[1] ?? ''));
    return out;
  };
  return { html: pick('html'), body: pick('body') };
}

/** The faults in one piece of script text: `[root, what]`, e.g. `['html', 'class']`. */
export function rootMutations(text: string, rendered: { html: Set<string>; body: Set<string> }): Array<[string, string]> {
  if (!/document/.test(text)) return [];
  const docAliases = ['document', ...[...text.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*document\b(?!\s*\.)/g)].map((m) => m[1] ?? '').filter(Boolean)];
  const doc = `(?:${docAliases.map((a) => a.replace(/\$/g, '\\$')).join('|')})`;
  const targets: Array<[string, string]> = [];
  for (const [root, prop] of [['html', 'documentElement'], ['body', 'body']] as const) {
    const aliases = [...text.matchAll(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*=\\s*${doc}\\.${prop}\\b`, 'g'))].map((m) => (m[1] ?? '').replace(/\$/g, '\\$')).filter(Boolean);
    targets.push([root, `(?:${[`${doc}\\.${prop}`, ...aliases.map((a) => `\\b${a}`)].join('|')})`]);
  }
  const out: Array<[string, string]> = [];
  for (const [root, t] of targets) {
    const attrs = rendered[root as 'html' | 'body'];
    if (new RegExp(`${t}\\.(?:classList\\.(?:add|remove|toggle|replace)|className\\s*[+]?=)`).test(text)) out.push([root, 'class']);
    if (attrs.has('style') && new RegExp(`${t}\\.style\\b`).test(text)) out.push([root, 'style']);
    for (const m of text.matchAll(new RegExp(`${t}\\.(?:setAttribute|removeAttribute|toggleAttribute)\\(\\s*['"]([\\w-]+)`, 'g'))) {
      const a = m[1] === 'className' ? 'class' : (m[1] ?? '');
      if (attrs.has(a)) out.push([root, a]);
    }
    if (attrs.has('lang') && new RegExp(`${t}\\.lang\\s*=`).test(text)) out.push([root, 'lang']);
  }
  return out;
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((s) => `\${}${s.literal.text}`).join('');
  return null;
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
}

function scan(): Map<string, Set<string>> {
  const rendered = renderedRootAttrs(readFileSync(join(WEB, 'app/layout.tsx'), 'utf8'));
  const files: string[] = [];
  for (const r of ROOTS) walk(join(WEB, r), files);
  const found = new Map<string, Set<string>>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!/document\.|=\s*document\b/.test(src)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n: ts.Node): void => {
      const text = literalText(n);
      if (text !== null) {
        for (const [root, what] of rootMutations(text, rendered)) {
          const key = relative(WEB, f);
          if (!found.has(key)) found.set(key, new Set());
          found.get(key)!.add(`${root}.${what}`);
        }
        if (!ts.isTemplateExpression(n)) return;
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return found;
}

function allowlist(): Set<string> {
  return new Set(
    readFileSync(ALLOWLIST, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/).slice(0, 2).join(' ')),
  );
}

test('(1) the detector catches each shape of a root change, and passes the safe doors', () => {
  const rendered = { html: new Set(['lang', 'class', 'style', 'data-loader-variant']), body: new Set(['class']) };
  const hit = (s: string) => rootMutations(s, rendered).map(([r, w]) => `${r}.${w}`);
  assert.deepEqual(hit(`(function(){var r=document.documentElement;r.classList.add('sn-cover-wait')})()`), ['html.class'], 'an aliased root class change');
  assert.deepEqual(hit(`document.documentElement.classList.add('x')`), ['html.class']);
  assert.deepEqual(hit(`var d=document;d.body.className='x'`), ['body.class'], 'a document alias');
  assert.deepEqual(hit(`document.documentElement.style.setProperty('--a','1')`), ['html.style']);
  assert.deepEqual(hit(`document.documentElement.setAttribute('lang','fil')`), ['html.lang']);
  assert.deepEqual(hit(`document.documentElement.setAttribute('data-loader-variant','x')`), ['html.data-loader-variant']);
  assert.deepEqual(hit(`document.documentElement.setAttribute('data-sn-boot','1')`), [], 'a data attribute React does not render is a safe door');
  assert.deepEqual(hit(`var m=document.createElement('style');m.setAttribute('data-cover-menu','wait');document.head.appendChild(m)`), [], 'a <style> in <head> is the safe door');
  assert.deepEqual(hit(`.sn-sheet-js .x{color:red}`), [], 'CSS text naming a class is not a change');
});

test('(2) layout.tsx still renders the attributes this guard protects (so the read is not empty)', () => {
  const r = renderedRootAttrs(readFileSync(join(WEB, 'app/layout.tsx'), 'utf8'));
  assert.ok(r.html.has('class'), `<html> attributes read as ${[...r.html].join(', ') || 'none'} — the layout read broke`);
  assert.ok(r.body.has('class'), `<body> attributes read as ${[...r.body].join(', ') || 'none'} — the layout read broke`);
});

test('(3) no inline script changes an attribute React renders on <html> or <body> (outside the reasoned allowlist)', () => {
  const found = scan();
  const allowed = allowlist();
  const fresh: string[] = [];
  for (const [file, whats] of found) for (const w of whats) if (!allowed.has(`${file} ${w}`)) fresh.push(`${file} ${w}`);
  assert.deepEqual(
    fresh,
    [],
    `an inline script changes what React renders on the root BEFORE hydration — React will not patch it up and every page logs a hydration mismatch. Use a <style data-…> in <head> (lib/hub-veil.ts, cover-scene-menu.tsx) or a data attribute React does not render:\n  ${fresh.join('\n  ')}`,
  );
  const stale = [...allowed].filter((row) => {
    const [file = '', w = ''] = row.split(' ');
    return !found.get(file)?.has(w);
  });
  assert.deepEqual(stale, [], `allowlist rows that no longer match — delete them:\n  ${stale.join('\n  ')}`);
});

test('(4) the Cover Scene menu, the one that shipped the fault, keeps off the root', () => {
  const found = scan();
  assert.equal(found.get('app/[slug]/_components/cover-scene-menu.tsx'), undefined, 'CoverSceneMenuWaits changes <html> before hydration again');
});
