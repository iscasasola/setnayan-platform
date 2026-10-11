/**
 * the-draft-engine-stays-out-of-the-browser.test.ts — 📦 THE EVENT HUB DRAFT'S ENGINE IS SERVER CODE: NO FILE A
 * BROWSER CAN BE SENT IMPORTS IT.
 *
 * MEASURED 2026-10-11 (PR #6475, CI "bundle size check"): the Maker's first-load JavaScript went 501.7 KB → 519.4 KB
 * gzipped — 12.4 KB over its ceiling (`scripts/check-maker-js-budget.mjs`) — and under 1 KB of that was the Maker's.
 * The rest came from ONE import in a dev page: `app/dev/maker-lab/maker-lab-shell.tsx` (a `'use client'` file)
 * imported `./lab-draft`, which runs the real draft's reducers.
 *
 * 🔑 WHY ONE IMPORT IN A PAGE THAT 404s COST EVERY PHONE 17 KB. Webpack decides which exports of a module are "used"
 * ONCE, for the whole browser build — not per page, and not per chunk. Until that import, browser files used a field
 * name and two helpers of `lib/hub-draft.ts` (the module was 708 B in the shipped chunk); the reducers were the
 * server's. The moment ANY browser file — a lazy sheet, another route, a dev lab that production never draws —
 * imported `mergeHubDraft` / `sanitizeHubDraft` / `summarizeHubDraft`, the module became the whole engine with every
 * sanitiser it calls, in EVERY chunk that carries it. The Maker's first load carries it (`HUB_DRAFT_FIELD`).
 * So `next/dynamic` on the importer would NOT have helped: the weight lands where `hub-draft.ts` already is.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. Walk every file a browser can be sent: each `'use client'` file and everything it imports — statically or by
 *      `import()` — transitively; a server module (`'use server'`, `*.server.ts`) is a reference, not code, and ends
 *      the walk; an `import()` in a branch a production build removes (`process.env.NODE_ENV === 'production' ? … :
 *      import(…)`) is not followed. From `lib/hub-draft.ts` those files import EXACTLY the names in `WIRE` below.
 *   2. None of the engine's own files is reached: the change lines, the Pro effects, the draft's store, the lab's draft.
 *   3. The lab reaches its engine by ONE import, in that dead-in-production shape — and nothing else imports it.
 *   4. The detector can fire: followed as a build WOULD follow a plain import, that one import reaches the engine and
 *      puts the reducers' names on the list (the very state that was measured at 519.4 KB).
 * Floors prove the walk is not vacuous.
 *
 * NOT CLAIMED (so a green is not over-read): this reads imports by FILE — it cannot see which exports webpack keeps,
 * and it knows nothing of other modules whose server-only exports a browser file might start using. The number is
 * CI's (`scripts/check-maker-js-budget.mjs`), on a real build. That the dead branch is removed is webpack's own
 * behaviour (DefinePlugin + ConstPlugin), relied on, not re-proved here.
 *
 * WHEN IT FAILS: a browser file wants something of the draft's. If it is a constant or a pure helper as small as the
 * ones in `WIRE`, add its name there with a word on why. If it is a reducer, a sanitiser or a summary, the browser
 * must not run it: ask the server (`website/hub-draft-actions.ts` answers with the draft's bar), or — for a dev lab —
 * reach it as `maker-lab-shell.tsx` does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const HUB_DRAFT = 'lib/hub-draft.ts';
const LAB_SHELL = 'app/dev/maker-lab/maker-lab-shell.tsx';
const LAB_ENGINE = 'app/dev/maker-lab/lab-draft.ts';

/**
 * What a browser file may take from `lib/hub-draft.ts` — each small, and none a reducer:
 *   HUB_DRAFT_FIELD · HUB_RESET_NEVER_TOUCHES  constants (a form field's name; the reset sheet's words)
 *   hubDraftOutcome · hubDraftAnswer          read an answer the server already gave (a few lines each)
 *   isHubDraftIntent                          one membership test
 */
const WIRE = ['HUB_DRAFT_FIELD', 'HUB_RESET_NEVER_TOUCHES', 'hubDraftAnswer', 'hubDraftOutcome', 'isHubDraftIntent'];
/** The engine's own files: its reducers' callers and its readers. */
const ENGINE_FILES = ['lib/hub-draft-change-lines.ts', 'lib/hub-pro-effects.ts', 'lib/hub-draft-store.ts', LAB_ENGINE];

const sources = new Map<string, string>();
const read = (rel: string) => {
  let s = sources.get(rel);
  if (s === undefined) sources.set(rel, (s = stripComments(readFileSync(join(WEB, rel), 'utf8'))));
  return s;
};
const walkDir = (dir: string): string[] =>
  readdirSync(join(WEB, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(join(WEB, rel)).isDirectory() ? walkDir(rel) : /\.tsx?$/.test(name) && !/\.(test|spec)\.|\.d\.ts$/.test(name) ? [rel] : [];
  });
const isClient = (src: string) => /^\s*['"]use client['"]/.test(src);
const isServer = (rel: string, src: string) => /\.server\.tsx?$/.test(rel) || /^\s*['"]use server['"]/.test(src);

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(join(WEB, from)), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (/\.tsx?$/.test(c) && existsSync(c) && statSync(c).isFile()) return relative(WEB, c);
  }
  return null;
}

type Edge = { spec: string; names: string[]; dead: boolean };
/** A production build removes the `import()` on the far side of this test (`process.env.NODE_ENV` is a build-time constant). */
const DEAD_IN_PRODUCTION = /process\.env\.NODE_ENV === 'production' \? [^;:?]*? : import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Every import of a file that brings CODE: `import type` and all-`type` name lists are erased by the compiler. */
function edgesOf(src: string): Edge[] {
  const out: Edge[] = [];
  const re = /(?:^|[;\n}])\s*(import|export)\s+(type\s+)?([^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[2]) continue;
    if (m[1] === 'export' && !m[3]) continue;
    const clause = m[3] ?? '';
    const braces = /\{([\s\S]*)\}/.exec(clause);
    const named = braces ? braces[1]!.split(',').map((n) => n.trim()).filter(Boolean) : [];
    const values = named.filter((n) => !n.startsWith('type ')).map((n) => n.split(/\s+as\s+/)[0]!.trim());
    const whole = clause.replace(/\{[\s\S]*\}/, '').replace(/\bfrom\b/, '').replace(/,/g, '').trim(); // a default or `* as ns`
    if (braces && values.length === 0 && !whole) continue;
    out.push({ spec: m[4]!, names: whole || !braces ? [...values, '*'] : values, dead: false });
  }
  const dead = new Set<number>();
  for (const d of src.matchAll(DEAD_IN_PRODUCTION)) dead.add(d.index! + d[0].lastIndexOf('import('));
  for (const d of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ spec: d[1]!, names: ['*'], dead: dead.has(d.index!) });
  return out;
}

const FILES = ['app', 'lib', 'components'].flatMap(walkDir);
const ROOTS = FILES.filter((f) => isClient(read(f)));

/** Everything a browser can be sent, and what those files take from `lib/hub-draft.ts` (name → the files that take it). */
function browserReach(followDead: boolean) {
  const seen = new Set<string>();
  const taken = new Map<string, string[]>();
  const stack = [...ROOTS];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = read(f);
    if (isServer(f, src) && !isClient(src)) continue;
    for (const e of edgesOf(src)) {
      if (e.dead && !followDead) continue;
      const to = resolveSpec(f, e.spec);
      if (!to) continue;
      if (to === HUB_DRAFT) for (const n of e.names) taken.set(n, [...(taken.get(n) ?? []), f]);
      stack.push(to);
    }
  }
  return { seen, taken };
}

const reach = browserReach(false);

test('the walk is not vacuous, and it reads imports the way the compiler does', () => {
  assert.ok(ROOTS.length >= 900, `only ${ROOTS.length} 'use client' files were found`);
  assert.ok(reach.seen.size >= 1800, `only ${reach.seen.size} files are reachable from them`);
  for (const f of [HUB_DRAFT, 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx', 'app/dashboard/[eventId]/launch/_components/guests-see-sheet.tsx']) {
    assert.ok(reach.seen.has(f), `${f} was not reached — the walk lost the Maker`);
  }
  assert.deepEqual(edgesOf(`import { a, type B, c as d } from './x';`), [{ spec: './x', names: ['a', 'c'], dead: false }]);
  assert.deepEqual(edgesOf(`import type { A } from './x';\nimport { type B } from './y';`), []);
  assert.deepEqual(edgesOf(`import D, { e } from './x';\nimport * as N from './y';`).map((e) => e.names), [['e', '*'], ['*']]);
  assert.deepEqual(edgesOf(`const p = process.env.NODE_ENV === 'production' ? Promise.reject(new Error('x')) : import('./e');\nconst q = import('./f');`), [
    { spec: './e', names: ['*'], dead: true },
    { spec: './f', names: ['*'], dead: false },
  ]);
  // A test that is not the build's constant does not make a branch dead.
  assert.equal(edgesOf(`const p = isLab ? null : import('./e');`)[0]!.dead, false);
});

test('1 · browser files take only the wire names from the draft — never a reducer, a sanitiser or a summary', () => {
  const taken = [...reach.taken.keys()].sort();
  const extra = taken.filter((n) => !WIRE.includes(n)).map((n) => `${n}  (imported by ${reach.taken.get(n)!.join(', ')})`);
  assert.deepEqual(
    extra,
    [],
    `A file the browser can load imports the draft's engine from ${HUB_DRAFT}. Webpack counts an export as used for the WHOLE browser build, ` +
      `so this puts the engine in every chunk that carries hub-draft.ts — the Maker's first load among them:\n  ${extra.join('\n  ')}\n` +
      `See this file's "WHEN IT FAILS".`,
  );
  assert.deepEqual(taken, [...WIRE].sort(), 'WIRE names something no browser file takes any more — delete it');
});

test('2 · none of the engine’s own files can be sent to a browser', () => {
  for (const f of ENGINE_FILES) {
    assert.ok(existsSync(join(WEB, f)), `${f} moved — point this check at it`);
    assert.ok(!reach.seen.has(f), `${f} is reachable from a 'use client' file — its imports of ${HUB_DRAFT} become the browser's`);
  }
});

test('3 · the lab reaches its engine by one import, in the shape a production build removes', () => {
  const shell = read(LAB_SHELL);
  assert.ok(isClient(shell));
  const edges = edgesOf(shell).filter((e) => resolveSpec(LAB_SHELL, e.spec) === LAB_ENGINE);
  assert.deepEqual(edges, [{ spec: './lab-draft', names: ['*'], dead: true }]);
  assert.match(shell, /process\.env\.NODE_ENV === 'production' \? Promise\.reject\(new Error\('The Maker lab is dev-only\.'\)\) : import\('\.\/lab-draft'\)/);
  // …and the lab's server-drawn pages are the only other importers (a server file's imports are not the browser's).
  const importers = FILES.filter((f) => f !== LAB_SHELL && edgesOf(read(f)).some((e) => resolveSpec(f, e.spec) === LAB_ENGINE)).sort();
  assert.deepEqual(importers, ['app/dev/maker-lab/guest/page.tsx', 'app/dev/maker-lab/page.tsx']);
  for (const f of importers) assert.ok(!isClient(read(f)) && !reach.seen.has(f), `${f} is a browser file`);
});

test('4 · the detector can fire: followed like a plain import, that one import hands the browser the engine', () => {
  const leaked = browserReach(true);
  assert.ok(leaked.seen.has(LAB_ENGINE));
  for (const f of ['lib/hub-draft-change-lines.ts', 'lib/hub-pro-effects.ts']) assert.ok(leaked.seen.has(f), `${f} was not reached through the lab’s engine`);
  for (const n of ['mergeHubDraft', 'sanitizeHubDraft', 'summarizeHubDraft', 'undoHubDraft', 'planHubDraftApply']) {
    assert.ok(leaked.taken.has(n), `${n} was not seen — the walk cannot tell a reducer from a constant`);
    assert.ok(!WIRE.includes(n));
  }
});
