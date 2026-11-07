/**
 * 🎭 THE SAMPLE HUB REACHES NO TABLE — slice S2 (corpus
 * SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md item 8: "NO anon access to real
 * tables").
 *
 * S1's seal (`the-sample-is-sealed.test.ts` (b)) reads each /sample file's OWN
 * import lines. S2 mounts the SHIPPED Event Hub parts on /sample — and a shipped
 * part two hops down can open an admin client (`SiteBody` does, `GuestWelcome`
 * does, `eventWordsFor` does). So this walks the whole RUNTIME module graph of
 * every page and route under /sample — `import … from`, `export … from`,
 * `import()`, through `@/…` and relative paths, `import type` erased — and holds:
 *
 *   (a) no Supabase client module and no `@supabase/*` package is reachable,
 *       except past a listed STOP: the ONE sanctioned door,
 *       `lib/sample-event/switch.server.ts` (S1's switch read of
 *       `platform_settings` — the gate, never the content), and a shipped part
 *       the sample provably never MOUNTS (each listed with why);
 *   (b) no `'use server'` module is reachable at all, and the never-mounted
 *       part stays unmounted (the sample's `<ScheduleWidget>` passes no
 *       `nowTrigger`) — a new reach fails until someone looks;
 *   (c) the walker can SEE a reach: pointed at the real Hub's loaders it finds
 *       the admin client — so a pass above is a measurement, not a blind spot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const SAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const WEB = join(SAMPLE_DIR, '..', '..');
const rel = (p: string) => relative(WEB, p);

/**
 * Where the walk STOPS, each with why nothing past it runs for the sample:
 *   · the switch (S1) — the one module under /sample allowed to read a table, and it reads only the flag;
 *   · `RunOfShowHeader` — `ScheduleWidget`'s live strip (browser client + the advance action). It mounts only when
 *     `nowTrigger` is set AND the run of show has started; the sample passes no `nowTrigger` and is never on the day.
 */
const STOPS: Readonly<Record<string, string>> = {
  'lib/sample-event/switch.server.ts': 'the sample switch — the gate, never the content',
  'app/_components/run-of-show-header.tsx': 'mounts only with nowTrigger on a started run of show — never on the sample',
};

const SUPABASE_CLIENT = /^lib\/supabase\/(admin|server|client|cookies|middleware)\.ts$/;
const EXTS = ['.ts', '.tsx', '.js', '.mjs'];

function resolveFile(base: string): string | null {
  for (const t of [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => join(base, `index${e}`))]) {
    if (existsSync(t) && statSync(t).isFile()) return t;
  }
  return null;
}

/** The runtime specifiers one source file names — type-only imports and exports erased. */
function runtimeSpecifiers(src: string): string[] {
  const code = stripComments(src)
    .replace(/\bimport\s+type\s[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g, '')
    .replace(/\bexport\s+type\s+\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;?/g, '');
  const out = new Set<string>();
  for (const m of code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) out.add(m[1]!);
  for (const m of code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) out.add(m[1]!);
  for (const m of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.add(m[1]!);
  return [...out];
}

const isServerAction = (src: string) => /^\s*['"]use server['"]/.test(stripComments(src).trimStart());

type Graph = { files: Set<string>; packages: Set<string>; actions: Set<string> };

function walk(entries: readonly string[]): Graph {
  const g: Graph = { files: new Set(), packages: new Set(), actions: new Set() };
  const queue = entries.map((e) => resolve(e));
  while (queue.length) {
    const file = queue.pop()!;
    if (g.files.has(file)) continue;
    g.files.add(file);
    if (rel(file) in STOPS) continue;
    const src = readFileSync(file, 'utf8');
    if (isServerAction(src) && !entries.includes(file)) {
      g.actions.add(rel(file));
      continue;
    }
    for (const spec of runtimeSpecifiers(src)) {
      const target = spec.startsWith('@/') ? resolveFile(join(WEB, spec.slice(2))) : spec.startsWith('.') ? resolveFile(resolve(dirname(file), spec)) : null;
      if (!spec.startsWith('@/') && !spec.startsWith('.')) g.packages.add(spec);
      else if (target && !/\.(json|css)$/.test(target)) queue.push(target);
    }
  }
  return g;
}

function sampleEntries(dir = SAMPLE_DIR, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sampleEntries(p, out);
    else if (/^(page|route|layout)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('(a) no page or route under /sample can reach a Supabase client — the switch is the one door', () => {
  const entries = sampleEntries();
  assert.ok(entries.some((p) => /hub[/\\]\[guestKey\][/\\]page\.tsx$/.test(p)), 'the sample hub page moved — point this guard at it');
  assert.ok(entries.some((p) => /pass[/\\]\[guestKey\][/\\]route\.ts$/.test(p)), 'the sample pass route moved — point this guard at it');
  const g = walk(entries);
  const reached = [...g.files].map(rel).filter((p) => SUPABASE_CLIENT.test(p));
  assert.deepEqual(reached, [], 'a /sample page reaches a Supabase client — the sample must read fixtures only');
  assert.deepEqual([...g.packages].filter((p) => p.startsWith('@supabase/')), [], 'a /sample page reaches a Supabase package');
  assert.ok([...g.files].map(rel).includes('lib/sample-event/snapshot.ts'), 'the hub no longer reads the fixtures');
});

test('(b) no server action is reachable, and the never-mounted live strip stays unmounted', () => {
  const g = walk(sampleEntries());
  assert.deepEqual([...g.actions], [], 'a /sample page now reaches a server action — the sample posts nowhere');
  for (const stop of Object.keys(STOPS)) assert.ok(existsSync(join(WEB, stop)), `${stop} moved — point this guard at it`);
  for (const p of sampleEntries()) {
    const src = stripComments(readFileSync(p, 'utf8'));
    for (const m of src.matchAll(/<ScheduleWidget\b[^>]*>/g)) {
      assert.doesNotMatch(m[0], /\bnowTrigger\b/, `${rel(p)} mounts the live run-of-show strip (nowTrigger) — past a STOP`);
    }
  }
});

test('(c) the walker can see a reach: the real Hub’s loaders reach the admin client', () => {
  const g = walk([join(WEB, 'app', '[slug]', '_lib', 'loaders.ts')]);
  assert.ok([...g.files].map(rel).some((p) => SUPABASE_CLIENT.test(p)), 'the walker missed a reach it must see — its pass above means nothing');
});
