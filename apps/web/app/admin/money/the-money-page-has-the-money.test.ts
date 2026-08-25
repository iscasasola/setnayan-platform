/**
 * The two properties that make /admin/money a LEDGER and keep it safe.
 *
 * Both are source assertions, and both are anchored to a SPECIFIC construct
 * rather than matched anywhere in the file — a file-level substring match is
 * the decoration trap this repo keeps paying for: an import or a comment
 * mentioning the symbol satisfies it while the thing itself is gone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(process.cwd(), 'app/admin/money');
const ledger = readFileSync(join(HERE, '_components/transactions-ledger.tsx'), 'utf8');
const page = readFileSync(join(HERE, 'page.tsx'), 'utf8');

/** Comments explain the very filters this file bans, so strip them first. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The orders read only — not the payments/receipts side reads. */
function ordersQuery(src: string): string {
  const start = src.indexOf(".from('orders')");
  assert.notEqual(start, -1, "the ledger must still read orders");
  const end = src.indexOf(';', start);
  return src.slice(start, end);
}

test('the ledger lists EVERY transaction — it never filters orders by status', () => {
  const q = ordersQuery(stripComments(ledger));
  // 🔑 A QUEUE IS NOT A LEDGER. /admin/payments narrows to status='submitted',
  // which is why a settled sale vanishes from it. Narrowing this query would
  // silently turn the ledger back into a second copy of that queue — the exact
  // hole this page was built to close, and nothing would throw.
  const narrowed = q.match(/\.(eq|in|neq|filter)\(\s*'status'/g) ?? [];
  assert.deepEqual(
    narrowed,
    [],
    `the orders read must stay unfiltered by status; found ${narrowed.length}: ${narrowed.join(', ')}`,
  );
  // And it must still be ordered newest-first, or "newest first" is a lie.
  assert.match(q, /\.order\(\s*'created_at',\s*\{\s*ascending:\s*false/);
});

test('an unmeasured queue count renders an em-dash, never a confident zero', () => {
  const src = stripComments(ledger);
  // On a money screen a 0 claims "nothing is waiting". `null` means the read
  // did not happen — a different and much weaker claim.
  assert.match(src, /q\.count == null \? '—' : q\.count/);
  assert.match(src, /received == null \? null : formatPhp\(received\)/);
  assert.match(src, /outstanding == null \? null : formatPhp\(outstanding\)/);
});

test('the page gates on requireAdmin BEFORE it mounts the service-role read', () => {
  const src = stripComments(page);
  const gate = src.indexOf('await requireAdmin()');
  const mount = src.indexOf('<TransactionsLedger');
  assert.notEqual(gate, -1, 'the money landing must call requireAdmin()');
  assert.notEqual(mount, -1, 'the money landing must mount the ledger');
  // The admin LAYOUT is not a safe boundary in front of a service-role client:
  // layouts do not re-run on soft navigation or a crafted RSC request, so a
  // page-level gate is the only thing standing between a non-admin and the
  // whole transaction ledger.
  assert.ok(gate < mount, 'requireAdmin() must run before the ledger is mounted');
});

test('money words come from the shared maps, never re-typed here', () => {
  const src = stripComments(ledger);
  // Two copies of a money rule always drift. The amount is derived by
  // orderGrossOwed and the status word by ORDER_STATUS_LABEL — both shared.
  assert.match(src, /orderGrossOwed\(\{/);
  assert.match(src, /ORDER_STATUS_LABEL\[r\.status\]/);
  assert.ok(
    !/['"]Awaiting payment['"]|['"]Cancelled['"]|['"]Refunded['"]/.test(src),
    'status words must come from ORDER_STATUS_LABEL, not a second copy here',
  );
});
