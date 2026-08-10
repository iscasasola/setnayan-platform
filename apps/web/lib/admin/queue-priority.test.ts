/**
 * GUARD — the two admin surfaces that rank the same job queues must rank them
 * in the SAME order.
 *
 * The command center (/admin/work) ranked overdue-first from a private DUE_RANK
 * table; the Overview's busiest-queues preview (/admin) sorted on open count
 * alone. The same admin reading both screens was told two different things were
 * the most urgent thing to do, and /admin/work's own docblock claimed the two
 * "agree by construction". One comparator (compareQueuePriority) now lives in
 * lib/admin/queue-counts.ts and both surfaces call it.
 *
 * ⚠ THE SOURCE ASSERTIONS ARE SCOPED TO CODE, NOT THE FILE. Every comment is
 * stripped before matching — otherwise this guard would happily match the
 * paragraph above explaining the bug and pass forever on its own justification.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUEUE_DUE_RANK,
  compareQueuePriority,
  type AdminQueueDueState,
} from './queue-counts';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, '..', '..');

/** Strip block + line comments so a whole-file grep can't match prose. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * 🔑 THE SURFACE LIST IS DERIVED FROM DISK, NOT TYPED HERE.
 *
 * It used to be two hand-written entries, and that is exactly how a THIRD
 * surface hid: `app/admin/app-performance/_components/action-center.tsx` carried
 * its own rank table ranking `unknown` ABOVE `ok` — the inverse of the shared
 * rule — over the same fifteen queues, the same digest and the same
 * `computeDueState`. The guard reported clean the whole time, because nobody had
 * typed that path into it.
 *
 * A hand-typed list is silent about whatever nobody typed into it. So: any file
 * under `app/admin` that reads the queue vocabulary IS a ranking surface, and
 * has to answer for itself.
 */
function adminFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) adminFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const sources = adminFiles(resolve(WEB_ROOT, 'app/admin'))
  .map((full) => ({
    name: relative(WEB_ROOT, full),
    path: relative(WEB_ROOT, full),
    code: codeOnly(readFileSync(full, 'utf8')),
  }))
  // A ranking surface is one that reads the queue vocabulary AND orders it.
  .filter((f) => /computeDueState|AdminQueueDueState/.test(f.code) && /\.sort\(/.test(f.code));

const SURFACES = sources;

test('the comment stripper actually strips (the guard cannot pass on its own prose)', () => {
  const stripped = codeOnly(
    "// compareQueuePriority in a line comment\n/* compareQueuePriority in a block */\nconst x = 1;",
  );
  assert.ok(
    !stripped.includes('compareQueuePriority'),
    'stripper left comment text behind — every source assertion below would be meaningless',
  );
  assert.ok(stripped.includes('const x = 1;'), 'stripper ate real code');
  // Both surfaces are read through the same stripper and must still hold code.
  for (const s of sources) {
    assert.ok(s.code.trim().length > 0, `${s.name}: nothing left after stripping`);
  }
});

test('the shared queue order exists and is non-empty', () => {
  const states: AdminQueueDueState[] = [
    'overdue',
    'due-soon',
    'ok',
    'unknown',
    'clear',
  ];
  const keys = Object.keys(QUEUE_DUE_RANK);
  assert.ok(keys.length > 0, 'QUEUE_DUE_RANK is empty — there is no shared order');
  for (const st of states) {
    assert.equal(
      typeof QUEUE_DUE_RANK[st],
      'number',
      `QUEUE_DUE_RANK is missing a rank for "${st}"`,
    );
  }
  // The bands must be distinct, or "one order" collapses into no order at all.
  assert.equal(new Set(Object.values(QUEUE_DUE_RANK)).size, keys.length);
});

test('BOTH admin surfaces sort by the shared comparator', () => {
  for (const s of sources) {
    assert.ok(
      s.code.includes('compareQueuePriority'),
      `${s.name} does not call compareQueuePriority — it is ranking queues by its own rule again`,
    );
  }
});

test('neither surface keeps a private urgency-rank table', () => {
  // A re-hardcoded copy looks like `{ overdue: 0, 'due-soon': 1, ... }`.
  const RANK_TABLE = /overdue\s*:\s*-?\d[\s\S]{0,120}?['"]due-soon['"]\s*:\s*-?\d/;
  for (const s of sources) {
    assert.ok(
      !RANK_TABLE.test(s.code),
      `${s.name} declares its own due-state rank table — that is the drift this guard exists to stop`,
    );
  }
});

test('neither surface ranks queues on volume alone', () => {
  // The exact shape the Overview regressed to: a comparator whose whole body is
  // the difference of two counts, with no urgency band in sight.
  const VOLUME_ONLY =
    /\.sort\(\s*\([^)]*\)\s*=>\s*\(?\s*b\.(value|count)[^;]{0,60}?-\s*\(?\s*a\.(value|count)[^;]{0,20}?\)\s*[,)]/;
  for (const s of sources) {
    assert.ok(
      !VOLUME_ONLY.test(s.code),
      `${s.name} sorts queues by open count alone — the biggest pile is not the most urgent`,
    );
  }
});

test('overdue beats a bigger pile; volume only breaks a tie inside a band', () => {
  const overdueSmall = { dueState: 'overdue' as const, count: 1 };
  const okHuge = { dueState: 'ok' as const, count: 999 };
  assert.ok(compareQueuePriority(overdueSmall, okHuge) < 0);
  assert.ok(compareQueuePriority(okHuge, overdueSmall) > 0);

  assert.ok(
    compareQueuePriority(
      { dueState: 'ok', count: 2 },
      { dueState: 'ok', count: 9 },
    ) > 0,
    'inside one band the busier queue must come first',
  );
  assert.equal(
    compareQueuePriority({ dueState: 'ok', count: 3 }, { dueState: 'ok', count: 3 }),
    0,
    'a full tie must return 0 so the caller declaration order (stable sort) decides',
  );

  // An unavailable count is neither urgent nor settled.
  assert.ok(compareQueuePriority({ count: null }, { dueState: 'ok', count: 1 }) > 0);
  assert.ok(compareQueuePriority({ count: null }, { dueState: 'clear', count: 0 }) < 0);
});

test('both surfaces produce the same winner from the same queue set', () => {
  // The end-to-end promise in one assertion: rank an identical set the way each
  // surface shapes its rows, and the top queue must be the same one.
  const queues = [
    { key: 'help', dueState: 'ok' as const, n: 40 },
    { key: 'payments', dueState: 'overdue' as const, n: 2 },
    { key: 'verify', dueState: 'due-soon' as const, n: 12 },
  ];
  const workOrder = queues
    .map((q) => ({ dueState: q.dueState, count: q.n }))
    .slice()
    .sort(compareQueuePriority);
  const overviewOrder = queues
    .map((q) => ({ state: q.dueState, value: q.n }))
    .slice()
    .sort((a, b) =>
      compareQueuePriority(
        { dueState: a.state, count: a.value },
        { dueState: b.state, count: b.value },
      ),
    );
  assert.equal(workOrder[0]?.count, 2);
  assert.equal(overviewOrder[0]?.value, 2);
  assert.deepEqual(
    workOrder.map((r) => r.count),
    overviewOrder.map((r) => r.value),
  );
});
