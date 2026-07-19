/**
 * fetchVendorThreads anonymization-until-accept DTO invariants (Glass PR-6b ·
 * spec Vendor_Inquiry_Anonymization_Spec_2026-07-15). Node built-in runner via
 * tsx (`pnpm test:unit`).
 *
 * The load-bearing enforcement: the couple's identity fields (event title
 * `display_name` + public-page link `public_id`) must NOT ship to the vendor
 * client for a PRE-accept thread — they're stripped in the fetcher's mapper, so
 * no vendor-facing surface can leak them regardless of its own render logic. A
 * post-accept (token-burned) thread passes through unchanged. `event_date` is
 * retained on both (the spec permits showing the date).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchVendorThreads } from './chat';

type Row = Record<string, unknown>;

/**
 * Minimal thenable query-builder stub. fetchVendorThreads chains
 * .from().select().eq().order() and awaits it; the archive-embed branch is
 * taken when `error` is null (our happy path). Every chained method returns
 * `this`; awaiting resolves to { data, error }.
 */
function makeSupabase(rows: Row[]) {
  const result = { data: rows, error: null as null };
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder as unknown as SupabaseClient;
}

function baseRow(overrides: Row): Row {
  return {
    thread_id: 't1',
    public_id: 'S89T-0000000000',
    event_id: 'e1',
    vendor_profile_id: 'v1',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    inquiry_status: 'pending',
    accepted_at: null,
    declined_at: null,
    decline_reason: null,
    pax_at_inquiry: null,
    pax_current: null,
    vendor_first_reply_at: null,
    reads: [],
    event: { display_name: 'Ana & Leo', event_date: '2026-11-01', public_id: 'S89E-aaaaaaaaaa' },
    ...overrides,
  };
}

test('pending thread: couple identity is stripped from the DTO', async () => {
  const supabase = makeSupabase([baseRow({ inquiry_status: 'pending', accepted_at: null })]);
  const [row] = await fetchVendorThreads(supabase, 'v1');
  assert.ok(row);
  assert.equal(row.event?.display_name, null, 'event title must not ship pre-accept');
  assert.equal(row.event?.public_id, null, 'public-page link must not ship pre-accept');
  assert.equal(row.event?.event_date, '2026-11-01', 'date is permitted pre-accept');
});

test('accepted thread: full identity is preserved (revealed = what the token buys)', async () => {
  const supabase = makeSupabase([
    baseRow({
      thread_id: 't2',
      inquiry_status: 'accepted',
      accepted_at: '2026-07-02T00:00:00Z',
      event: { display_name: 'Maria & Juan', event_date: '2026-12-01', public_id: 'S89E-bbbbbbbbbb' },
    }),
  ]);
  const [row] = await fetchVendorThreads(supabase, 'v1');
  assert.ok(row);
  assert.equal(row.event?.display_name, 'Maria & Juan');
  assert.equal(row.event?.public_id, 'S89E-bbbbbbbbbb');
  assert.equal(row.event?.event_date, '2026-12-01');
});

test('declined thread (never accepted): identity stays masked', async () => {
  const supabase = makeSupabase([
    baseRow({ thread_id: 't3', inquiry_status: 'declined', accepted_at: null }),
  ]);
  const [row] = await fetchVendorThreads(supabase, 'v1');
  assert.ok(row);
  assert.equal(row.event?.display_name, null);
  assert.equal(row.event?.public_id, null);
});

test('accepted-then-displaced: revealed stays revealed', async () => {
  // accepted_at was stamped (token burned) before the later transition.
  const supabase = makeSupabase([
    baseRow({
      thread_id: 't4',
      inquiry_status: 'displaced',
      accepted_at: '2026-07-02T00:00:00Z',
      event: { display_name: 'Rai & Sol', event_date: '2026-10-01', public_id: 'S89E-cccccccccc' },
    }),
  ]);
  const [row] = await fetchVendorThreads(supabase, 'v1');
  assert.ok(row);
  assert.equal(row.event?.display_name, 'Rai & Sol');
  assert.equal(row.event?.public_id, 'S89E-cccccccccc');
});
