/**
 * THE INLINED SELECT AND THE CONSTANT CANNOT DIVERGE.
 *
 * `readPoolSizing` selects its columns as a LITERAL rather than as
 * `POOL_CONFIG_SIZING_COLUMNS.join(', ')`, because
 * `lib/security/select-column-scan.ts` — GUARD 2 of `pnpm lint:dup-rule` —
 * resolves a select's column list statically, and a constant-built string is
 * invisible to it. The alternative was to teach that scanner an exception for
 * this one call, and a ratchet that admits your own exception has stopped
 * measuring anything.
 *
 * 🔑 INLINING BUYS VISIBILITY AND COSTS A SECOND SOURCE OF TRUTH. This file is
 * the price. `POOL_CONFIG_SIZING_COLUMNS` stays the thing every reader reasons
 * about; if somebody adds a fourth sizing column there and the query keeps
 * asking for three, the read silently returns a row with a missing field and
 * the recommendation quotes a number built from `undefined`. That is the same
 * shape as a refused read rendering as zero.
 *
 * Run from apps/web:  npx tsx --test lib/papic-pool-sizing-columns-match.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { POOL_CONFIG_SIZING_COLUMNS } from './papic-pool-sizing';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'papic-pool-sizing.ts'),
  'utf8',
);

/** The one `.select('…')` literal in this module, as written. */
function selectedColumns(): string[] {
  const m = SRC.match(/\.select\('([^']+)'\)/);
  assert.ok(m, 'no literal .select() found — if it went back to a constant, the column scanner is blind again');
  return m[1]!.split(',').map((c) => c.trim());
}

test('the literal select asks for every sizing column the constant declares', () => {
  const asked = selectedColumns();
  for (const col of POOL_CONFIG_SIZING_COLUMNS) {
    assert.ok(
      asked.includes(col),
      `POOL_CONFIG_SIZING_COLUMNS declares "${col}" and the query does not ask for it — ` +
        `the read returns a row with that field undefined, and the recommendation is built from it. ` +
        `Query asks: ${asked.join(', ')}`,
    );
  }
});

test('the literal select asks for nothing beyond the sizing columns and the key', () => {
  // ⚠ The point of the constant is that ONLY these columns may be read off a
  // per-type sizing row — `soft_stop_pct`, `free_grant_points` and the rest live
  // on `config_key = 'default'` and are inert seeded copies elsewhere. A widened
  // select is how one of those gets read off the wrong row with a plausible value.
  const allowed = new Set<string>([...POOL_CONFIG_SIZING_COLUMNS, 'config_key']);
  for (const col of selectedColumns()) {
    assert.ok(
      allowed.has(col),
      `the query asks for "${col}", which is not a sizing column. Only ` +
        `${[...allowed].join(', ')} may be read off a per-event-type row.`,
    );
  }
});

test('the guard can actually fail', () => {
  // A regex that stopped matching would make both tests above vacuous.
  assert.ok(selectedColumns().length >= 2, 'the select parsed to fewer columns than it has');
  assert.ok(POOL_CONFIG_SIZING_COLUMNS.length > 0, 'the constant is empty; there is nothing to compare');
});
