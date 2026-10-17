/**
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER — ROUND 2, the live JSON columns, through the REAL replayed schema, as the
 * couple (owner 2026-10-18; the pure half is `lib/two-hosts-every-writer-sends-its-base.test.ts`).
 *
 * A server action that reads a JSON column, changes its part and writes the WHOLE value back lost any save that landed
 * between its read and its write. `updateJsonColumn` (lib/update-json-column.ts) writes only if the column still holds
 * exactly what was read — jsonb equality, compared by the database — and otherwise builds again on the newer value.
 *
 * PGlite is one session, so the race is staged inside the builder: the other screen's write lands between this
 * writer's read and its write — exactly the window the old code lost.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18) — listed in the PR body.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { clientAs } from './pglite-client';
import { updateJsonColumn, type JsonColumnClient } from '../../lib/update-json-column';
import { mergeFromBase } from '../../lib/merge-from-base';

let replay: ReplayResult;
let db: PGlite;
const F = { couple: '', cohost: '', stranger: '', eventId: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const user = async (email: string) => (await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email])).rows[0]!.id;
  F.couple = await user('round2-a@two-hosts.test');
  F.cohost = await user('round2-b@two-hosts.test');
  F.stranger = await user('round2-c@two-hosts.test');
  F.eventId = (
    await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting) VALUES ('Indalecio & Claire', 'wedding', 'catholic', 'garden') RETURNING event_id AS e`)
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'couple')`, [F.eventId, F.couple, F.cohost]);
});
after(async () => {
  await db?.close();
});

const as = (who: string) => clientAs(db, who) as unknown as JsonColumnClient;
const target = () => ({ table: 'events', row: { event_id: F.eventId }, column: 'reception_design', what: 'Your room design' });
const stored = async () => (await db.query<{ d: Record<string, unknown> }>(`SELECT reception_design AS d FROM public.events WHERE event_id = $1`, [F.eventId])).rows[0]!.d;
const set = async (d: unknown) => db.query(`UPDATE public.events SET reception_design = $1 WHERE event_id = $2`, [JSON.stringify(d), F.eventId]);

test('anti-vacuity: a write against the value it read lands — and one against a value that moved does not', async () => {
  await set({ stage: { backdrop: 'arch' } });
  const ok = await updateJsonColumn(as(F.couple), target(), (cur) => ({ next: { ...(cur as object), ceiling: { lights: 'fairy' } } }));
  assert.equal(ok.written, true, 'a write against the value it read did not land — every save would loop');
  assert.deepEqual(await stored(), { stage: { backdrop: 'arch' }, ceiling: { lights: 'fairy' } });
  // The compare is real: a builder that never sees the other screen's write would write it away.
  let rounds = 0;
  await updateJsonColumn(as(F.couple), target(), async (cur) => {
    rounds += 1;
    if (rounds === 1) await set({ ...(cur as object), floor: { carpet: 'red' } }); // the other screen lands NOW
    return { next: { ...(cur as object), stage: { backdrop: 'florals' } } };
  });
  assert.equal(rounds, 2, 'a write against a value that moved landed anyway — the race is invisible');
  assert.deepEqual((await stored()).floor, { carpet: 'red' }, 'the other screen’s save was wiped');
});

test('two hosts on the room design, both from the same copy: each keeps the other’s pick (merge from base + the compare)', async () => {
  const opened = { stage: { backdrop: 'arch' }, ceiling: { lights: 'fairy' } };
  await set(opened);
  // Claire (co-host) changes the ceiling; Indalecio, still on `opened`, changes the stage — and his read lands first.
  const claire = { ...opened, ceiling: { lights: 'chandelier' } };
  const indalecio = { ...opened, stage: { backdrop: 'florals' } };
  let rounds = 0;
  const r = await updateJsonColumn<Record<string, unknown>, boolean>(as(F.couple), target(), async (cur) => {
    rounds += 1;
    if (rounds === 1) {
      const m = mergeFromBase(opened, claire, cur);
      await updateJsonColumn(as(F.cohost), target(), () => ({ next: m.value }));
    }
    const m = mergeFromBase(opened, indalecio, cur ?? {});
    return { next: m.value, said: m.moved };
  });
  assert.deepEqual(await stored(), { stage: { backdrop: 'florals' }, ceiling: { lights: 'chandelier' } }, 'one host’s pick was wiped by the other’s whole design');
  assert.equal(r.said, true, 'the screen is not told the design now holds the other pick');
});

test('somebody who is not a host writes nothing — and the caller is told nothing was written', async () => {
  await set({ stage: { backdrop: 'arch' } });
  const r = await updateJsonColumn(as(F.stranger), target(), (cur) => ({ next: { ...(cur ?? {}), stage: { backdrop: 'hijacked' } } }));
  assert.equal(r.written, false, 'a refused write reported itself written');
  assert.deepEqual(await stored(), { stage: { backdrop: 'arch' } });
});
