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
import { SERVICE, clientAs } from './pglite-client';
import { pgArrayLiteral, updateJsonColumn, type JsonColumnClient } from '../../lib/update-json-column';
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

test('a guest’s extra roles (an enum ARRAY, compared as its array literal): two hosts each add one — both stay', async () => {
  const guestId = (
    await db.query<{ g: string }>(`INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,'Ana','Cruz','both','friends') RETURNING guest_id AS g`, [F.eventId])
  ).rows[0]!.g;
  const roles = async () => (await db.query<{ r: string[] }>(`SELECT extra_roles::text[] AS r FROM public.guests WHERE guest_id = $1`, [guestId])).rows[0]!.r;
  const t = { table: 'guests', row: { guest_id: guestId, event_id: F.eventId }, column: 'extra_roles', what: 'That role', spell: pgArrayLiteral };
  // PGlite hands an enum[] back as its literal (`{a,b}`) and binds a JS list as its first element, so the list goes in
  // as its literal here; supabase-js (production) sends and reads a list. What is under test is the COMPARE.
  const list = (c: unknown): string[] => (Array.isArray(c) ? c : String(c ?? '{}').replace(/[{}]/g, '').split(',').filter(Boolean));
  let rounds = 0;
  const r = await updateJsonColumn<unknown>(as(F.couple), t, async (cur) => {
    rounds += 1;
    // Claire adds Bride's parents NOW — between this read and this write.
    if (rounds === 1) await updateJsonColumn<unknown>(as(F.cohost), t, (c) => ({ next: pgArrayLiteral([...list(c), 'bride_parents']) }));
    return { next: pgArrayLiteral([...list(cur), 'groom_parents']) };
  });
  assert.equal(r.written, true, 'a write against the list it read did not land');
  assert.equal(rounds, 2, 'the compare on an array column matched a list that had moved');
  assert.deepEqual([...(await roles())].sort(), ['bride_parents', 'groom_parents'], 'one host’s role was wiped by the other’s whole list');
});

test('the role words (role_names): renamed by two hosts at once — both words stay', async () => {
  const t = { table: 'events', row: { event_id: F.eventId }, column: 'role_names', what: 'The new name' };
  let rounds = 0;
  // renameRole writes through the admin client (role_names has no session UPDATE grant).
  const admin = clientAs(db, SERVICE) as unknown as JsonColumnClient;
  await updateJsonColumn<Record<string, unknown> | null>(admin, t, async (cur) => {
    rounds += 1;
    if (rounds === 1) await updateJsonColumn<Record<string, unknown> | null>(admin, t, (c) => ({ next: { ...(c ?? {}), secondary_sponsor: { one: 'Ninang' } } }));
    return { next: { ...(cur ?? {}), principal_sponsor: { one: 'Godparent' } } };
  });
  const names = (await db.query<{ n: Record<string, unknown> }>(`SELECT role_names AS n FROM public.events WHERE event_id = $1`, [F.eventId])).rows[0]!.n;
  assert.deepEqual(Object.keys(names).sort(), ['principal_sponsor', 'secondary_sponsor'], 'one host’s rename was wiped');
});
