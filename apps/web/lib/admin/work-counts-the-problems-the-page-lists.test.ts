/**
 * RW-285e (live walk, 14 Nov 2026) — Work said 71 problems, Problems listed 67. Work counted raw open rows; the page
 * shows them after `mergeSameProblem`. Both now come from one rule: the Work count IS the page's merged row count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countOpenProblems, mergeSameProblem } from '../telemetry/problem-merge';
import { countQueue } from './queue-counts';

// Two rows a person cannot tell apart (same kind/action/label/named page, two event ids) + one distinct row.
const OPEN = [
  { id: 'a', kind: 'DEAD_TAP', action: '/dashboard/[id]/vendors · Reload', label: 'Reload', page: '/dashboard/[id]/vendors', hit_count: 3, day_count: 1, reopened_count: 0, first_seen: '2026-11-10T00:00:00Z', last_seen: '2026-11-13T00:00:00Z' },
  { id: 'b', kind: 'DEAD_TAP', action: '/dashboard/[id]/vendors · Reload', label: 'Reload', page: '/dashboard/[id]/vendors', hit_count: 3, day_count: 1, reopened_count: 0, first_seen: '2026-11-09T00:00:00Z', last_seen: '2026-11-14T00:00:00Z' },
  { id: 'c', kind: 'DB_ZERO_ROW', action: 'DELETE samahan_stories', label: null, page: null, hit_count: 3, day_count: 1, reopened_count: 0, first_seen: '2026-11-12T00:00:00Z', last_seen: '2026-11-14T00:00:00Z' },
];

function fakeAdmin(rows: unknown[] | null, error: unknown = null) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'gte', 'lte']) b[m] = () => b;
  b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error }).then(res);
  return { from: () => b } as never;
}

test('the Work count is the number of rows the Problems page lists', async () => {
  assert.equal(mergeSameProblem(OPEN).length, 2, 'the page lists two rows');
  const r = await countOpenProblems(fakeAdmin(OPEN));
  assert.equal(r.count, 2);
  assert.equal(r.oldestAt, '2026-11-09T00:00:00Z');
});

test('the Problems queue on Work is counted by that rule, not by a raw head-count', async () => {
  const r = await countQueue(fakeAdmin(OPEN), 'problems', Date.now());
  assert.equal(r?.count, 2);
});

test('a refused read is "not measured", never zero', async () => {
  const r = await countOpenProblems(fakeAdmin(null, { message: 'refused' }));
  assert.equal(r.count, null);
});

test('the Problems page lists through the same merge', () => {
  const page = readFileSync(join(__dirname, '..', 'telemetry', 'fault-issues.server.ts'), 'utf8');
  assert.match(page, /import \{ mergeSameProblem \} from '@\/lib\/telemetry\/problem-merge'/);
  assert.match(page, /open: mergeSameProblem\(/);
});
