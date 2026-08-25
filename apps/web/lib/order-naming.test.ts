import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerOrderName, orderSubject } from './order-naming';

test('a customer email names the order by the code they were emailed', () => {
  assert.equal(
    customerOrderName({ reference_code: 'SN9B5605B1', public_id: 'S89O-BSTY3J0STT' }),
    'SN9B5605B1',
  );
});

test('falls back to the internal id only when there is no reference code', () => {
  assert.equal(customerOrderName({ reference_code: null, public_id: 'S89O-X' }), 'S89O-X');
  assert.equal(customerOrderName({ reference_code: '   ', public_id: 'S89O-X' }), 'S89O-X');
});

test('names nothing rather than leaving a hole', () => {
  // 🪤 THE BUG THIS REPLACES: `Order ${order?.public_id ?? ''} marked paid`
  // renders "Order  marked paid" — a double space and a missing noun — whenever
  // the lookup misses. A subject with a hole in it reads as a broken system.
  assert.equal(customerOrderName(null), null);
  assert.equal(customerOrderName({}), null);
  const s = orderSubject('Your order is marked paid', 'marked paid', null);
  assert.equal(s, 'Your order is marked paid');
  assert.ok(!s.includes('  '), 'must never contain a double space');
});

test('subject names the order when we know it', () => {
  assert.equal(
    orderSubject('Your order is marked paid', 'marked paid', { reference_code: 'SN9B5605B1' }),
    'Order SN9B5605B1 marked paid',
  );
});

test('ONE order, ONE number: every customer notice agrees', async () => {
  // The defect, from a real inbox on 2026-08-25 — three notices, three names:
  //   "Setnayan order SN9B5605B1 — received"   (reference code)
  //   "Order S89O-BSTY3J0STT marked paid"      (internal id)
  //   "Payment of ₱2,499 matched"              (nothing at all)
  // Derived from SOURCE so a fourth notice cannot quietly pick a third scheme.
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../app/admin/payments/actions.ts', import.meta.url),
    'utf8',
  );
  // Strip comments first: the docblocks explaining this fix quote the old
  // broken form verbatim, and a raw match reports the defect it just removed.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

  const holes = stripped.match(/public_id \?\? ''/g) ?? [];
  assert.equal(
    holes.length,
    0,
    `customer notices must not name an order by its internal id (found ${holes.length})`,
  );
  // FLOOR: if this drops to 0 the rule stopped being enforced anywhere, which
  // is indistinguishable from a clean pass.
  const named = stripped.match(/customerOrderName\(|orderSubject\(/g) ?? [];
  assert.ok(
    named.length >= 3,
    `expected the shared namer at 3+ customer notices, found ${named.length}`,
  );
});
