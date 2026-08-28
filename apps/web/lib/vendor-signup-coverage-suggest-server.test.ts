import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { maybeSuggestCoverageFromWebsite } from './vendor-signup-coverage-suggest-server';
import { isVendorSignupCoverageSuggestEnabled } from './vendor-signup-coverage-suggest-flag';

/**
 * Hermetic unit coverage for the C5 signup-suggestion trigger, mirroring the
 * fake-admin-client pattern `vendor-deep-search-run.test.ts` already
 * established for the sibling seam. No real database, no real network:
 * `runDeepSearchOrLite` takes the keyless Lite path (no `ANTHROPIC_API_KEY`
 * in this test run) and `globalThis.fetch` is mocked so even the Lite
 * website read never leaves the process.
 */

const BASE_INPUTS = {
  business_name: 'Aurora Blooms',
  website: 'aurorablooms.ph',
  social_url: null,
  location_city: 'Cebu City',
  claimed_services: [],
};

type Call = { table: string; op: string; payload?: unknown };

function fakeAdmin(opts: {
  privacyActive: boolean;
  existingDossier: { id: number } | null;
  insertedDossierId: number;
}): { client: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      let op = '';
      let payload: unknown;
      const builder: Record<string, unknown> = {
        select() {
          op = op || 'select';
          calls.push({ table, op });
          return builder;
        },
        insert(p: unknown) {
          op = 'insert';
          payload = p;
          calls.push({ table, op, payload });
          return builder;
        },
        update(p: unknown) {
          op = 'update';
          payload = p;
          calls.push({ table, op, payload });
          return builder;
        },
        eq: () => builder,
        limit: () => builder,
        maybeSingle: () => {
          if (table === 'data_privacy_controls') {
            return Promise.resolve({
              data: opts.privacyActive ? { status: 'active' } : null,
              error: null,
            });
          }
          if (table === 'vendor_web_dossiers' && op === 'insert') {
            return Promise.resolve({ data: { id: opts.insertedDossierId }, error: null });
          }
          if (table === 'vendor_web_dossiers' && op === 'select') {
            return Promise.resolve({ data: opts.existingDossier, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function withMockedWebsiteFetch<T>(run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      '<html><head><title>Aurora Blooms</title>' +
        '<meta name="description" content="Cebu florist"></head>' +
        '<body>Bridal bouquet ₱7,500.</body></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test('flag off: never touches the admin client at all', async () => {
  const prevFlag = process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  delete process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  assert.equal(isVendorSignupCoverageSuggestEnabled(), false);

  const { client, calls } = fakeAdmin({
    privacyActive: true,
    existingDossier: null,
    insertedDossierId: 1,
  });
  await maybeSuggestCoverageFromWebsite({ admin: client, vendorProfileId: 'v-1', inputs: BASE_INPUTS });
  assert.equal(calls.length, 0);

  if (prevFlag === undefined) delete process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  else process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = prevFlag;
});

test('flag on, no website: never touches the admin client', async () => {
  const prevFlag = process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = 'true';

  const { client, calls } = fakeAdmin({
    privacyActive: true,
    existingDossier: null,
    insertedDossierId: 1,
  });
  await maybeSuggestCoverageFromWebsite({
    admin: client,
    vendorProfileId: 'v-1',
    inputs: { ...BASE_INPUTS, website: null },
  });
  assert.equal(calls.length, 0);

  if (prevFlag === undefined) delete process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  else process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = prevFlag;
});

test('flag on, privacy control inactive: reads the control, writes nothing', async () => {
  const prevFlag = process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = 'true';

  const { client, calls } = fakeAdmin({
    privacyActive: false,
    existingDossier: null,
    insertedDossierId: 1,
  });
  await maybeSuggestCoverageFromWebsite({ admin: client, vendorProfileId: 'v-1', inputs: BASE_INPUTS });
  assert.equal(calls.filter((c) => c.op === 'insert').length, 0);

  if (prevFlag === undefined) delete process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  else process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = prevFlag;
});

test('a signup_suggestion dossier already exists: never inserts a second one', async () => {
  const prevFlag = process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = 'true';

  const { client, calls } = fakeAdmin({
    privacyActive: true,
    existingDossier: { id: 55 },
    insertedDossierId: 1,
  });
  await maybeSuggestCoverageFromWebsite({ admin: client, vendorProfileId: 'v-1', inputs: BASE_INPUTS });
  assert.equal(calls.filter((c) => c.table === 'vendor_web_dossiers' && c.op === 'insert').length, 0);

  if (prevFlag === undefined) delete process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  else process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = prevFlag;
});

test('eligible run: inserts a signup_suggestion row and completes it — never writes vendor_deep_search_uses', async () => {
  const prevFlag = process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = 'true';
  delete process.env.ANTHROPIC_API_KEY; // force the hermetic Lite path

  const { client, calls } = fakeAdmin({
    privacyActive: true,
    existingDossier: null,
    insertedDossierId: 4242,
  });

  await withMockedWebsiteFetch(() =>
    maybeSuggestCoverageFromWebsite({ admin: client, vendorProfileId: 'v-1', inputs: BASE_INPUTS }),
  );

  const insertCall = calls.find((c) => c.table === 'vendor_web_dossiers' && c.op === 'insert');
  assert.ok(insertCall);
  const insertPayload = insertCall!.payload as Record<string, unknown>;
  assert.equal(insertPayload.kind, 'signup_suggestion');
  assert.equal(insertPayload.requested_by, null);
  assert.equal(insertPayload.status, 'running');

  const updateCalls = calls.filter((c) => c.table === 'vendor_web_dossiers' && c.op === 'update');
  assert.equal(updateCalls.length, 1);
  const updatePayload = updateCalls[0]!.payload as Record<string, unknown>;
  assert.equal(updatePayload.status, 'complete');

  // Never touches the vendor's own manual-run allowance table.
  assert.equal(calls.filter((c) => c.table === 'vendor_deep_search_uses').length, 0);

  if (prevFlag === undefined) delete process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  else process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = prevFlag;
  if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prevKey;
});

test('a throw from the admin client never escapes — fail silent and optional', async () => {
  const prevFlag = process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = 'true';

  const throwingClient = {
    from() {
      throw new Error('connection refused');
    },
  } as unknown as SupabaseClient;

  await assert.doesNotReject(() =>
    maybeSuggestCoverageFromWebsite({ admin: throwingClient, vendorProfileId: 'v-1', inputs: BASE_INPUTS }),
  );

  if (prevFlag === undefined) delete process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED;
  else process.env.VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED = prevFlag;
});
