/**
 * milestones.test.ts — the flush's milestone sweep after Lane S (owner 2026-11-10): the numbers come ONLY from
 * `social_milestone_real_counts()` (test and sample data left out — proven against the real SQL in
 * tests/db/social-milestones-count-real-data-only.db.test.ts), users_joined is a fourth metric, and the sweep obeys
 * its own switch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { allowServerOnly, fakeAdmin, type Answer, type Call } from './lane-s.fixture';

allowServerOnly();

type World = {
  switchOn?: boolean;
  counts?: unknown;
  rpcError?: Answer['error'];
  watermarks?: Array<{ metric: string; threshold: number }>;
};

async function sweep(w: World) {
  const { sweepMilestones } = await import('./milestones');
  const { admin, calls } = fakeAdmin((c: Call) => {
    if (c.table === 'social_publish_settings') return { data: { milestone_autopost_enabled: w.switchOn ?? true } };
    if (c.action === 'rpc') return { data: w.counts ?? null, error: w.rpcError ?? null };
    if (c.table === 'social_milestones' && c.action === 'select') return { data: w.watermarks ?? [] };
    if (c.table === 'social_posts' && c.action === 'insert') return { data: { post_id: `p-${calls.length}` } };
    return {};
  });
  await sweepMilestones(admin as never);
  return calls;
}

const posts = (calls: Call[]) =>
  calls
    .filter((c) => c.table === 'social_posts' && c.action === 'insert')
    .map((c) => c.payload as { source_type: string; source_ref: string; body: string });

test('the counts come from the real-data RPC — never a raw COUNT(*) over a table', async () => {
  const calls = await sweep({ counts: { events_created: 3, vendors_verified: 0, guests_invited: 0, users_joined: 0 } });
  assert.deepEqual(calls.filter((c) => c.action === 'rpc').map((c) => c.fn), ['social_milestone_real_counts']);
  const counted = calls.filter(
    (c) => c.action === 'select' && ['events', 'guests', 'vendor_profiles', 'users'].includes(c.table),
  );
  assert.deepEqual(counted, [], 'a direct count of events/guests/vendors/users would include test and sample data');
});

test('users_joined crossing a rung composes a milestone post, watermark first', async () => {
  const calls = await sweep({ counts: { events_created: 4, vendors_verified: 1, guests_invited: 9, users_joined: 27 } });
  const out = posts(calls);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.source_type, 'milestone');
  assert.equal(out[0]!.source_ref, 'users_joined:25');
  assert.match(out[0]!.body, /25\+ people have joined Setnayan/);
  const order = calls.filter((c) => c.action === 'insert').map((c) => c.table);
  assert.deepEqual(order, ['social_milestones', 'social_posts']);
  assert.deepEqual(calls.find((c) => c.table === 'social_milestones' && c.action === 'insert')?.payload, {
    metric: 'users_joined',
    threshold: 25,
  });
});

test('every metric that crossed a fresh rung posts once; recorded rungs do not', async () => {
  const out = posts(
    await sweep({
      counts: { events_created: 120, vendors_verified: 12, guests_invited: 2600, users_joined: 60 },
      watermarks: [{ metric: 'events_created', threshold: 100 }],
    }),
  );
  assert.deepEqual(out.map((p) => p.source_ref).sort(), ['guests_invited:2500', 'users_joined:50', 'vendors_verified:10']);
});

test('the RPC refused → nothing is composed (no guess, no fallback to a count with test data)', async () => {
  const calls = await sweep({ rpcError: { code: '42883', message: 'function does not exist' } });
  assert.equal(posts(calls).length, 0);
  assert.equal(calls.filter((c) => c.action === 'insert').length, 0);
});

test('a metric the RPC did not answer is skipped, the others still post', async () => {
  const out = posts(await sweep({ counts: { events_created: 10, users_joined: null } }));
  assert.deepEqual(out.map((p) => p.source_ref), ['events_created:10']);
});

test('the milestone switch OFF composes nothing and does not even count', async () => {
  const calls = await sweep({ switchOn: false, counts: { users_joined: 10_000 } });
  assert.equal(calls.filter((c) => c.action !== 'select').length, 0);
});
