/**
 * the-payer-sees-their-own-bill.test.ts
 *
 * /pay never listed a sign-up bill's lines. Measured 2026-10-13 by the Papic
 * end-to-end tester against the replayed schema: every /pay view logged
 * "permission denied for table onboarding_order_items", because the page read
 * that table on the payer's own session — and the table is shut to every
 * session role on purpose (`tests/db/onboarding-basket-one-bill.db.test.ts`).
 * The refusal came back as `[]`, so a bill for Papic + Setnayan AI + Pro showed
 * one total with nothing under it. Silent by construction.
 *
 * Two halves hold the fix:
 *   · `tests/db/the-payer-sees-their-own-bill.db.test.ts` runs the RPC as the
 *     buyer, the partner, a guest, a stranger and a signed-out caller — the
 *     only way to see who actually gets the lines.
 *   · THIS file holds the source half: the page asks the RPC (never the
 *     table), asks only for a basket, and says so out loud when it cannot read
 *     the list instead of drawing an empty one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { readBasketLinesForPayer } from '@/lib/onboarding-order-items';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const MIGRATIONS = resolve(WEB, '../../supabase/migrations');
const read = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));

const bodyOf = (src: string, name: string): string => {
  const i = src.search(new RegExp(`(async\\s+)?function\\s+${name}\\b`));
  assert.ok(i > -1, `${name} is gone — re-point this guard`);
  const end = src.indexOf('\n}', i);
  assert.ok(end > i, `${name} has no end`);
  return src.slice(i, end);
};

const migration = (() => {
  const f = readdirSync(MIGRATIONS).find((n) => n.endsWith('_order_basket_lines_for_the_payer.sql'));
  assert.ok(f, 'the order_basket_lines migration is gone');
  return readFileSync(join(MIGRATIONS, f!), 'utf8');
})();

const functionBody = (() => {
  const i = migration.search(/CREATE OR REPLACE FUNCTION public\.order_basket_lines/i);
  assert.ok(i > -1, 'the RPC is gone');
  const end = migration.indexOf('$$;', i);
  assert.ok(end > i, 'the function body is unterminated');
  return migration.slice(i, end);
})();

test('/pay lists a basket through the RPC — never by reading the shut table', () => {
  const src = read('lib/payable-by-reference.ts');
  assert.ok(
    !/onboarding_order_items/.test(src),
    'payable-by-reference reads onboarding_order_items on the payer’s session — every view is refused',
  );
  assert.ok(
    !/readOnboardingOrderItems/.test(src),
    'payable-by-reference uses the TABLE reader; on a payer session that read is always refused',
  );
  const body = bodyOf(src, 'fetchRows');
  assert.match(body, /readBasketLinesForPayer\(/, 'the payer reader is not used');
});

test('only a basket asks — an ordinary order sends no line read at all', () => {
  const body = bodyOf(read('lib/payable-by-reference.ts'), 'fetchRows');
  const gate = body.search(/ONBOARDING_SERVICES_SKU/);
  const ask = body.search(/readBasketLinesForPayer\(/);
  assert.ok(gate > -1 && ask > gate, 'the line read is not gated on the basket SKU');
});

test('an unreadable list is SAID, never drawn as an empty one', () => {
  const body = bodyOf(read('lib/payable-by-reference.ts'), 'fetchRows');
  assert.match(
    body,
    /if\s*\(\s*!read\.ok\s*\)\s*return\s*\{\s*rows:\s*\[\],\s*unreadable:\s*true\s*\}/,
    'a refused read no longer marks the list unreadable — it would draw as an empty bill',
  );
  assert.match(
    body,
    /catch\s*\{\s*return\s*\{\s*rows:\s*\[\],\s*unreadable:\s*true\s*\}/,
    'a thrown read no longer marks the list unreadable',
  );
  const page = read('app/pay/[reference]/page.tsx');
  assert.match(page, /payable\.rowsUnreadable\s*&&/, '/pay no longer says when the list cannot be loaded');
});

test('the payer reader asks the RPC and returns { ok: false } on a refusal', () => {
  const body = bodyOf(read('lib/onboarding-order-items.ts'), 'readBasketLinesForPayer');
  assert.match(body, /\.rpc\('order_basket_lines'/);
  assert.ok(!/from\('onboarding_order_items'\)/.test(body), 'the payer reader reaches for the table');
});

test('behaviour · a refused read is { ok: false }, rows are mapped with their titles', async () => {
  const refused = { rpc: async () => ({ data: null, error: { message: 'permission denied' } }) };
  const origError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await readBasketLinesForPayer(refused as never, 'o-1'), { ok: false });
  } finally {
    console.error = origError;
  }
  const answered = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, 'order_basket_lines');
      assert.deepEqual(args, { p_order_id: 'o-1' });
      return {
        data: [
          { service_code: 'SETNAYAN_AI', title: 'Setnayan AI', quantity: 1, unit_price_php: '2499.00' },
          { service_code: 'PAPIC_ONE', title: '  ', quantity: 2, unit_price_php: 350.5 },
        ],
        error: null,
      };
    },
  };
  assert.deepEqual(await readBasketLinesForPayer(answered as never, 'o-1'), {
    ok: true,
    lines: [
      { serviceCode: 'SETNAYAN_AI', title: 'Setnayan AI', quantity: 1, unitPricePhp: 2499 },
      { serviceCode: 'PAPIC_ONE', title: null, quantity: 2, unitPricePhp: 350.5 },
    ],
  });
});

test('the RPC resolves the COUPLE, never any member, and gates before it reads', () => {
  const gate = functionBody.slice(0, functionBody.search(/RETURN QUERY/i));
  assert.ok(gate.length > 0, 'there is no gate ahead of the read');
  assert.match(gate, /public\.current_couple_event_ids\(\)/);
  assert.ok(
    !/current_event_ids\(\)/.test(gate.replace(/current_couple_event_ids\(\)/g, '')),
    'it resolves through the MEMBER-wide helper — an invited guest would see the bill',
  );
  assert.match(gate, /auth\.uid\(\)/, 'the order’s own buyer is not admitted');
  assert.match(gate, /public\.is_admin\(\)/);
  assert.match(gate, /service_role/);
  assert.match(functionBody, /\bSTABLE\b/);
  assert.ok(!/\b(INSERT INTO|UPDATE |DELETE FROM)\b/i.test(functionBody), 'the RPC writes');
});

test('🔑 the table stays shut — no grant, no policy — and anon cannot execute', () => {
  assert.ok(
    !/GRANT[^;]*\bON\s+(TABLE\s+)?public\.onboarding_order_items/i.test(migration),
    'the migration grants a table privilege on a bill’s contents',
  );
  assert.ok(!/CREATE POLICY/i.test(migration), 'the migration adds a policy to a table meant to have none');
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.order_basket_lines\(UUID\) FROM PUBLIC, anon;/i);
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.order_basket_lines\(UUID\) TO authenticated, service_role;/i,
  );
});
