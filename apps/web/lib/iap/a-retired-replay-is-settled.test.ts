/**
 * 🗑 A RETIRED PRODUCT'S OLD TRANSACTION IS SETTLED, NOT REPLAYED FOREVER (live fault, 27 Nov 2026).
 *
 * Prod logged "App Store purchase — no intent for this token … papic_credits_100, Sandbox" on every Home open: a
 * pre-November test purchase of a product retired 3 Nov, whose intent the 16 Nov migration cleared. The server
 * refused it, the phone never finished it, and it replayed. Now: a RETIRED product with no intent is settled
 * (`retired` — the phone finishes it, nothing granted, no fault); a CURRENT product with no intent is still a loud
 * fault that names the token and the route; every other refusal is unchanged.
 *
 * Executed through the REAL `fulfilAppleTransaction` with a fake database; the fault recorder is spied.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppleTransaction } from './apple-transaction';
import { iapProductForDelivery, isRetiredIapProduct } from './products-delivery';
import { IAP_PAPIC_PRODUCTS } from './products';
import { screenFor, settled } from './iap-outcome';

const faults: Array<{ element_name?: string; error_message?: string; payload_snapshot?: Record<string, unknown> }> = [];
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === '@/lib/telemetry/fault-log') {
      return {
        insertFaultLog: async (input: (typeof faults)[number]) => {
          faults.push(input);
          return null;
        },
      };
    }
    return load.call(this, request, ...rest);
  };
}
const srv = () => import('./fulfil.server');

const TOKEN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function tx(productId: string): AppleTransaction {
  const product = iapProductForDelivery(productId);
  assert.ok(product, `test product ${productId} must be deliverable`);
  return {
    transactionId: '2000000123456789',
    originalTransactionId: '2000000123456789',
    bundleId: 'com.setnayan.app',
    product,
    appAccountToken: TOKEN,
    environment: 'Sandbox',
    quantity: 1,
    priceMilliunits: null,
    currency: null,
    purchaseDate: null,
    revocationDate: null,
    revocationReason: null,
  };
}

/** A database with the given intent row (null = no intent for any token). Any write fails the test. */
function db(intent: Record<string, unknown> | null): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: intent, error: null }),
    update: () => {
      throw new Error('no write expected');
    },
    insert: () => {
      throw new Error('no write expected');
    },
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

test('a RETIRED product with no intent is settled — nothing granted, no fault, the phone finishes it', async () => {
  const { fulfilAppleTransaction } = await srv();
  assert.equal(isRetiredIapProduct('com.setnayan.app.papic_credits_100'), true);
  faults.length = 0;
  for (const via of ['replay', 'restore', 'confirm', 'notification'] as const) {
    const o = await fulfilAppleTransaction(db(null), tx('com.setnayan.app.papic_credits_100'), { expectUserId: 'u1', via });
    assert.deepEqual(o, { status: 'retired' });
  }
  assert.equal(faults.length, 0, 'a retired replay is one info line, never a fault on every open');
  assert.equal(settled({ status: 'retired' }), true, 'the phone finishes a retired transaction');
  assert.notEqual(screenFor('purchased', { status: 'retired' }).kind, 'on', 'nothing is said to be on');
});

test('a CURRENT product with no intent stays a loud fault, naming the token and the route', async () => {
  const { fulfilAppleTransaction } = await srv();
  const current = IAP_PAPIC_PRODUCTS[0]!.productId;
  assert.equal(isRetiredIapProduct(current), false);
  faults.length = 0;
  const o = await fulfilAppleTransaction(db(null), tx(current), { expectUserId: 'u1', via: 'replay' });
  assert.deepEqual(o, { status: 'refused', reason: 'unknown_token' });
  assert.equal(faults.length, 1);
  assert.equal(faults[0]!.element_name, 'App Store purchase — no intent for this token');
  assert.equal(faults[0]!.payload_snapshot?.intentKey, TOKEN);
  assert.equal(faults[0]!.payload_snapshot?.via, 'replay');
  assert.equal(settled({ status: 'refused', reason: 'unknown_token' }), false, 'still unfinished — Apple re-delivers');
});

test('a retired product WITH an intent is not short-circuited: the other refusals hold', async () => {
  const { fulfilAppleTransaction } = await srv();
  const retired = 'com.setnayan.app.papic_credits_100';
  const row = (over: Record<string, unknown>) => ({
    app_account_token: TOKEN,
    user_id: 'u1',
    event_id: 'e1',
    vendor_profile_id: null,
    product_id: retired,
    service_key: 'PAPIC_GUEST_100',
    transaction_id: null,
    order_id: null,
    ...over,
  });
  assert.deepEqual(await fulfilAppleTransaction(db(row({ user_id: 'someone-else' })), tx(retired), { expectUserId: 'u1' }), {
    status: 'refused',
    reason: 'not_yours',
  });
  assert.deepEqual(await fulfilAppleTransaction(db(row({ product_id: IAP_PAPIC_PRODUCTS[0]!.productId })), tx(retired), { expectUserId: 'u1' }), {
    status: 'refused',
    reason: 'product_mismatch',
  });
  assert.deepEqual(await fulfilAppleTransaction(db(row({ transaction_id: 'another' })), tx(retired), { expectUserId: 'u1' }), {
    status: 'refused',
    reason: 'token_reused',
  });
});
