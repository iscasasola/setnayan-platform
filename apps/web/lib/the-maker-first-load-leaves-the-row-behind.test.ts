/**
 * the-maker-first-load-leaves-the-row-behind.test.ts — THE MAKER'S FIRST LOAD DOES NOT CARRY THE TIMELINE ROW.
 *
 * Measured 2026-10-08 (builder T2; the Maker's first-load budget was about 0.4 KB over on paper that night):
 * `app/_components/timeline-row.tsx` — the row, its name field, the empty state, their handlers, 1.7 KB gzipped —
 * rode the Maker's first load only because the Maker's page imported its loading shimmer and
 * `timeline-read-problem.tsx` imported its problem state. Those two small pieces (and the two class constants) now
 * live in `timeline-states.tsx`; the row itself is reached only through the chunks loaded later on purpose
 * (`next/dynamic` — the Schedule's day, the Love Story's rows).
 *
 * There is no build in this runner, so the first load is asked the only way it can be here: by WALKING THE IMPORTS
 * from the Maker's page — every static `import`/`export … from` (a type-only one is erased and does not count; an
 * `import()` is a later load and is not followed) — and seeing what is reached.
 *
 *   (1) the walk reaches the small states file, and NEVER `timeline-row.tsx`;
 *   (2) the states file is the light one: no hooks, no "use client", and it imports nothing of the app's;
 *   (3) nothing was lost: `timeline-row.tsx` re-exports all four names, and they are the SAME objects;
 *   (4) the row's wearers still reach it — through a later load.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const MAKER = 'app/dashboard/[eventId]/launch/page.tsx';
const ROW = 'app/_components/timeline-row.tsx';
const STATES = 'app/_components/timeline-states.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The app's own files a source file imports STATICALLY (type-only erased, `import()` not followed). */
function staticImports(rel: string): string[] {
  const src = read(rel);
  const out: string[] = [];
  const re = /(?:^|[\n;])\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    if (m[2]) continue; // `import type … from` / `export type … from` — erased
    const spec = m[3]!;
    const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(join(WEB, dirname(rel)), spec) : null;
    if (!base) continue; // a package
    const hit = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find((p) => existsSync(p) && statSync(p).isFile());
    if (hit && /\.tsx?$/.test(hit)) out.push(relative(WEB, hit));
  }
  return out;
}

/** Everything reached from `from` by static imports, with one path to each (for the message). */
function reached(from: string): Map<string, string> {
  const via = new Map<string, string>([[from, '']]);
  const queue = [from];
  while (queue.length) {
    const f = queue.shift()!;
    for (const next of staticImports(f)) {
      if (via.has(next)) continue;
      via.set(next, f);
      queue.push(next);
    }
  }
  return via;
}
function pathTo(via: Map<string, string>, file: string): string {
  const chain = [file];
  while (via.get(chain[0]!)) chain.unshift(via.get(chain[0]!)!);
  return chain.join(' → ');
}

test('(1) walking the Maker page’s imports reaches the small states file — and never timeline-row.tsx', () => {
  const via = reached(MAKER);
  assert.ok(via.size > 400, `anti-vacuity: the walk reached only ${via.size} files — it is not following the app’s imports`);
  // The walk really follows what the Maker draws first: the Love Story page, and the uploader that page's sheet holds.
  for (const known of ['app/dashboard/[eventId]/website/our-story/page.tsx', 'app/_components/file-upload.tsx', 'app/_components/timeline-read-problem.tsx']) {
    assert.ok(via.has(known), `anti-vacuity: the walk does not reach ${known}`);
  }
  assert.ok(via.has(STATES), 'the Maker no longer shows the loading shimmer from the states file');
  assert.ok(!via.has(ROW), `the Maker’s first load carries the whole Timeline row again: ${via.has(ROW) ? pathTo(via, ROW) : ''}`);
  // …and it does not follow a later load: the rows themselves are behind `next/dynamic`.
  assert.ok(!via.has('app/dashboard/[eventId]/website/our-story/_components/moment-order-cards.tsx'), 'the walk followed an import() — it is not measuring the first load');
  // The two first-load files that used to pull the row in name the states file.
  assert.match(read(MAKER), /import \{ TimelineRowsLoading \} from '@\/app\/_components\/timeline-states';/);
  assert.match(read('app/_components/timeline-read-problem.tsx'), /import \{ TimelineProblem \} from '\.\/timeline-states';/);
});

test('(2) the states file is the light one: no hooks, no "use client", nothing of the app’s imported', () => {
  const raw = readFileSync(join(WEB, STATES), 'utf8');
  const src = read(STATES);
  assert.doesNotMatch(raw, /^\s*['"]use client['"]/m, 'the shimmer is a client component again — it costs JavaScript to show grey shapes');
  assert.doesNotMatch(src, /\buse(?:State|Effect|Ref|Context|Memo|Callback|Transition|LayoutEffect|Id)\b/, 'a hook moved into the states file');
  assert.deepEqual(staticImports(STATES), [], 'the states file imports something of the app’s — and carries it into the first load');
  assert.deepEqual([...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]), ['react'], 'the states file imports a package beyond react’s types');
  assert.match(src, /^import type \{ ReactNode \} from 'react';/m);
  // It holds exactly the four pieces, and only the problem state has a control.
  assert.deepEqual([...src.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]), ['TIMELINE_BAND_CLASS', 'TIMELINE_ROW_CLASS', 'TimelineRowsLoading', 'TimelineProblem']);
});

test('(3) nothing was lost: timeline-row.tsx re-exports all four, and they are the same objects — painted the same', async () => {
  const row = await import('../app/_components/timeline-row');
  const states = await import('../app/_components/timeline-states');
  for (const name of ['TIMELINE_BAND_CLASS', 'TIMELINE_ROW_CLASS', 'TimelineRowsLoading', 'TimelineProblem'] as const) {
    assert.ok(states[name], `${name} is gone from the states file`);
    assert.equal(row[name], states[name], `${name} from timeline-row.tsx is not the states file’s own`);
  }
  assert.equal(states.TIMELINE_BAND_CLASS, 'border-t border-ink/10 bg-cream first:border-t-0');
  assert.equal(states.TIMELINE_ROW_CLASS, 'flex min-h-[58px] items-center gap-1 py-1.5 pl-3 pr-1');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const loading = renderToStaticMarkup(React.createElement(states.TimelineRowsLoading, { label: 'Loading your Love Story', rows: 3 }));
  assert.match(loading, /^<div role="status" aria-busy="true" aria-label="Loading your Love Story" data-timeline-loading=""/);
  assert.equal((loading.match(/h-10 w-\[72px\] shrink-0 rounded-full bg-ink\/10/g) ?? []).length, 3);
  const problem = renderToStaticMarkup(React.createElement(states.TimelineProblem as React.ComponentType<Record<string, unknown>>, { title: 'We could not load your Love Story', onRetry: () => {} }, 'Your moments are safe.'));
  assert.match(problem, /^<div role="alert" data-timeline-problem-state=""/);
  assert.match(problem, /<button type="button" data-timeline-retry=""[^>]*>Try again<\/button>/);
  // The row still sits on the same band and line as the shimmer — one arrangement.
  const src = read(ROW);
  assert.match(src, /import \{ TIMELINE_BAND_CLASS, TIMELINE_ROW_CLASS \} from '\.\/timeline-states';/);
  assert.match(src, /export \{ TIMELINE_BAND_CLASS, TIMELINE_ROW_CLASS, TimelineProblem, TimelineRowsLoading \} from '\.\/timeline-states';/);
  assert.doesNotMatch(src, /export (?:const|function) (?:TIMELINE_BAND_CLASS|TIMELINE_ROW_CLASS|TimelineRowsLoading|TimelineProblem)\b/, 'a second copy of a state lives in timeline-row.tsx');
});

test('(4) the row’s wearers still reach it — through a later load', () => {
  // The Schedule's day and the Love Story's rows wear the row…
  assert.ok(staticImports('app/dashboard/[eventId]/schedule/_components/studio-day.tsx').includes(ROW));
  assert.ok(staticImports('app/dashboard/[eventId]/website/our-story/_components/moment-order-cards.tsx').includes(ROW));
  // …and each is behind an import() the Maker's page does not follow at first load.
  assert.match(read('app/dashboard/[eventId]/website/our-story/_components/moment-order-cards-lazy.tsx'), /dynamic\(\s*\(\) => import\([^)]*'\.\/moment-order-cards'\)/);
  const via = reached(MAKER);
  assert.ok(!via.has('app/dashboard/[eventId]/schedule/_components/studio-day.tsx'), `the Schedule’s day is in the first load: ${pathTo(via, 'app/dashboard/[eventId]/schedule/_components/studio-day.tsx')}`);
});
