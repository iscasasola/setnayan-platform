/**
 * fetchVendorFunnelTotalsResult — a refused count is not a count of zero.
 *
 * WHY THIS TEST EXISTS. The four reads behind the vendor funnel were folded
 * into `count ?? 0`, which cannot tell "the database refused this query" from
 * "there were none". This file's own docblock records what that cost once
 * already: `BOOKED_EVENT_VENDOR_STATUSES` carried a label that is not in the
 * enum, Postgres rejected all four `event_vendors` queries with 22P02, and the
 * only symptom anybody could see was a booked count of zero — for months.
 *
 * The guard beside the console table checks that surfaces PASS an error along.
 * This checks the thing underneath it: that the error exists to be passed. The
 * function takes its client as an argument, so the refusal can be handed to it
 * directly — no mocking framework, nothing stubbed globally.
 *
 * 🛡 Every assertion here was mutation-checked: the corresponding rule was
 * broken on purpose, the occurrence count printed before and after to prove the
 * sabotage landed, and the test confirmed RED before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchVendorFunnelTotalsResult } from './vendor-funnel';

/** Exactly the client shape the function accepts — no cast at any call site. */
type FunnelClient = Parameters<typeof fetchVendorFunnelTotalsResult>[0];

/**
 * A stand-in PostgREST client. Each `.select()` resolves with whatever the
 * queue hands back — the same `{ count, error }` shape postgrest-js resolves
 * with, INCLUDING the part that matters: it resolves, it does not throw.
 */
function clientYielding(
  results: { count: number | null; error?: { message: string } }[],
): FunnelClient {
  let i = 0;
  const chain = () => {
    // The queue is indexed defensively: a client asked for more reads than the
    // test scripted would otherwise fail as `undefined`, which reads like a
    // production bug rather than a test that is short an entry.
    const result = results[Math.min(i, results.length - 1)] ?? { count: null };
    i += 1;
    const self: Record<string, unknown> = {};
    for (const key of ['eq', 'gte', 'in']) self[key] = () => self;
    // Awaiting the chain resolves it, exactly as the real builder does.
    self.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ count: result.count, error: result.error ?? null }).then(resolve);
    return self;
  };
  return { from: () => ({ select: () => chain() }) };
}

const OK = { count: 7 } as const;

test('a refused stage makes the whole funnel NOT MEASURED, never a zero', async () => {
  for (const position of [0, 1, 2, 3]) {
    const results = [OK, OK, OK, OK].map((r, i) =>
      i === position ? { count: null, error: { message: 'column does not exist' } } : { ...r },
    );
    const out = await fetchVendorFunnelTotalsResult(
      clientYielding(results),
      'v1',
      '2026-01-01',
    );
    assert.equal(
      out.totals,
      null,
      `stage ${position} was refused, so no stage may be reported. A single ` +
        'refused stage rendered beside three real ones does not read as an ' +
        'error — it reads as a collapse in conversion at exactly that step.',
    );
    assert.equal(out.error?.message, 'column does not exist');
  }
});

test('a stage that returns no count at all is also NOT MEASURED', async () => {
  // No error, no count. Nothing was counted, so there is no count to call zero.
  const out = await fetchVendorFunnelTotalsResult(
    clientYielding([OK, { count: null }, OK, OK]),
    'v1',
    '2026-01-01',
  );
  assert.equal(out.totals, null);
  assert.match(String(out.error?.message), /no count/i);
});

test('when every stage answers, the real numbers come through unchanged', async () => {
  const out = await fetchVendorFunnelTotalsResult(
    clientYielding([{ count: 40 }, { count: 12 }, { count: 5 }, { count: 0 }]),
    'v1',
    '2026-01-01',
  );
  assert.equal(out.error, null);
  assert.deepEqual(out.totals, { views: 40, inquiries: 12, quotes: 5, booked: 0 });
  // ⚠ THE POSITIVE CONTROL THAT MATTERS: a genuine zero must still be a zero.
  // A guard that turned every zero into "unknown" would be just as wrong in the
  // other direction — the booked stage here really is empty, and says so.
  assert.equal(out.totals?.booked, 0);
});
