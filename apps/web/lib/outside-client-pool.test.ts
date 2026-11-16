/**
 * 🗓 W1-B18 — a new shop with its auto-made schedule can add its first outside client (live fault on 8c1bbc1:
 * "Pick which schedule this client belongs to. Nothing was added." with no picker on screen).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { outsideClientPoolOf } from './outside-client-pool';

const auto = [{ poolId: '7f0c2b9e-0000-4000-8000-000000000001' }];

test('a new shop with ONE auto-made schedule adds its first client even when the sheet posts no schedule', () => {
  assert.equal(outsideClientPoolOf('', auto), auto[0]!.poolId);
  assert.equal(outsideClientPoolOf(null, auto), auto[0]!.poolId);
  assert.equal(outsideClientPoolOf('  ', auto), auto[0]!.poolId);
});

test('a posted schedule wins; several with none posted is no pick (the sheet shows its picker)', () => {
  assert.equal(outsideClientPoolOf('p-2', [{ poolId: 'p-1' }, { poolId: 'p-2' }]), 'p-2');
  assert.equal(outsideClientPoolOf('', [{ poolId: 'p-1' }, { poolId: 'p-2' }]), null);
  assert.equal(outsideClientPoolOf('', []), null);
  assert.equal(outsideClientPoolOf('', [{ poolId: '' }]), null, 'never an empty schedule');
});

test('the sheet and the server both ask the one rule — the sheet never posts an empty pool for one schedule', () => {
  const sheet = readFileSync(join(process.cwd(), 'app/vendor-dashboard/customers/_components/outside-client-add.tsx'), 'utf8');
  assert.match(sheet, /name="pool_id" value=\{outsideClientPoolOf\(pool, pools\)/);
  const action = readFileSync(join(process.cwd(), 'app/vendor-dashboard/calendar/actions.ts'), 'utf8');
  assert.match(action, /outsideClientPoolOf\(null, await fetchVendorPools\(/);
});
