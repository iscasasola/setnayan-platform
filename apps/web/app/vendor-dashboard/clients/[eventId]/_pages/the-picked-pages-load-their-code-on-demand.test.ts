/**
 * ⚡ THE PICKED CLIENT'S FIRST LOAD CARRIES DETAILS, NOT ALL NINE PAGES (release blocker, 8 Nov 2026).
 *
 * MEASURED (`next build`, dummy env): First Load JS of `/vendor-dashboard/clients/[eventId]` and its
 * `customers/@client/(..)clients/[eventId]` intercept went 312 → 510 kB once `pickedPageBodies` built all nine bodies:
 * every client component reachable from any body — the thread page's message stream and quote builder (Details'
 * Decisions renders that page too), the Forms maker, the Files finder, the Hub's panels — shipped in the first load.
 * The fix keeps the DATA in one go (every body drawn on the server, switch = `history.replaceState`) and moves the CODE
 * of those parts into chunks of their own (`_pages/lazy.tsx`, `messages/[threadId]/_components/on-demand.tsx`,
 * `on-the-day/_components/on-demand.tsx`).
 *
 * Held from the real import graph (the same walk webpack does for the route's client entry: server modules are
 * followed, a `'use client'` file is a boundary whose whole static graph ships; a dynamic `import()` does not):
 *   1 · the heavy parts are NOT in the route's eager client graph any more;
 *   2 · every client boundary a non-Details body reaches is on-demand, or ships anyway with Details/Schedule, or is one
 *       of the few named light parts below — so a new heavy import in a body fails HERE, not in a phone's first load;
 *   3 · Details stays eager (switch imports it directly; it imports nothing on-demand);
 *   4 · each on-demand module warms exactly the chunks it wraps, and the shell warms all three at idle.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): `import { ProposalMaker } from '@/app/_components/proposal-maker'`
 * put back in the thread page (red: 1 — Details reaches that page too, so 2 counts it as shipping anyway); forms.tsx importing `FormsPageBody` from its shipped file again (red: 1,
 * 2); a wrapper dropped from `warmThreadParts` (red: 4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(HERE, '..');
const WEB = join(CLIENT, '..', '..', '..', '..');
const raw = (p: string) => readFileSync(p, 'utf8');
const read = (p: string) => stripComments(raw(p));
const rel = (p: string) => relative(WEB, p);

const PAGE = join(CLIENT, 'page.tsx');
const BODIES = ['chat', 'quotation', 'forms', 'files', 'hub', 'payment', 'report'].map((b) => join(HERE, `${b}.tsx`));
const ON_DEMAND = [
  join(HERE, 'lazy.tsx'),
  join(WEB, 'app', 'vendor-dashboard', 'messages', '[threadId]', '_components', 'on-demand.tsx'),
  join(WEB, 'app', 'vendor-dashboard', 'on-the-day', '_components', 'on-demand.tsx'),
];
/** The parts the release check named, and the Hub's — each must leave the first load. */
const HEAVY = [
  'app/_components/proposal-maker.tsx',
  'app/_components/chat-message-stream.tsx',
  'app/_components/chat-send-form.tsx',
  'app/vendor-dashboard/forms/_components/forms-page-body.tsx',
  'app/vendor-dashboard/forms/_components/form-maker.tsx',
  'app/vendor-dashboard/clients/[eventId]/_pages/files-finder.tsx',
  'app/vendor-dashboard/clients/[eventId]/_pages/report-form.tsx',
  'app/vendor-dashboard/on-the-day/_components/crew-panel.tsx',
  'app/vendor-dashboard/on-the-day/_components/shot-list.tsx',
];
/**
 * Light client parts a body still reaches eagerly, each with its reason. Keep this short — a new heavy part goes
 * on-demand instead of on this list.
 */
const LIGHT = new Map<string, string>([
  ['app/_components/explain.tsx', 'the Hub screen’s ⓘ line (server-drawn Hub frame)'],
  ['app/_components/offline-ready/supplier-saved-strip.tsx', 'the Hub’s saved-for-no-signal strip, a few lines'],
  ['app/dashboard/[eventId]/guests/_components/undo-toast.tsx', 'the Hub’s undo toast host, a few lines'],
  ['app/vendor-dashboard/_components/supplier-columns.tsx', 'the Hub screen’s column frame'],
  ['app/vendor-dashboard/_components/supplier-thumb-row.tsx', 'ships with Schedule (`supplier-schedule.tsx`) anyway'],
]);

const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;
const isClient = (src: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src);

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext;
  return null;
}
function deps(file: string): string[] {
  const out: string[] = [];
  for (const m of raw(file).matchAll(IMPORT)) {
    const d = resolve(file, m[1]!);
    if (d) out.push(d);
  }
  return out;
}

/** The `'use client'` boundaries reached from `starts` through server modules (never entering `skip`). */
function boundaries(starts: string[], skip = new Set<string>()): Set<string> {
  const seen = new Set<string>();
  const found = new Set<string>();
  const stack = [...starts];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f) || skip.has(f)) continue;
    seen.add(f);
    if (!starts.includes(f) && isClient(raw(f))) {
      found.add(f);
      continue;
    }
    stack.push(...deps(f));
  }
  return found;
}
/** Everything that ships with those boundaries (their whole STATIC graph — a dynamic `import()` is a chunk of its own). */
function closure(bounds: Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const stack = [...bounds];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...deps(f));
  }
  return seen;
}

const eagerBounds = boundaries([PAGE]);
const eager = closure(eagerBounds);

test('1 · the heavy parts are out of the picked client’s first load', () => {
  assert.ok(eager.size > 200, `the walk reached only ${eager.size} files — it has gone blind`);
  for (const f of ON_DEMAND) assert.ok(eager.has(f), `${rel(f)} is not reached — re-anchor this guard`);
  const still = HEAVY.filter((h) => eager.has(join(WEB, h)));
  assert.deepEqual(still, [], `these ship in the picked client's FIRST load again — load them on demand:\n${still.join('\n')}`);
});

test('2 · every client part a non-Details body reaches is on-demand, ships anyway, or is a named light part', () => {
  const fromBodies = boundaries(BODIES);
  const anyway = boundaries([PAGE], new Set(BODIES));
  assert.ok(fromBodies.size >= 10, `the bodies reach only ${fromBodies.size} client parts — the walk has gone blind`);
  const stray = [...fromBodies]
    .filter((f) => !ON_DEMAND.includes(f) && !anyway.has(f) && !LIGHT.has(rel(f)))
    .map(rel);
  assert.deepEqual(stray, [], `a page body ships these in the first load — put them in an on-demand module:\n${stray.join('\n')}`);
  for (const l of LIGHT.keys()) assert.ok(existsSync(join(WEB, l)), `${l} is gone — drop it from LIGHT`);
});

test('3 · Details stays in the first load', () => {
  const sw = read(join(HERE, 'switch.tsx'));
  assert.match(sw, /import \{ DetailsPage \} from '\.\/details';/);
  const details = read(join(HERE, 'details.tsx'));
  assert.doesNotMatch(details, /from '\.\/lazy'|on-demand/, 'Details must not wait for a chunk');
});

test('4 · each on-demand module warms exactly what it wraps; the shell warms all three at idle', () => {
  for (const f of ON_DEMAND) {
    const src = read(f);
    assert.ok(isClient(raw(f)), `${rel(f)} is not a client module — its wrappers would not split`);
    const wrapped = [...src.matchAll(/export const \w+ = (?:dynamic|onDemand)\(\s*\(\) =>\s*import\('([^']+)'\)/g)].map((m) => m[1]!);
    assert.ok(wrapped.length >= 4, `${rel(f)}: found ${wrapped.length} wrappers — re-anchor`);
    const warmFn = src.slice(src.indexOf('export function warm'));
    const warmed = [...warmFn.matchAll(/\(\) => import\('([^']+)'\)/g)].map((m) => m[1]!);
    assert.deepEqual([...warmed].sort(), [...new Set(wrapped)].sort(), `${rel(f)}: the warm list is not the wrapped list`);
  }
  const shell = read(join(CLIENT, '_components', 'picked-client-shell.tsx'));
  for (const w of ['warmPickedPages', 'warmThreadParts', 'warmHubParts']) assert.match(shell, new RegExp(`\\b${w}\\(\\);`), `the shell never warms ${w}`);
  assert.match(shell, /requestIdleCallback/, 'the shell warms on the first paint’s critical path, not at idle');
});
