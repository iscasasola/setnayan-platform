/**
 * ⚡ DETAILS PIECES ARE LAZY — NONE OF THEM RIDES IN THE MAKER'S FIRST LOAD.
 *
 * Owner, 2026-09-29: *"the Maker must never be slow"*. The Maker's first-load
 * JavaScript has a ceiling (`scripts/check-maker-js-budget.mjs`), and folding
 * Details in (theme gallery, prints, Your event, Words, Love Story, Schedule,
 * RSVP, Mood Board, Logo, Hero, Reveal) blew it: 643.5KB against 505KB, with
 * Details shut on a cold open.
 *
 * 🔑 THE MECHANISM THIS GUARD HOLDS. Next puts every `'use client'` module that
 * a route's SERVER files import into that route's first load, eagerly — drawn
 * or not. So a piece leaves the first load only when the Maker's server graph
 * reaches it through a client-side `import()`: the stand-ins in
 * `details-lazy.tsx`, `mood-board-lazy.tsx`, `schedule-lazy.tsx`,
 * `entourage-lazy.tsx` and `seating-lazy.tsx`.
 *
 * ── WHAT IT CLAIMS, AS PROPERTIES (no list of file names to keep in step) ───
 *   1. Walk the Maker route's server graph from `launch/page.tsx` the way Next
 *      does — static imports (not `import type`), stopping at each
 *      `'use client'` module, which is a client boundary. NO module that a
 *      lazy stand-in loads with `import()` is one of those boundaries. (A server
 *      file that imports `./maker-logo` again — instead of the stand-in — fails
 *      here, naming the file.)
 *   2. Every export of a stand-in module is a `dynamic(() => import(…))`, and
 *      the module imports none of its pieces statically — a stand-in that
 *      pulled its piece in would be a first-load import with extra steps.
 *   2b. Every `import()` in a stand-in names its chunk group
 *      (`webpackChunkName: "maker-…"`). Each unnamed `import()` is its own
 *      async chunk, and webpack's runtime — loaded on EVERY page, inside the
 *      shared-bundle ceiling (`check-bundle-size.mjs`) — carries one map entry
 *      per chunk in the app: the first cut of this split (37 unnamed imports)
 *      grew that runtime 4.0KB → 4.9KB and put the shared bundle 0.5KB over.
 *      Named, the pieces travel as a handful of chunks (Details' editors load
 *      together anyway — they share one words form).
 *   3. Nothing the first load reaches — the boundaries and every module they
 *      import statically, transitively — imports a heavy library (three.js,
 *      react-three, opentype.js, fabric). Those load with the one tool that
 *      draws them, by `import()`.
 * Floors prove the walk is not vacuous: it reaches the Details, Mood Board and
 * Schedule server files, the three stand-ins are boundaries, and the stand-ins
 * name a real population of pieces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(__dirname, '../../../../..');
const PAGE = join(WEB, 'app/dashboard/[eventId]/launch/page.tsx');
const STAND_INS = [
  'app/dashboard/[eventId]/launch/_components/details-lazy.tsx',
  'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-lazy.tsx',
  'app/dashboard/[eventId]/schedule/_components/schedule-lazy.tsx',
  'app/dashboard/[eventId]/guests/_components/entourage-lazy.tsx',
  'app/dashboard/[eventId]/seating/_components/seating-lazy.tsx',
];
const HEAVY = /^(?:three(?:\/.*)?|@react-three\/.+|opentype\.js|fabric(?:\/.*)?)$/;

const rel = (p: string) => relative(WEB, p);
const read = (p: string) => readFileSync(p, 'utf8');
const isClient = (src: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(src);

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (/\.(tsx?|jsx?|mjs)$/.test(c) && existsSync(c)) return c;
  }
  return null;
}

/** Static, value-carrying import specifiers of a module (never `import type`, never `import()`). */
export function staticImports(src: string): string[] {
  const s = stripComments(src);
  const out: string[] = [];
  const re = /(?:^|[;\n}])\s*(import|export)\s+(type\s+)?([^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[2]) continue; // `import type … from` / `export type … from`
    if (m[1] === 'export' && !m[3]) continue;
    out.push(m[4]!);
  }
  return out;
}

/** `import('…')` specifiers — what a stand-in loads later. */
export function dynamicImports(src: string): string[] {
  return [...stripComments(src).matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!);
}

/** The route's server graph as Next reads it: server files walked, client modules are boundaries. */
function serverGraph(entry: string) {
  const server = new Set<string>();
  const boundaries = new Map<string, string>(); // client module → the server file that imported it
  const stack: Array<[string, string]> = [[entry, '(entry)']];
  while (stack.length) {
    const [f, via] = stack.pop()!;
    if (server.has(f) || boundaries.has(f)) continue;
    const src = read(f);
    if (isClient(src)) {
      boundaries.set(f, via);
      continue;
    }
    server.add(f);
    for (const spec of staticImports(src)) {
      const r = resolveSpec(f, spec);
      if (r) stack.push([r, f]);
    }
  }
  return { server, boundaries };
}

/** Everything the first load pulls in: the boundaries and what they import statically, transitively. */
function firstLoadClosure(boundaries: Iterable<string>) {
  const seen = new Set<string>();
  const heavy: string[] = [];
  const stack = [...boundaries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const spec of staticImports(read(f))) {
      if (HEAVY.test(spec)) heavy.push(`${rel(f)} imports '${spec}'`);
      const r = resolveSpec(f, spec);
      if (r) stack.push(r);
    }
  }
  return { seen, heavy };
}

const graph = serverGraph(PAGE);
const lazyPieces = new Map<string, string>(); // piece → its stand-in
for (const s of STAND_INS) {
  const abs = join(WEB, s);
  for (const spec of dynamicImports(read(abs))) {
    const r = resolveSpec(abs, spec);
    assert.ok(r, `${s}: import('${spec}') resolves to no file`);
    lazyPieces.set(r!, s);
  }
}

test('the detectors can fire — a static import, a type import, a dynamic import, a boundary', () => {
  assert.deepEqual(staticImports(`import { A } from './a';\nimport type { B } from './b';\nexport { C } from './c';\nexport type { D } from './d';\nimport './e';`), ['./a', './c', './e']);
  assert.deepEqual(staticImports(`/* import { X } from './x'; */\n// import { Y } from './y';\nconst Z = dynamic(() => import('./z'));`), []);
  assert.deepEqual(dynamicImports(`const Z = dynamic(() => import('./z').then((m) => m.Z));`), ['./z']);
  assert.equal(isClient(`/** doc */\n'use client';\nexport function A() {}`), true);
  assert.equal(isClient(`import 'server-only';\n'use client';`), false);
});

test('floors — the walk reaches Details, the Mood Board and the Schedule, and the stand-ins are its boundaries', () => {
  const server = [...graph.server].map(rel);
  for (const f of [
    'app/dashboard/[eventId]/launch/_components/maker-details.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-prints.tsx',
    'app/dashboard/[eventId]/launch/_components/details-your-event-parts.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx',
    'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx',
    'app/dashboard/[eventId]/schedule/page.tsx',
    'app/dashboard/[eventId]/seating/page.tsx',
  ]) {
    assert.ok(server.includes(f), `the Maker's server graph no longer reaches ${f} — the walk is not seeing Details`);
  }
  for (const s of STAND_INS) assert.ok(graph.boundaries.has(join(WEB, s)), `${s} is not reached by the Maker — a stand-in nobody imports holds nothing`);
  assert.ok(graph.boundaries.size >= 30, `only ${graph.boundaries.size} client boundaries — the resolver stopped resolving`);
  assert.ok(lazyPieces.size >= 25, `the stand-ins load only ${lazyPieces.size} pieces — they no longer carry Details`);
});

test('1 · no piece a stand-in loads is a first-load boundary of the Maker', () => {
  const leaks = [...lazyPieces]
    .filter(([piece]) => graph.boundaries.has(piece))
    .map(([piece, standIn]) => `${rel(piece)} — imported statically by ${rel(graph.boundaries.get(piece)!)}; import it from ${standIn}`);
  assert.deepEqual(leaks, [], `A Details piece is back in the Maker's first load:\n  ${leaks.join('\n  ')}`);
});

test('1b · no client module the first load reaches imports a lazy piece statically either', () => {
  // Test 1 walks only the server files. A `'use client'` module in the first
  // load (the stage editor, the Maker shell) that imports a piece directly
  // pulls it back just the same — the Photo moments editor left that way
  // (rd/maker-diet) and must not come back.
  const { seen } = firstLoadClosure(graph.boundaries.keys());
  const leaks: string[] = [];
  for (const f of seen) {
    for (const spec of staticImports(read(f))) {
      const r = resolveSpec(f, spec);
      if (r && lazyPieces.has(r)) leaks.push(`${rel(f)} imports ${rel(r)} statically; import it from ${lazyPieces.get(r)}`);
    }
  }
  assert.deepEqual(leaks, [], `A lazy piece is back in the Maker's first load:\n  ${leaks.join('\n  ')}`);
});

test('2 · every stand-in export is a dynamic() of its piece, and no stand-in imports a piece statically', () => {
  for (const s of STAND_INS) {
    const src = stripComments(read(join(WEB, s)));
    assert.ok(isClient(read(join(WEB, s))), `${s} is not 'use client' — a server file would import its pieces' code`);
    for (const m of src.matchAll(/export\s+const\s+(\w+)\s*=\s*([\s\S]{0,40})/g)) {
      assert.match(m[2]!, /^dynamic\(\s*\(\)\s*=>\s*import\(/, `${s}: ${m[1]} is not a dynamic(() => import(…)) stand-in`);
    }
    const abs = join(WEB, s);
    const staticPieces = staticImports(read(abs))
      .map((spec) => resolveSpec(abs, spec))
      .filter((r): r is string => r !== null && lazyPieces.has(r));
    assert.deepEqual(staticPieces.map(rel), [], `${s} imports a piece it is meant to load later`);
  }
});

test('2b · every import() in a stand-in names its chunk group', () => {
  for (const s of STAND_INS) {
    const raw = read(join(WEB, s));
    const calls = [...stripComments(raw).matchAll(/\bimport\(/g)].length;
    const named = [...raw.matchAll(/\bimport\(\s*\/\*\s*webpackChunkName:\s*"maker-[a-z-]+"\s*\*\/\s*['"]/g)].length;
    assert.ok(calls > 0, `${s} loads nothing`);
    assert.equal(named, calls, `${s}: ${calls - named} import() without a webpackChunkName — each is one more chunk in the runtime every page loads`);
  }
});

test('3 · nothing in the Maker first load imports three.js, react-three, opentype.js or fabric', () => {
  const { seen, heavy } = firstLoadClosure(graph.boundaries.keys());
  assert.ok(seen.size >= graph.boundaries.size, 'the first-load closure is smaller than its own boundaries');
  assert.deepEqual(heavy, [], `A heavy library is in the Maker's first load:\n  ${heavy.join('\n  ')}`);
});
