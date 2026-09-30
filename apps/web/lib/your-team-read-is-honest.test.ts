/**
 * your-team-read-is-honest.test.ts — the couple's TEAM, read so that a refusal
 * reaches the screen (copy of `guests-read-is-honest.test.ts`, same three rules).
 *
 * `fetchEventVendors` throws on a refused read. Wrapped in a `?? []` the page
 * would say "No one on your team yet" to a couple with five suppliers booked —
 * byte-identical to a brand-new event. `readEventVendorsMeasured` reports
 * whether it MEASURED; the page renders "Couldn't load your team" when it did
 * not (`vendors/your-team-phone-first.test.ts` pins that branch).
 *
 * Behaviour is tested against a stubbed client, not the source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readEventVendorsMeasured } from '@/lib/event-vendors-read';

/** Minimal thenable query builder — every chained filter returns itself. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'neq', 'is', 'order', 'not', 'in', 'limit']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const ROW = { vendor_id: 'v1', vendor_name: 'Lumina Studio', status: 'contracted', category: 'photographer' };

test('a REFUSED read reports measured:false — not an empty team', async () => {
  const origError = console.error;
  console.error = () => {}; // the refusal is logged on purpose; keep the test output clean
  try {
    const got = await readEventVendorsMeasured(
      stubClient({ data: null, error: { message: 'permission denied for table event_vendors', code: '42501' } }),
      'e1',
    );
    assert.equal(got.measured, false, 'a refusal must be reported, not swallowed');
    assert.deepEqual(got.rows, [], 'rows are unknown, and unknown is never rendered as none');
  } finally {
    console.error = origError;
  }
});

test('a SUCCESSFUL empty read reports measured:true — genuinely no one yet', async () => {
  const got = await readEventVendorsMeasured(stubClient({ data: [], error: null }), 'e1');
  assert.equal(got.measured, true);
  assert.deepEqual(got.rows, []);
});

test('a successful read carries the rows through untouched', async () => {
  const got = await readEventVendorsMeasured(stubClient({ data: [ROW], error: null }), 'e1');
  assert.equal(got.measured, true);
  assert.equal(got.rows.length, 1);
  assert.equal(got.rows[0]!.vendor_id, 'v1');
});

test('the two empties are DISTINGUISHABLE — which is the entire point', async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    const refused = await readEventVendorsMeasured(
      stubClient({ data: null, error: { message: 'timeout', code: '57014' } }),
      'e1',
    );
    const empty = await readEventVendorsMeasured(stubClient({ data: [], error: null }), 'e1');
    assert.deepEqual(refused.rows, empty.rows, 'same rows …');
    assert.notEqual(refused.measured, empty.measured, '… different truth, and the screen must tell them apart');
  } finally {
    console.error = origError;
  }
});
