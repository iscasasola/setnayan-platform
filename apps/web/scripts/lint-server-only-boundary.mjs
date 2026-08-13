#!/usr/bin/env node
/**
 * lint-server-only-boundary.mjs — a `'use client'` file may not reach a
 * `server-only` module through a VALUE import, at any depth.
 *
 * WHY THIS EXISTS
 * ---------------
 * `ugat-console.tsx` ('use client') imported the value `UGAT_TABLE_KEYS` from
 * `lib/ugat/data.ts`, whose first line is `import 'server-only'`. Result:
 *
 *     Failed to compile.
 *     You're importing a component that needs "server-only".
 *
 * Five CI checks red, ~20 minutes of build time, and a PR that could never
 * merge — for a one-line import.
 *
 * 🔑 NOTHING ELSE IN THE TOOLCHAIN CAN SEE THIS. `tsc` typechecks; it is not a
 * bundler and does not know what `'use client'` means. The unit tests import
 * modules directly in node, where `server-only` resolves happily. `next build`
 * is the sole detector, it takes minutes, and it cannot run locally on this
 * machine (7 GB heap → SIGTERM). So the feedback loop for this mistake was
 * "open a PR and wait". This script closes it to about a second.
 *
 * WHAT COUNTS
 * -----------
 * - Only VALUE imports. `import type { X } from '…'` and `import { type X }`
 *   are erased at compile time and are always safe. An import with NO
 *   specifiers at all (`import '…'`) is a side-effect import, and DOES count.
 * - Transitively. A client file importing a clean module that itself imports a
 *   server-only module is equally broken, so the walk follows value edges to
 *   any depth and reports the whole chain.
 *
 * 🪤 COMMENTS ARE STRIPPED FIRST, DELIBERATELY. This repo has shipped five
 * separate guards that matched their own explanatory comments — including one
 * whose comment named the very import it was hunting. The files this script
 * scans now contain lines like "must come from data-pure, NOT @/lib/ugat/data",
 * which is exactly the text a naive scanner would flag. Block comments are
 * removed before line comments: a props type's `}: {` followed by a docblock
 * makes `{ /* … *\/ }` match across real code, and that ate 2.4 KB of source
 * the last time it was done in the other order.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'lib', 'components'];
const EXTS = ['.ts', '.tsx'];

/** Strip block comments FIRST, then line comments. Order is load-bearing. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => walk(join(WEB_ROOT, d)));
const rel = (p) => relative(WEB_ROOT, p);

/** Resolve a specifier to an on-disk file, or null if external/unresolvable. */
function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(WEB_ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules / bare — not ours
  for (const ext of EXTS) {
    const c = base + ext;
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* keep trying */
    }
  }
  for (const ext of EXTS) {
    const c = join(base, 'index' + ext);
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

const srcCache = new Map();
function source(file) {
  if (!srcCache.has(file)) {
    let raw = '';
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      /* unreadable — treat as empty */
    }
    srcCache.set(file, { raw, clean: stripComments(raw) });
  }
  return srcCache.get(file);
}

const isClient = (file) => /(^|\n)\s*['"]use client['"]/.test(source(file).clean);

/**
 * MODULES DECLARED AS A BOUNDARY WITHOUT CARRYING `import 'server-only'`.
 *
 * 🪤 WHY NOT JUST WRITE `import 'server-only'` IN THEM? Because `server-only` is
 * a Next BUNDLER ALIAS and there is no installed package by that name in this
 * workspace — a module that imports it becomes unloadable under `tsx --test`,
 * which is how every rule in `lib/` is proved. Measured: of the 171 server-only
 * modules in this repo, exactly ZERO have a co-located unit test. That is not a
 * coincidence, and a privacy rule that cannot be unit-tested is a worse trade
 * than a boundary declared here.
 *
 * ⚠ THE SERVICE-ROLE CLIENT ITSELF IS NOT ON THIS LIST, AND THAT IS A KNOWN
 * GAP, NOT AN OVERSIGHT. `lib/supabase/admin.ts` bypasses RLS, and its own
 * docblock says "Never import this from a client component" — a sentence, not a
 * mechanism. Adding it here was tried on 2026-08-13 and reports **23**
 * pre-existing client→…→admin chains (reveal-config, entitlements,
 * promo-free-windows, papic-cameras, live-studio-*, v2-catalog). They compile
 * today because the bundler drops the unused edge, so this is latent risk
 * rather than a live leak — but 23 findings landed as a baseline would be a
 * bill nobody pays, and a guard that cries wolf 23 times teaches you to skim
 * past the one time it is right. Fixing those chains is its own piece of work.
 */
const EXTRA_BOUNDARY_MODULES = [
  // Reads the two-person story intersection through the service-role client.
  // Nothing in a browser bundle has any business reaching it.
  'lib/person-life-stories.ts',
];
const extraBoundaryPaths = new Set(
  EXTRA_BOUNDARY_MODULES.map((p) => join(WEB_ROOT, p)),
);
const isServerOnly = (file) =>
  extraBoundaryPaths.has(file) ||
  /(^|\n)\s*import\s+['"]server-only['"]/.test(source(file).clean);

/**
 * A `'use server'` module is a BOUNDARY, not an edge to follow.
 *
 * 🪤 The first cut of this script did follow it, and reported 157 violations —
 * every single one a client component importing a server action, which is the
 * normal and correct Next.js pattern. The action is compiled to an RPC
 * reference; its body never ships to the browser, so what it imports is its own
 * business. A guard that cries wolf 157 times teaches you to skim past the one
 * time it is right, which is the entire failure mode this script exists to
 * prevent. The walk therefore stops here.
 */
const isServerAction = (file) => /(^|\n)\s*['"]use server['"]/.test(source(file).clean);

/**
 * Value-import specifiers of a module. Skips `import type …` and imports whose
 * every named specifier carries the inline `type` keyword.
 */
function valueImports(file) {
  const { clean } = source(file);
  const out = [];
  // 🪤 The clause may NOT contain a quote or a semicolon. Without that, a
  // side-effect import (`import './x.css';` — no `from`) lets the lazy match run
  // straight through it and capture the NEXT statement's `from`, inheriting the
  // wrong specifier AND losing its `type` keyword. That misread a correct
  // `import type { JointVerdict }` as a value import on the first run here.
  const re = /import\s+(type\s+)?([^;'"]*?)\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(clean))) {
    const [, typeKw, clause, spec] = m;
    if (typeKw) continue; // import type { … } from '…'
    const braced = clause.match(/\{([\s\S]*)\}/);
    if (braced && !/(^|,)\s*[A-Za-z_$*]/.test(clause.replace(/\{[\s\S]*\}/, ''))) {
      const names = braced[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // every named specifier is `type X` ⇒ whole import is erased
      if (names.length > 0 && names.every((n) => /^type\s/.test(n))) continue;
    }
    out.push(spec);
  }
  // bare side-effect imports: import '…'
  const bare = /import\s*['"]([^'"]+)['"]/g;
  while ((m = bare.exec(clean))) out.push(m[1]);

  // 🪤 RE-EXPORTS ARE VALUE EDGES TOO. `export { x } from './y'` and
  // `export * from './y'` both pull y's module into the graph exactly like an
  // import does — this file's own `data.ts` re-exports the table tuple that
  // way. A mutation test caught this hole: a client → clean-module →
  // server-only chain went UNDETECTED because the middle link was a re-export.
  // `export type { … } from` is erased and stays excluded.
  const reExport = /export\s+(type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^;'"]*\})\s*from\s*['"]([^'"]+)['"]/g;
  while ((m = reExport.exec(clean))) {
    if (m[1]) continue; // export type { … } from '…'
    out.push(m[2]);
  }
  return out;
}

/** BFS from a client file down value edges; return the first chain that lands on server-only. */
function findServerOnlyChain(entry) {
  const seen = new Set([entry]);
  const queue = [[entry]];
  while (queue.length) {
    const chain = queue.shift();
    const file = chain[chain.length - 1];
    for (const spec of valueImports(file)) {
      const target = resolveSpec(spec, file);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      if (isServerAction(target)) continue; // RPC boundary — its imports don't ship
      const next = [...chain, target];
      if (isServerOnly(target)) return next;
      queue.push(next);
    }
  }
  return null;
}

const violations = [];
let clientCount = 0;
for (const f of FILES) {
  if (!isClient(f)) continue;
  clientCount++;
  const chain = findServerOnlyChain(f);
  if (chain) violations.push(chain);
}

const serverOnlyCount = FILES.filter(isServerOnly).length;

if (violations.length > 0) {
  console.error(
    `\n✖ lint-server-only-boundary: ${violations.length} client file(s) reach a server-only module.\n`,
  );
  for (const chain of violations) {
    console.error(`  ${rel(chain[0])}  ('use client')`);
    for (let i = 1; i < chain.length; i++) {
      const last = i === chain.length - 1;
      const why = extraBoundaryPaths.has(chain[i])
        ? '  ← declared a boundary (EXTRA_BOUNDARY_MODULES)'
        : "  ← import 'server-only'";
      console.error(`    ${last ? '└─▶' : '├─▶'} ${rel(chain[i])}${last ? why : ''}`);
    }
    console.error('');
  }
  console.error(
    "  Fix: move the value into a client-safe module (a `*-pure.ts` sibling is the\n" +
      '  established pattern here) and re-export it from the server-only module so\n' +
      '  server callers keep their import path. If you only need the TYPE, write\n' +
      "  `import type` — types are erased and never cross the boundary.\n",
  );
  process.exit(1);
}

console.log(
  `✓ lint-server-only-boundary: ${clientCount} client files, ` +
    `${serverOnlyCount} server-only modules, no value import crosses the boundary.`,
);
