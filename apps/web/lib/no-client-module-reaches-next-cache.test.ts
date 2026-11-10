/**
 * NO MODULE A CLIENT COMPONENT IMPORTS MAY IMPORT `next/cache` (speed, 2026-11-10 · PR #7438).
 *
 * `revalidateTag` / `revalidatePath` / `unstable_cache` work only on the server. Next refuses the whole production
 * build when a `'use client'` file reaches them through ANY chain of imports. The way it slipped in: a save helper in a
 * shared lib (`lib/guest-reviews.ts`) started clearing the shop's cached page itself, and a client form
 * (`guest-review-form.tsx`) imports that same lib for a constant. Every unit test stayed green. Only the CI build
 * failed: "You're importing a component that needs revalidateTag".
 *
 * The rule is that the revalidate call lives in the ACTION (a `'use server'` file, which a client may import, because
 * it crosses as a reference). Shared libs return what changed. `lib/shop-page-cache.ts` is `server-only`, so a slip
 * fails loudly at build. This walk catches the slip before the build does: it starts at every `'use client'` file,
 * follows value imports and stops at `'use server'` modules.
 *
 * Run: npx tsx --test lib/no-client-module-reaches-next-cache.test.ts   (from apps/web)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { WEB_ROOT, resolveImport } from './rsc-function-props';

const rel = (abs: string) => path.relative(WEB_ROOT, abs).split(path.sep).join('/');
const ROOTS = ['app', 'lib', 'components'].map((d) => path.join(WEB_ROOT, d)).filter((d) => fs.existsSync(d));

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function directive(sf: ts.SourceFile): 'client' | 'server' | null {
  for (const st of sf.statements) {
    if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) {
      if (st.expression.text === 'use client') return 'client';
      if (st.expression.text === 'use server') return 'server';
      continue;
    }
    break;
  }
  return null;
}

/** Value (non-type) import specifiers, static and dynamic. */
function valueImports(sf: ts.SourceFile, src: string): string[] {
  const out: string[] = [];
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      const c = st.importClause;
      if (c?.isTypeOnly) continue;
      // `import { type A, type B } from 'x'` is erased too.
      if (c && !c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly)) continue;
      out.push(st.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && !st.isTypeOnly) out.push(st.moduleSpecifier.text);
  }
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!);
  return out;
}

const parsed = new Map<string, { sf: ts.SourceFile; src: string }>();
function parse(f: string) {
  let p = parsed.get(f);
  if (!p) {
    const src = fs.readFileSync(f, 'utf8');
    p = { sf: ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), src };
    parsed.set(f, p);
  }
  return p;
}

/** Every module some `'use client'` file reaches → one client root that reaches it (for the message). */
function clientReach(): { clients: number; reached: Map<string, string> } {
  const all = ROOTS.flatMap((d) => walkFiles(d));
  const clients = all.filter((f) => directive(parse(f).sf) === 'client');
  const reached = new Map<string, string>();
  for (const root of clients) {
    const stack = [root];
    while (stack.length) {
      const f = stack.pop()!;
      if (reached.has(f)) continue;
      reached.set(f, root);
      const { sf, src } = parse(f);
      // A `'use server'` module crosses into a client as a reference. Its own imports stay on the server.
      if (f !== root && directive(sf) === 'server') continue;
      for (const spec of valueImports(sf, src)) {
        const r = resolveImport(f, spec);
        if (r && /\.tsx?$/.test(r) && !reached.has(r)) stack.push(r);
      }
    }
  }
  return { clients: clients.length, reached };
}

const { clients, reached } = clientReach();

test('the walk is real: it finds the client files and reaches the shared libs they import', () => {
  assert.ok(clients > 200, `only ${clients} 'use client' files found — the walk is broken`);
  const form = [...reached.keys()].map(rel);
  assert.ok(form.includes('lib/guest-reviews.ts'), 'the client guest-review form no longer reaches lib/guest-reviews.ts — pick another witness');
});

test('no module a client component reaches imports `next/cache` (or the server-only shop-page cache)', () => {
  const bad: string[] = [];
  for (const [f, root] of reached) {
    const { sf, src } = parse(f);
    if (directive(sf) === 'server' && f !== root) continue;
    for (const spec of valueImports(sf, src)) {
      if (spec === 'next/cache' || spec === '@/lib/shop-page-cache' || /(^|\/)shop-page-cache$/.test(spec)) {
        bad.push(`${rel(f)} imports '${spec}' — reached from the client file ${rel(root)}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'move the revalidate call into the server action; the shared lib returns what changed');
});

test('lib/shop-page-cache.ts is server-only — a slip fails the build by name, not by a Next internal', () => {
  const src = fs.readFileSync(path.join(WEB_ROOT, 'lib/shop-page-cache.ts'), 'utf8');
  assert.match(src, /^import 'server-only';$/m);
});
