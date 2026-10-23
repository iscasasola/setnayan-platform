/**
 * tests/db/people-remove-removes.db.test.ts — ✕ → Remove on People removes
 * every kind of row it is drawn on, and changes NOTHING it may not.
 *
 * Owner, 2026-10-23: *"why can't i delete anyone"*. A connected row ("Marco
 * Testing · No label yet") pressed ✕ → Remove and stayed. The action filtered
 * on `from_person_id = me`, so a connection the OTHER person had asked for (I am
 * `to_person_id`) matched zero rows — and zero rows returned no error, so the
 * screen said nothing. The database always allowed it; the filter did not.
 *
 * The removal filter here is not re-typed: it is `removableConnectionFilter`
 * from `lib/people-remove.ts` — the exact string the action hands PostgREST —
 * translated to SQL below, so a change to that function changes these tests.
 *
 * Every count is asserted with RETURNING, because a zero-row UPDATE is
 * success-shaped: the only honest answer is how many rows moved.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { removableConnectionFilter } from '../../lib/people-remove';

let replay: ReplayResult;
let db: PGlite;

const U: Record<'ice' | 'marco' | 'ana' | 'paolo' | 'tita' | 'stranger', { uid: string; person: string }> = {
  ice: { uid: '', person: '' },
  marco: { uid: '', person: '' },
  ana: { uid: '', person: '' },
  paolo: { uid: '', person: '' },
  tita: { uid: '', person: '' },
  stranger: { uid: '', person: '' },
};
let handAdded = ''; // a person node with no account behind it

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

/**
 * PostgREST `.or()` → SQL, for exactly the grammar `removableConnectionFilter`
 * speaks: `col.eq.value` terms, `and(…)` groups, commas meaning OR. Anything
 * else throws, so the translation can never silently widen.
 */
function orFilterToSql(filter: string, params: unknown[]): string {
  const splitTop = (s: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(cur);
        cur = '';
      } else cur += ch;
    }
    parts.push(cur);
    return parts;
  };
  const term = (t: string): string => {
    const g = /^and\((.*)\)$/.exec(t);
    if (g) return `(${splitTop(g[1]!).map(term).join(' AND ')})`;
    const m = /^([a-z_]+)\.eq\.(.+)$/.exec(t);
    if (!m) throw new Error(`orFilterToSql: unsupported term "${t}"`);
    params.push(m[2]);
    return `${m[1]} = $${params.length}`;
  };
  return `(${splitTop(filter).map(term).join(' OR ')})`;
}

/** What `withdrawConnection` runs, as `uid`: the rows it changed. */
async function removeAs(who: keyof typeof U, connectionId: string): Promise<number> {
  const params: unknown[] = [connectionId];
  const where = orFilterToSql(removableConnectionFilter(U[who].person), params);
  try {
    await asUser(U[who].uid);
    const r = await db.query(
      `UPDATE public.person_connections SET deleted_at = now()
        WHERE connection_id = $1 AND ${where} AND deleted_at IS NULL
        RETURNING connection_id`,
      params,
    );
    return r.rows.length;
  } finally {
    await reset();
  }
}

/** The roster's own read (`getPeopleRoster`), as `uid`: the live connection ids on their page. */
async function onTheirPage(who: keyof typeof U): Promise<string[]> {
  try {
    await asUser(U[who].uid);
    const me = U[who].person;
    const r = await db.query<{ connection_id: string }>(
      `SELECT connection_id FROM public.person_connections
        WHERE (from_person_id = $1 OR to_person_id = $1)
          AND deleted_at IS NULL AND status <> 'declined'`,
      [me],
    );
    return r.rows.map((x) => x.connection_id);
  } finally {
    await reset();
  }
}

async function ask(from: keyof typeof U, toPerson: string, declaredName: string | null = null): Promise<string> {
  await asUser(U[from].uid);
  const r = await db.query<{ connection_id: string }>(
    `INSERT INTO public.person_connections (from_person_id, to_person_id, relation, layer, status, declared_name, created_by_user_id)
     VALUES ($1, $2, NULL, NULL, 'pending', $3, $4) RETURNING connection_id`,
    [U[from].person, toPerson, declaredName, U[from].uid],
  );
  await reset();
  return r.rows[0]!.connection_id;
}
async function accept(who: keyof typeof U, connectionId: string): Promise<void> {
  await asUser(U[who].uid);
  await db.query(
    `UPDATE public.person_connections SET status = 'confirmed', confirmed_at = now() WHERE connection_id = $1`,
    [connectionId],
  );
  await reset();
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  for (const k of Object.keys(U) as Array<keyof typeof U>) {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [`${k}@people-remove.test`],
    );
    const uid = r.rows[0]!.id;
    await db.query(`UPDATE public.people SET display_name = $2 WHERE claimed_by_user_id = $1`, [uid, k]);
    const p = await db.query<{ person_id: string }>(
      `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
      [uid],
    );
    U[k] = { uid, person: p.rows[0]!.person_id };
  }
  const h = await db.query<{ person_id: string }>(
    `INSERT INTO public.people (display_name) VALUES ('Lola Nena') RETURNING person_id`,
  );
  handAdded = h.rows[0]!.person_id;
});

after(async () => {
  await db.close();
});

// ── each kind of row the roster draws with ✕ ────────────────────────────────

test('a person with no account is never a connection row — they are a loved one, removed in Loved ones', async () => {
  // Owner 2026-08-21: "these people must have an account to be listed as people" — `kin_pilot_mutual_accounts`.
  // So "someone I added by hand" reaches ✕ only as an alaga (the Loved ones section's own Remove, below).
  await asUser(U.ice.uid);
  let refused: string | null = null;
  try {
    await db.query(
      `INSERT INTO public.person_connections (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
       VALUES ($1, $2, NULL, NULL, 'pending', $3)`,
      [U.ice.person, handAdded, U.ice.uid],
    );
  } catch (e) {
    refused = e instanceof Error ? e.message : String(e);
  } finally {
    await reset();
  }
  assert.match(refused ?? '', /both people must have an account/);
});

test('waiting for them (I asked) — Withdraw takes the request back', async () => {
  const c = await ask('ice', U.paolo.person);
  assert.equal(await removeAs('ice', c), 1);
  assert.ok(!(await onTheirPage('ice')).includes(c));
  assert.ok(!(await onTheirPage('paolo')).includes(c), 'a withdrawn request leaves their Requests too');
});

test('connected, and I asked — Remove ends it for both of us', async () => {
  const c = await ask('ice', U.ana.person);
  await accept('ana', c);
  assert.equal(await removeAs('ice', c), 1);
  assert.ok(!(await onTheirPage('ice')).includes(c));
  assert.ok(!(await onTheirPage('ana')).includes(c));
});

test('🔴 connected, and THEY asked (the owner’s Marco row) — Remove ends it for both of us', async () => {
  const c = await ask('marco', U.ice.person);
  await accept('ice', c);
  // What the action ran before 2026-10-23 — `from_person_id = me` — matched nobody, and said ok.
  await asUser(U.ice.uid);
  const old = await db.query(
    `UPDATE public.person_connections SET deleted_at = now()
      WHERE connection_id = $1 AND from_person_id = $2 AND deleted_at IS NULL RETURNING connection_id`,
    [c, U.ice.person],
  );
  await reset();
  assert.equal(old.rows.length, 0, 'the old filter is the bug: zero rows, no error');
  // What it runs now.
  assert.equal(await removeAs('ice', c), 1);
  assert.ok(!(await onTheirPage('ice')).includes(c));
  assert.ok(!(await onTheirPage('marco')).includes(c), 'an ended connection leaves the other side too');
});

test('🔴 asking me, still waiting — Remove changes nothing (Decline is the answer, and is kept)', async () => {
  const c = await ask('tita', U.ice.person);
  assert.equal(await removeAs('ice', c), 0, 'a request to me is declined, never quietly soft-deleted');
  await asUser(U.ice.uid);
  const d = await db.query(
    `UPDATE public.person_connections SET status = 'declined', declined_at = now()
      WHERE connection_id = $1 AND to_person_id = $2 AND status = 'pending' RETURNING connection_id`,
    [c, U.ice.person],
  );
  await reset();
  assert.equal(d.rows.length, 1);
});

test('🔴 nobody removes a connection they are not part of', async () => {
  const c = await ask('ana', U.paolo.person);
  await accept('paolo', c);
  assert.equal(await removeAs('stranger', c), 0);
  assert.ok((await onTheirPage('ana')).includes(c));
  assert.ok((await onTheirPage('paolo')).includes(c));
});

test('🔴 removing an already-removed connection changes zero rows — the action then says so', async () => {
  const c = await ask('ice', U.stranger.person);
  assert.equal(await removeAs('ice', c), 1);
  assert.equal(await removeAs('ice', c), 0);
});

// ── a loved one (alaga) — its own Remove, a real DELETE ─────────────────────

test('a loved one — the owner’s Remove deletes the record; another account’s deletes nothing', async () => {
  const r = await db.query<{ dependent_id: string }>(
    `INSERT INTO public.dependents (owner_user_id, name, relationship) VALUES ($1, 'Baby Cale', 'child') RETURNING dependent_id`,
    [U.ice.uid],
  );
  const d = r.rows[0]!.dependent_id;
  const del = async (who: keyof typeof U) => {
    try {
      await asUser(U[who].uid);
      // deleteDependent: `.delete().eq('dependent_id').eq('owner_user_id', me).select('dependent_id')`
      return (
        await db.query(
          `DELETE FROM public.dependents WHERE dependent_id = $1 AND owner_user_id = $2 RETURNING dependent_id`,
          [d, U[who].uid],
        )
      ).rows.length;
    } finally {
      await reset();
    }
  };
  assert.equal(await del('stranger'), 0, 'zero rows — the action now redirects with an error, not removed=1');
  assert.equal(await del('ice'), 1);
});

// ── the guest list is not the People page ──────────────────────────────────

test('🔴 removing someone from People leaves them on every event’s guest list', async () => {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Ice’s Birthday', 'birthday') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    U.ice.uid,
  ]);
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, person_id)
     VALUES ($1, 'Marco', 'Testing', 'both', 'friends', $2) RETURNING guest_id`,
    [eventId, U.marco.person],
  );
  const c = await ask('marco', U.ice.person);
  await accept('ice', c);
  assert.equal(await removeAs('ice', c), 1);
  const still = await db.query<{ person_id: string | null; deleted_at: string | null }>(
    `SELECT person_id, deleted_at FROM public.guests WHERE guest_id = $1`,
    [g.rows[0]!.guest_id],
  );
  assert.equal(still.rows.length, 1);
  assert.equal(still.rows[0]!.deleted_at, null);
  assert.equal(still.rows[0]!.person_id, U.marco.person);
});
