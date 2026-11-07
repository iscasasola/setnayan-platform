/**
 * shop-name-hold.test.ts — the app side of "A HELD SHOP NAME HOLDS ITS CORE" (owner 2026-11-06).
 *
 * The CORE itself has no TypeScript copy on purpose (see `lib/shop-name-hold.ts`): its examples — "Bulgogi Catering",
 * "Bulgogi 1", "BULGOGI-2", "Bulgogi Events PH" → `bulgogi`, the short and trade-words-only cores that must not block,
 * the non-ASCII name — are executed against the real SQL in `tests/db/a-held-shop-name-holds-its-core.db.test.ts`.
 *
 * What is held here:
 *   1. `checkShopNameHold` turns the database's answer into a state, and FAILS CLOSED — an error or a missing row is
 *      `unverified`, never `free`.
 *   2. The refusal and the claim copy say nothing about WHY the other shop holds the name (privacy).
 *   3. `fileItsMyBusiness` files into the existing queue once, with the marker the admin page reads.
 *   4. EVERY shop-name writer asks the one question — the wizard's submit and live check, the My Shop rename, the
 *      correction request, the admin queue, and the couple's-link claim in SQL — and none of the vendor-facing ones
 *      hands the holder or the reason to the browser.
 *
 * Comments stripped before source matching (`lib/strip-comments.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import {
  ITS_MY_BUSINESS_NOTE,
  ITS_MY_BUSINESS_QUEUED,
  ITS_MY_BUSINESS_SENT,
  SHOP_NAME_HELD_MESSAGE,
  checkShopNameHold,
  fileItsMyBusiness,
} from '@/lib/shop-name-hold';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

function rpcClient(answer: { data: unknown; error: unknown }): SupabaseClient {
  return { rpc: async () => answer } as unknown as SupabaseClient;
}

// ── 1 · the state, failing closed ────────────────────────────────────────────

test('a held core is held, with the reason kept server-side for the admin', async () => {
  const r = await checkShopNameHold(
    rpcClient({ data: [{ core: 'bulgogi', held: true, holder_vendor_profile_id: 'v1', hold_reason: 'banned' }], error: null }),
    'Bulgogi 1',
  );
  assert.deepEqual(r, { state: 'held', core: 'bulgogi', holder: 'v1', reason: 'banned' });
});

test('a free core is free; a name with no core is free', async () => {
  assert.deepEqual(
    await checkShopNameHold(rpcClient({ data: [{ core: 'lumpiahouse', held: false, holder_vendor_profile_id: null, hold_reason: null }], error: null }), 'Lumpia House 2'),
    { state: 'free', core: 'lumpiahouse' },
  );
  assert.deepEqual(
    await checkShopNameHold(rpcClient({ data: [{ core: null, held: false, holder_vendor_profile_id: null, hold_reason: null }], error: null }), 'Catering Services'),
    { state: 'free', core: null },
  );
});

test('a refused probe, or no answer at all, is UNVERIFIED — never free', async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await checkShopNameHold(rpcClient({ data: null, error: { message: 'permission denied' } }), 'x'), { state: 'unverified' });
  } finally {
    console.error = quiet;
  }
  assert.deepEqual(await checkShopNameHold(rpcClient({ data: [], error: null }), 'x'), { state: 'unverified' });
  assert.deepEqual(await checkShopNameHold(rpcClient({ data: null, error: null }), 'x'), { state: 'unverified' });
  assert.deepEqual(
    await checkShopNameHold(rpcClient({ data: [{ core: null, held: true, holder_vendor_profile_id: null, hold_reason: null }], error: null }), 'x'),
    { state: 'unverified' },
    'a "held" with no core is an answer that makes no sense — not a refusal we can explain, not a pass',
  );
});

// ── 2 · privacy ──────────────────────────────────────────────────────────────

test('the refusal and the claim copy never say why another shop holds the name', () => {
  for (const copy of [SHOP_NAME_HELD_MESSAGE, ITS_MY_BUSINESS_NOTE, ITS_MY_BUSINESS_SENT, ITS_MY_BUSINESS_QUEUED]) {
    assert.doesNotMatch(copy, /\b(closed|closing|ban|banned|suspend\w*|fraud\w*|delet\w*|deactivat\w*|scam\w*)\b/i, `copy reveals a reason: "${copy}"`);
  }
  assert.match(SHOP_NAME_HELD_MESSAGE, /papers/, 'the refusal must name the way out');
});

// ── 3 · filing ───────────────────────────────────────────────────────────────

function queueClient(open: { requested_value: string }[]) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: open, error: null }) }) }) }),
      }),
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, inserted };
}

test('"It’s my business" files ONE request into the corrections queue, with the marker', async () => {
  const fresh = queueClient([]);
  assert.deepEqual(await fileItsMyBusiness(fresh.client, { vendorProfileId: 'v9', name: ' Bulgogi 1 ', currentValue: null }), { ok: true });
  assert.equal(fresh.inserted.length, 1);
  assert.deepEqual(fresh.inserted[0], {
    vendor_profile_id: 'v9',
    field_key: 'business_name',
    current_value: null,
    requested_value: 'Bulgogi 1',
    note: ITS_MY_BUSINESS_NOTE,
  });

  const again = queueClient([{ requested_value: 'bulgogi 1' }]);
  assert.deepEqual(await fileItsMyBusiness(again.client, { vendorProfileId: 'v9', name: 'Bulgogi 1', currentValue: null }), { ok: true });
  assert.equal(again.inserted.length, 0, 'an open request for the same name must not be filed twice');
});

// ── 4 · every writer asks the one question ───────────────────────────────────

test('the open-shop wizard asks it at submit — for the name AND the address — and in its live check', () => {
  const submit = read('app/open-shop/actions.ts');
  const ask = submit.indexOf('checkShopNameHold(admin, shopName');
  const write = submit.indexOf('business_name: shopName');
  assert.ok(ask > -1, 'becomeVendor must ask whether the shop name is held');
  assert.ok(write > ask, 'the hold must be asked BEFORE the name is written');
  assert.match(submit, /checkShopNameHold\(admin, chosenSlug/, 'the address is the name in another spelling — ask it too');
  assert.match(submit, /SHOP_NAME_HELD_MESSAGE/);
  assert.match(submit, /fileItsMyBusiness\(/, 'the wizard must file "It’s my business" with the shop');

  const live = read('app/open-shop/address-actions.ts');
  assert.match(live, /checkShopNameHold\(/, 'the live check must ask the SAME function the submit asks');
  assert.match(read('app/open-shop/_components/open-shop-wizard.tsx'), /<NameHold\b/);
});

test('the My Shop rename and the correction request ask it', () => {
  const src = read('app/vendor-dashboard/actions.ts');
  const renameCase = src.slice(src.indexOf("case 'business_name':"), src.indexOf("case 'business_owner_name':"));
  assert.match(renameCase, /checkShopNameHold\(/, 'the My Shop rename must ask whether the new name is held');
  assert.match(renameCase, /heldName:/, 'a held rename must hand the row its "It’s my business" button');
  const correction = src.slice(src.indexOf('export async function requestProfileCorrection'));
  assert.match(correction.slice(0, correction.indexOf('vendor_correction_requests')), /checkShopNameHold\(/);
  assert.match(read('app/vendor-dashboard/shop/_components/editable-row.tsx'), /<HeldNameClaim\b/);
});

test('the admin queue shows the holder; the couple’s-link claim asks it in SQL', () => {
  assert.match(read('app/admin/corrections/page.tsx'), /checkShopNameHold\(/);
  const dir = join(process.cwd(), '../../supabase/migrations');
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /CREATE OR REPLACE FUNCTION public\.claim_ready_the_shop\b/.test(readFileSync(join(dir, f), 'utf8')))
    .pop();
  assert.ok(latest, 'claim_ready_the_shop has a definition');
  assert.match(
    readFileSync(join(dir, latest!), 'utf8'),
    /shop_name_is_held\(v_name/,
    `the LATEST claim_ready_the_shop (${latest}) must leave a held name blank`,
  );
});

test('no vendor-facing file hands the holder or the reason to the browser', () => {
  for (const rel of [
    'app/open-shop/actions.ts',
    'app/open-shop/address-actions.ts',
    'app/open-shop/_components/name-hold.tsx',
    'app/vendor-dashboard/actions.ts',
    'app/vendor-dashboard/shop/_components/held-name-claim.tsx',
    'app/_components/held-shop-name-card.tsx',
  ]) {
    assert.doesNotMatch(read(rel), /hold\.(holder|reason)|hold_reason|holder_vendor_profile_id/, `${rel} reads who holds the name, or why`);
  }
});
