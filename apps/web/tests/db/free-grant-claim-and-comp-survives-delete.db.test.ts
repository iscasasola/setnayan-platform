/**
 * The two defects a post-merge audit found in the work of 2026-09-05, proven
 * shut against the real replayed schema.
 *
 * ① THE FREE GRANT WAS RESETTABLE BY THE CUSTOMER. "First event ever" was
 *   resolved from `event_members`, and `couple_can_delete_member` is
 *   `FOR DELETE TO authenticated` — so a signed-in couple could delete their own
 *   membership row with one PostgREST call and the history the rule reads simply
 *   vanished. Next event: another full 50. Repeatable, and strictly profitable,
 *   because the credits already granted to the older event stay on it.
 *
 * ② A DELETED EVENT DESTROYED THE COMP RECORD. `comp_grants.event_id` was
 *   `ON DELETE CASCADE`; a comp writes no order, payment or receipt, so
 *   `deleteEvent`'s money gate does not block on one. The couple removed the
 *   celebration and the grant — retail value, rationale, who granted it — went
 *   with it. And the obvious fix is a SECOND bug: a NULL `event_id` means
 *   "every event this user hosts", so plain SET NULL would silently PROMOTE a
 *   one-event comp into an account-wide one.
 *
 * 🔑 WHY THESE ARE DB TESTS. Both defects live entirely in SQL — an RLS policy's
 * reach, a foreign key's ON DELETE action, and a trigger's ordering. No
 * TypeScript test can see any of it, and the app-layer unit tests passed
 * throughout the day both defects were live.
 *
 * Run: cd apps/web && npx tsx --test tests/db/free-grant-claim-and-comp-survives-delete.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let seq = 0;
async function newUser(): Promise<string> {
  seq += 1;
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`claim-${seq}@test.local`],
  );
  return r.rows[0]!.id;
}

/** event_type deliberately not 'wedding' — that CHECK wants ceremony fields. */
async function hostedEvent(userId: string, name: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, userId],
  );
  return eventId;
}

const freeGrantPoints = async (eventId: string): Promise<number | null> => {
  const r = await db.query<{ points: number }>(
    `SELECT points FROM public.papic_event_point_grants
      WHERE event_id = $1 AND source = 'free_grant'`,
    [eventId],
  );
  return r.rows[0]?.points ?? null;
};

// ══ ① the reset loophole ═══════════════════════════════════════════════════

test('🚨 THE LOOPHOLE: deleting your own couple row no longer re-earns the 50', async () => {
  const u = await newUser();
  const e1 = await hostedEvent(u, 'first event');
  assert.equal(await freeGrantPoints(e1), 50, 'PRECONDITION: the first event earns the full grant');

  // The attack, exactly as a customer could run it against PostgREST with the
  // public anon key and their own JWT: DELETE their own membership row.
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [e1, u]);
  const left = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_members WHERE user_id = $1 AND member_type = 'couple'`,
    [u],
  );
  assert.equal(left.rows[0]!.n, 0, 'PRECONDITION: the row the OLD rule read is now gone');

  const e2 = await hostedEvent(u, 'second event, after the reset attempt');
  assert.equal(
    await freeGrantPoints(e2),
    1,
    'the account already claimed its free pool — deleting the membership must not give it back',
  );
  assert.equal(await freeGrantPoints(e1), 50, 'and the first event keeps what it was already granted');
});

test('the claim is one per account, and it is not reachable from a browser role', async () => {
  const u = await newUser();
  await hostedEvent(u, 'claims once');
  await hostedEvent(u, 'and not twice');
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_free_grant_claims WHERE user_id = $1`,
    [u],
  );
  assert.equal(c.rows[0]!.n, 1, 'exactly one claim row per account, ever');

  for (const role of ['anon', 'authenticated']) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege($1, 'public.papic_free_grant_claims', $2) AS ok`,
        [role, priv],
      );
      assert.equal(
        r.rows[0]!.ok,
        false,
        `${role} holds ${priv} on papic_free_grant_claims — the row the rule reads must be out of a customer's reach, which is the whole defect`,
      );
    }
  }
});

test('a different account is unaffected — the claim is per user, not global', async () => {
  const a = await newUser();
  const b = await newUser();
  assert.equal(await freeGrantPoints(await hostedEvent(a, 'A first')), 50);
  assert.equal(await freeGrantPoints(await hostedEvent(b, 'B first')), 50, 'B has claimed nothing yet');
  assert.equal(await freeGrantPoints(await hostedEvent(b, 'B second')), 1);
});

test('a non-couple join still seeds nothing, and claims nothing', async () => {
  const u = await newUser();
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('vendor joins', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'vendor')`,
    [eventId, u],
  );
  assert.equal(await freeGrantPoints(eventId), null, 'a vendor join must not arm the pool');
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_free_grant_claims WHERE user_id = $1`,
    [u],
  );
  assert.equal(c.rows[0]!.n, 0, 'and must not burn the account’s one claim');
});

test('the self-heal path (no user supplied) resolves the couple itself', async () => {
  const u = await newUser();
  const e1 = await hostedEvent(u, 'claimed already');
  assert.equal(await freeGrantPoints(e1), 50);

  // An event whose free grant was never armed, then the studio self-heal fires
  // with no user id — the SQL must find the couple rather than defaulting to
  // the full allowance (the old TS path defaulted generous, which costs money).
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('self-heal', 'birthday') RETURNING event_id`,
  );
  const e2 = ev.rows[0]!.event_id;
  await db.query(`ALTER TABLE public.event_members DISABLE TRIGGER papic_seed_free_grant_trg`);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [e2, u],
  );
  await db.query(`ALTER TABLE public.event_members ENABLE TRIGGER papic_seed_free_grant_trg`);
  assert.equal(await freeGrantPoints(e2), null, 'PRECONDITION: this event is unarmed');

  await db.query(`SELECT public.papic_claim_free_pool($1, NULL)`, [e2]);
  assert.equal(
    await freeGrantPoints(e2),
    1,
    'the couple was resolved and had already claimed — the minimum, not another 50',
  );
});

// ══ ② the comp record outlives its event, conferring nothing ════════════════

test('🚨 deleting an event REVOKES its scoped comp — it does not destroy it, and does not widen it', async () => {
  const u = await newUser();
  const wedding = await hostedEvent(u, 'the comped celebration');
  const debut = await hostedEvent(u, 'a different celebration, same account');

  await db.query(
    `INSERT INTO public.comp_grants (user_id, event_id, source, scope, scoped_skus, rationale, retail_value_centavos)
     VALUES ($1, $2, 'external_promo', 'specific_skus', ARRAY['PAPIC_ONE_50'],
             'remediation for the double charge — twenty chars', 499900)`,
    [u, wedding],
  );
  assert.equal(
    (await db.query<{ ok: boolean }>(`SELECT public.event_has_comp_for_sku($1,'PAPIC_ONE_50') AS ok`, [wedding])).rows[0]!.ok,
    true,
    'PRECONDITION: the comp covers the event it was scoped to',
  );
  assert.equal(
    (await db.query<{ ok: boolean }>(`SELECT public.event_has_comp_for_sku($1,'PAPIC_ONE_50') AS ok`, [debut])).rows[0]!.ok,
    false,
    'PRECONDITION: and not the other one',
  );

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [wedding]);

  const row = await db.query<{
    n: number; revoked_at: string | null; snapshot: string | null; value: number | null; rationale: string | null;
  }>(
    `SELECT count(*)::int AS n, max(revoked_at::text) AS revoked_at,
            max(scoped_event_id_snapshot::text) AS snapshot,
            max(retail_value_centavos) AS value, max(rationale) AS rationale
       FROM public.comp_grants WHERE user_id = $1`,
    [u],
  );
  assert.equal(row.rows[0]!.n, 1, 'THE DEFECT: the grant row must survive its event, not CASCADE away');
  assert.ok(row.rows[0]!.revoked_at, 'and it must be revoked — a grant whose event is gone confers nothing');
  assert.equal(row.rows[0]!.snapshot, wedding, 'the event it was scoped to is still on the record');
  assert.equal(row.rows[0]!.value, 499900, 'the money figure survives for the audit trail');
  assert.match(String(row.rows[0]!.rationale), /double charge/, 'and so does why it was given');

  assert.equal(
    (await db.query<{ ok: boolean }>(`SELECT public.event_has_comp_for_sku($1,'PAPIC_ONE_50') AS ok`, [debut])).rows[0]!.ok,
    false,
    'THE SECOND BUG: a NULL event_id means "every event", so the revoke is what stops a deleted event WIDENING the comp',
  );
});

test('an account-wide comp is untouched when one of the account’s events is deleted', async () => {
  const u = await newUser();
  const keep = await hostedEvent(u, 'kept');
  const drop = await hostedEvent(u, 'dropped');
  await db.query(
    `INSERT INTO public.comp_grants (user_id, event_id, source, scope, scoped_skus, rationale)
     VALUES ($1, NULL, 'external_promo', 'specific_skus', ARRAY['SEATING_3D'],
             'account-wide goodwill, twenty characters')`,
    [u],
  );
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [drop]);
  assert.equal(
    (await db.query<{ ok: boolean }>(`SELECT public.event_has_comp_for_sku($1,'SEATING_3D') AS ok`, [keep])).rows[0]!.ok,
    true,
    'a grant that was never event-scoped must not be collateral damage of another event’s deletion',
  );
});
