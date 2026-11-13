/**
 * 🏛 A WEDDING WITH NO VENUE TYPE IS "NOT SET" (owner 13 Nov 2026, walk F-W2-02) — migration 20271345020514.
 *
 * `events_wedding_fields_consistency` used to require `venue_setting` on every wedding, so the onboarding stored a
 * default 'banquet_hall' for a couple who picked nothing, and Details called their venue a banquet hall. The rule now:
 * a wedding needs its ceremony type, its reception venue type may be NULL; a non-wedding carries neither.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
before(async () => {
  replay = await createReplayedDb();
});
after(async () => {
  await replay?.db.close();
});

test('a wedding may be stored with no venue type ("Not set")', async () => {
  const id = randomUUID();
  await replay.db.query(
    `INSERT INTO public.events (event_id, display_name, event_type, ceremony_type, venue_setting) VALUES ($1, 'no venue yet', 'wedding', 'civil', NULL)`,
    [id],
  );
  const r = await replay.db.query<{ venue_setting: string | null }>(`SELECT venue_setting FROM public.events WHERE event_id = $1`, [id]);
  assert.equal(r.rows[0]?.venue_setting, null);
});

test('a wedding still needs its ceremony type, and a non-wedding still carries no venue type', async () => {
  await assert.rejects(
    replay.db.query(`INSERT INTO public.events (event_id, display_name, event_type, ceremony_type, venue_setting) VALUES ($1, 'x', 'wedding', NULL, 'garden')`, [randomUUID()]),
    /events_wedding_fields_consistency/,
  );
  await assert.rejects(
    replay.db.query(`INSERT INTO public.events (event_id, display_name, event_type, ceremony_type, venue_setting) VALUES ($1, 'x', 'birthday', NULL, 'garden')`, [randomUUID()]),
    /events_wedding_fields_consistency/,
  );
});
