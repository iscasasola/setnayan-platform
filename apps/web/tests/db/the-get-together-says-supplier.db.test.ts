/**
 * RW-65 (walk 13 Nov 2026): the Get-together tile reads "No suppliers to book.", never "No vendors, no marketplace."
 * Against the replayed schema, because a plain test passed while the migration named a table that does not exist
 * (`event_types_vocab`) — the replay refused the file and only a db test sees that.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db.close();
});

test('the simple event type reads "No suppliers to book."', async () => {
  const r = await replay.db.query<{ description: string }>(
    `select description from public.event_type_vocab where event_type = 'simple_event'`,
  );
  assert.equal(r.rows.length, 1, 'the simple_event row exists — a blank cannot pass');
  assert.match(r.rows[0]!.description, /No suppliers to book\.$/);
  assert.doesNotMatch(r.rows[0]!.description, /vendor|marketplace/i);
});
