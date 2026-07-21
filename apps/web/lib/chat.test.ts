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
 *
 * Second block: countCoupleMessages' pre-accept-allowance invariant. The
 * couple's `pending`-thread allowance (inquiry + ONE follow-up) may only be
 * consumed by COUPLE-authored rows — a pending thread also carries the Vendor
 * Auto-Reply Assistant's `sender_role='vendor'` bot replies and `'system'`
 * notes, and counting those stranded conversations at `followup_used`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchVendorThreads, countCoupleMessages } from './chat';

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

/**
 * Count-query stub. countCoupleMessages chains
 * .from().select(…, { count:'exact', head:true }).eq().eq() and awaits it, so
 * this records the .eq() filters and resolves { count } over the rows that the
 * recorded filters actually select. BOTH recorded filters are honored:
 *  - no `sender_role` filter (the shipped bug) → every role counts;
 *  - no `thread_id` filter → rows from OTHER threads count too, i.e. the count
 *    spans the whole table. Rows may carry an explicit `thread_id`; a row
 *    without one belongs to whichever thread is being queried.
 * `filters` is returned so a test can assert the query was scoped at all, not
 * merely that it returned the right number for a single-thread fixture.
 */
function makeCountSupabase(rows: { sender_role: string; thread_id?: string }[]) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    },
    then: (resolve: (v: { count: number; error: null }) => unknown) => {
      const role = filters.sender_role;
      const thread = filters.thread_id;
      const matched = rows.filter(
        (r) =>
          (role === undefined || r.sender_role === role) &&
          (thread === undefined || r.thread_id === undefined || r.thread_id === thread),
      );
      return Promise.resolve({ count: matched.length, error: null as null }).then(resolve);
    },
  };
  return { supabase: builder as unknown as SupabaseClient, filters };
}

test('countCoupleMessages: the bot’s pre-accept reply must not consume the couple’s follow-up', async () => {
  // Couple inquiry + the Auto-Reply Assistant's answer on a still-pending
  // thread. Unfiltered this counts 2 → chat-send returns `followup_used` and
  // the couple can never answer the bot's own clarifying question.
  const { supabase } = makeCountSupabase([{ sender_role: 'couple' }, { sender_role: 'vendor' }]);
  assert.equal(await countCoupleMessages(supabase, 't1'), 1);
});

test('countCoupleMessages: system notes do not count, couple rows do', async () => {
  const { supabase } = makeCountSupabase([
    { sender_role: 'couple' },
    { sender_role: 'system' },
    { sender_role: 'couple' },
  ]);
  assert.equal(await countCoupleMessages(supabase, 't2'), 2);
});

test('countCoupleMessages: empty thread is 0 (the isFirstMessage / new-inquiry path)', async () => {
  assert.equal(await countCoupleMessages(makeCountSupabase([]).supabase, 't3'), 0);
});

test('countCoupleMessages: the count is scoped to ONE thread, not the whole table', async () => {
  // Without `.eq('thread_id', threadId)` this counts every couple-authored row
  // in chat_messages — every other couple's inquiry would instantly push this
  // thread past the pre-accept allowance (`followup_used` on message one) and
  // suppress the `vendor_inquiry` notification, because isFirstMessage is
  // `priorMessageCount === 0`.
  const { supabase, filters } = makeCountSupabase([
    { sender_role: 'couple', thread_id: 't-mine' },
    { sender_role: 'couple', thread_id: 't-someone-else' },
    { sender_role: 'couple', thread_id: 't-someone-else' },
  ]);
  assert.equal(await countCoupleMessages(supabase, 't-mine'), 1);
  // Belt-and-braces on the stub itself: the filter really was recorded, so the
  // count above came from scoping and not from a fixture that happened to fit.
  assert.equal(filters.thread_id, 't-mine');
  assert.equal(filters.sender_role, 'couple');
});
