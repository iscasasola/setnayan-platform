/**
 * GUARD — every admin surface that ranks the same job queues must rank them in
 * the SAME order.
 *
 * The command center (/admin/work) ranked overdue-first from a private DUE_RANK
 * table; the Overview's busiest-queues preview (/admin) sorted on open count
 * alone. The same admin reading both screens was told two different things were
 * the most urgent thing to do, and /admin/work's own docblock claimed the two
 * "agree by construction". One comparator (compareQueuePriority) now lives in
 * lib/admin/queue-counts.ts and every surface calls it.
 *
 * 🚨 THE FIRST VERSION OF THIS GUARD LISTED ITS SURFACES BY HAND AND MISSED
 * ONE. The App Performance cockpit's Action Center ranked the SAME fifteen
 * queues from its own STATE_RANK that put `unknown` ABOVE `ok` — the exact
 * inverse of the shared rule — and the fix that unified the other two reported
 * "no third offender". The list is now DERIVED FROM DISK: any file under app/
 * that both computes a due state and sorts must appear in SURFACES, or this
 * file goes red naming it.
 *
 * ⚠ THE SOURCE ASSERTIONS ARE SCOPED TO CODE, NOT THE FILE. Every comment is
 * stripped before matching — otherwise this guard would happily match the
 * paragraph above explaining the bug and pass forever on its own justification.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
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
 * Hand-maintained roster of the surfaces that rank the queue set. It is NOT the
 * coverage mechanism — `discoverRankingSurfaces()` below is, and the two must
 * agree exactly. This list only carries the human-readable names.
 */
const SURFACES = [
  { name: '/admin/work (command center)', path: 'app/admin/work/page.tsx' },
  { name: '/admin (overview)', path: 'app/admin/page.tsx' },
  {
    name: '/admin/app-performance (Action Center)',
    path: 'app/admin/app-performance/_components/action-center.tsx',
  },
] as const;

/** Every .ts/.tsx under app/, tests excluded. */
function walkApp(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walkApp(full, out);
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.')
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * A "ranking surface" = a file that reads the shared queue module, turns rows
 * into a due state (or already ranks with the shared comparator), AND sorts.
 * Deliberately narrow: /admin/layout.tsx and the launcher both read the digest
 * but never rank queues, and neither is picked up.
 */
function discoverRankingSurfaces(): string[] {
  return walkApp(resolve(WEB_ROOT, 'app'))
    .filter((file) => {
      const code = codeOnly(readFileSync(file, 'utf8'));
      if (!/from\s+['"]@\/lib\/admin\/queue-counts['"]/.test(code)) return false;
      if (!/\b(computeDueState|compareQueuePriority)\s*\(/.test(code)) return false;
      return /\.sort\s*\(/.test(code);
    })
    .map((file) => relative(WEB_ROOT, file).split(sep).join('/'))
    .sort();
}

const sources = SURFACES.map((s) => ({
  ...s,
  code: codeOnly(readFileSync(resolve(WEB_ROOT, s.path), 'utf8')),
}));

test('the comment stripper actually strips (the guard cannot pass on its own prose)', () => {
  const stripped = codeOnly(
    "// compareQueuePriority in a line comment\n/* compareQueuePriority in a block */\nconst x = 1;",
  );
  assert.ok(
    !stripped.includes('compareQueuePriority'),
    'stripper left comment text behind — every source assertion below would be meaningless',
  );
  assert.ok(stripped.includes('const x = 1;'), 'stripper ate real code');
  // Every surface is read through the same stripper and must still hold code.
  for (const s of sources) {
    assert.ok(s.code.trim().length > 0, `${s.name}: nothing left after stripping`);
  }
});

test('SURFACES covers every ranking surface on disk (the list is not hand-typed)', () => {
  const found = discoverRankingSurfaces();
  const listed: string[] = SURFACES.map((s) => s.path as string)
    .slice()
    .sort();
  const missing = found.filter((p) => !listed.includes(p));
  const stale = listed.filter((p) => !found.includes(p));
  assert.deepEqual(
    missing,
    [],
    `these files rank admin queues but are NOT in SURFACES, so nothing checks their order: ${missing.join(', ')}. Add them (and point them at compareQueuePriority).`,
  );
  assert.deepEqual(
    stale,
    [],
    `SURFACES names files that no longer rank queues: ${stale.join(', ')}. Remove them, or the guard is checking nothing.`,
  );
  // A discovery that finds nothing would make every check below vacuous.
  assert.ok(found.length >= 3, `discovery found only ${found.length} surfaces`);
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

test('EVERY admin surface sorts by the shared comparator', () => {
  // 🪤 `includes('compareQueuePriority')` is NOT enough: the import line alone
  // satisfies it, so a surface can re-hardcode its own table, keep the now-dead
  // import, and stay green. Require a CALL — an import has no open paren.
  for (const s of sources) {
    assert.match(
      s.code,
      /compareQueuePriority\s*\(/,
      `${s.name} does not CALL compareQueuePriority — it is ranking queues by its own rule again`,
    );
  }
});

test('no surface keeps a private urgency-rank table', () => {
  // A re-hardcoded copy looks like `{ overdue: 0, 'due-soon': 1, ... }`. The
  // `overdue` key may or may not be quoted; `due-soon` must be, it has a hyphen.
  const RANK_TABLE =
    /['"]?overdue['"]?\s*:\s*-?\d[\s\S]{0,120}?['"]due-soon['"]\s*:\s*-?\d/;
  for (const s of sources) {
    assert.ok(
      !RANK_TABLE.test(s.code),
      `${s.name} declares its own due-state rank table — that is the drift this guard exists to stop`,
    );
  }
});

test('no surface ranks queues on volume alone', () => {
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

test('a degraded read never outranks real open work on ANY surface', () => {
  // The cockpit's private table put `unknown` above `ok`, so a queue whose
  // count merely failed to read was painted as more urgent than a queue with
  // actual open items inside its SLA. One rule now, in one direction.
  assert.ok(
    QUEUE_DUE_RANK.unknown > QUEUE_DUE_RANK.ok,
    'unknown must rank BELOW ok — a degraded read is not urgent',
  );
  assert.ok(
    QUEUE_DUE_RANK.unknown < QUEUE_DUE_RANK.clear,
    'unknown must rank ABOVE clear — a degraded read is not settled either',
  );
});

test('all three surfaces produce the same winner from the same queue set', () => {
  // The end-to-end promise in one assertion: rank an identical set the way each
  // surface shapes its rows, and the whole order must agree. The cockpit row
  // shape is the one that used to disagree, so `unknown` is in the fixture.
  const queues = [
    { key: 'help', dueState: 'ok' as const, n: 40 },
    { key: 'payments', dueState: 'overdue' as const, n: 2 },
    { key: 'verify', dueState: 'due-soon' as const, n: 12 },
    { key: 'payouts', dueState: 'unknown' as const, n: 0 },
  ];
  const workOrder = queues
    .map((q) => ({ key: q.key, dueState: q.dueState, count: q.n }))
    .slice()
    .sort(compareQueuePriority);
  const overviewOrder = queues
    .map((q) => ({ key: q.key, state: q.dueState, value: q.n }))
    .slice()
    .sort((a, b) =>
      compareQueuePriority(
        { dueState: a.state, count: a.value },
        { dueState: b.state, count: b.value },
      ),
    );
  // Action Center row shape: { state, row: { count } }.
  const cockpitOrder = queues
    .map((q) => ({ key: q.key, state: q.dueState, row: { count: q.n } }))
    .slice()
    .sort((a, b) =>
      compareQueuePriority(
        { dueState: a.state, count: a.row.count },
        { dueState: b.state, count: b.row.count },
      ),
    );

  const expected = ['payments', 'verify', 'help', 'payouts'];
  assert.deepEqual(workOrder.map((r) => r.key), expected);
  assert.deepEqual(overviewOrder.map((r) => r.key), expected);
  assert.deepEqual(cockpitOrder.map((r) => r.key), expected);
});
