/**
 * Completeness tripwire for the /admin/work command center's worklist. The
 * BASE_ROWS presentation list and ADMIN_QUEUE_META (the badge/urgency source of
 * truth) are two lists that MUST stay in lock-step: every queue that carries a
 * count has to have a worklist row, or the command center silently undercounts
 * totalOpen and drops a queue an admin needs to clear. This is exactly the
 * integrity-watch regression that motivated the test — it was in ADMIN_QUEUE_META
 * but missing from BASE_ROWS. Run: pnpm test:unit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_ROWS, WORKLIST_EXCLUDED_KEYS } from './work-rows';
import { ADMIN_QUEUE_META } from './queue-counts';

test('BASE_ROWS covers every ADMIN_QUEUE_META queue (minus explicit exclusions)', () => {
  const rowKeys = new Set(BASE_ROWS.map((r) => r.key));
  const excluded = new Set(WORKLIST_EXCLUDED_KEYS);
  const missing = Object.keys(ADMIN_QUEUE_META).filter(
    (k) => !rowKeys.has(k) && !excluded.has(k),
  );
  assert.deepEqual(
    missing,
    [],
    `these badge/urgency queues have no /admin/work row: ${missing.join(', ')}`,
  );
});

test('BASE_ROWS has no row for a queue that is not in ADMIN_QUEUE_META', () => {
  const metaKeys = new Set(Object.keys(ADMIN_QUEUE_META));
  const orphans = BASE_ROWS.map((r) => r.key).filter((k) => !metaKeys.has(k));
  assert.deepEqual(
    orphans,
    [],
    `these worklist rows have no metadata (no count/urgency will ever load): ${orphans.join(', ')}`,
  );
});

test('every explicit exclusion is a real ADMIN_QUEUE_META queue', () => {
  const metaKeys = new Set(Object.keys(ADMIN_QUEUE_META));
  const stale = WORKLIST_EXCLUDED_KEYS.filter((k) => !metaKeys.has(k));
  assert.deepEqual(stale, [], `stale exclusion keys: ${stale.join(', ')}`);
});

test('BASE_ROWS keys are unique', () => {
  const keys = BASE_ROWS.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate key in BASE_ROWS');
});
