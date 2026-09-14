/**
 * A DAY-OF GRANT CANNOT BE MOVED — measured as a REAL `authenticated` session
 * (SET ROLE + JWT claims), never the replay's superuser.
 *
 * SUP-1 / ROOM-12. `vendor_event_access_grants` fenced its INSERT on BOTH the
 * shop and the booking, and re-checked only the shop on UPDATE:
 *
 *   manage_insert  WITH CHECK  vendor_profile_id IN current_vendor_ids('admin')
 *                          AND event_id IN current_vendor_booked_event_ids()
 *   manage_update  USING/CHECK vendor_profile_id IN current_vendor_ids('admin')
 *
 * `authenticated` holds UPDATE on `event_id` and the table had no trigger, so a
 * shop admin could insert a legitimate grant on a celebration they ARE booked on
 * and then repoint that row at one they never were. `vendor_profile_id` does not
 * move, so both halves of the UPDATE policy pass.
 *
 * 🔑 RLS IS ROW-LEVEL, NEVER VALUE-LEVEL — and WITH CHECK cannot see OLD, so it
 * can never say "the event this grant has always named". The refusal is a BEFORE
 * UPDATE trigger (20271228546306) that RAISES, not a predicate that quietly
 * matches nothing: a zero-row UPDATE raises nothing, and "refused" would then be
 * indistinguishable from "already done".
 *
 * WHAT MAKES THIS A DATABASE TEST AND NOT AN APP ONE: no server action is
 * imported or called. Every probe is `SET ROLE authenticated` with the shop
 * admin's own uid in `request.jwt.claim.sub`, issuing raw SQL — the boundary is
 * the one Postgres enforces, not the one `actions.ts` chooses to call.
 *
 * ⚠ THE REFUSALS RUN OUTSIDE A TRANSACTION ON PURPOSE. If the probe were wrapped
 * in a rolled-back BEGIN, "the row did not move" would be true of the rollback
 * rather than of the guard. These commit or they raise, and the row is then read
 * back fresh as the superuser.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  shopAdmin: '',
  grantee: '',
  ownerUser: '',
  vendorId: '',
  bookedEvent: '',
  strangerEvent: '',
  grantId: '',
};

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}

/**
 * A real browser session for `uid`. NO surrounding transaction: whatever lands,
 * lands, so the snapshot afterwards is a measurement and not an artefact of a
 * rollback.
 */
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T | { err: string }> {
  try {
    await setAuthUid(db, uid);
    await setRole('authenticated');
    await db.exec('SET ROLE authenticated');
    return await fn();
  } catch (e) {
    return { err: (e as Error).message };
  } finally {
    await reset();
  }
}

/** Same session, but inside a transaction that is always rolled back, and with
 *  owner-level `extraSql` run first — for the neutralising control. */
async function asUserInRolledBackTxn<T>(uid: string, extraSql: string, fn: () => Promise<T>): Promise<T | { err: string }> {
  await db.exec('BEGIN');
  try {
    if (extraSql) await db.exec(extraSql);
    await setAuthUid(db, uid);
    await setRole('authenticated');
    await db.exec('SET ROLE authenticated');
    return await fn();
  } catch (e) {
    return { err: (e as Error).message };
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}

async function mkUser(email: string, accountType: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

/** Read the grant's target as the SUPERUSER — no RLS, no role, no transaction. */
async function targetOf(grantId: string): Promise<{ event_id: string; vendor_profile_id: string; grantee_user_id: string }> {
  const r = await db.query<{ event_id: string; vendor_profile_id: string; grantee_user_id: string }>(
    `SELECT event_id, vendor_profile_id, grantee_user_id
       FROM public.vendor_event_access_grants WHERE grant_id = $1`,
    [grantId],
  );
  assert.equal(r.rows.length, 1, 'the seeded grant vanished');
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  F.ownerUser = await mkUser('grant-owner@dayof.test', 'vendor');
  F.shopAdmin = await mkUser('grant-admin@dayof.test', 'vendor');
  F.grantee = await mkUser('grant-crew@dayof.test', 'vendor');

  F.vendorId = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Day Of Sound')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
       RETURNING vendor_profile_id AS v`,
      [F.ownerUser],
    )
  ).rows[0]!.v;
  // A booked card needs a verified shop (enforce_booking_requires_verified_vendor).
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state,
            last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility
      WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin')`,
    [F.vendorId, F.shopAdmin],
  );

  // The celebration this shop IS booked on…
  F.bookedEvent = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('Our own booking', 'birthday') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'misc', 'Day Of Sound', 'contracted', $2)`,
    [F.bookedEvent, F.vendorId],
  );

  // …and a stranger's, which this shop has never been anywhere near.
  F.strangerEvent = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('Somebody else''s day', 'birthday') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('META: the probing role is authenticated — not the table owner, no BYPASSRLS', async () => {
  const r = await asUser(F.shopAdmin, () =>
    db.query<{ me: string; owner: string; bypass: boolean; sup: boolean; uid: string }>(
      `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS sup,
              auth.uid()::text AS uid
         FROM pg_class c WHERE c.oid = 'public.vendor_event_access_grants'::regclass`,
    ),
  );
  assert.ok(!('err' in r), JSON.stringify(r));
  const row = r.rows[0]!;
  assert.equal(row.me, 'authenticated');
  assert.notEqual(row.owner, 'authenticated');
  assert.equal(row.bypass, false);
  assert.equal(row.sup, false);
  assert.equal(row.uid, F.shopAdmin, 'the session is not actually the shop admin');
});

test('POSITIVE CONTROL: the shop admin may issue a grant on the event it IS booked on', async () => {
  const r = await asUser(F.shopAdmin, () =>
    db.query<{ g: string }>(
      `INSERT INTO public.vendor_event_access_grants (vendor_profile_id, event_id, grantee_user_id, granted_by)
       VALUES ($1, $2, $3, $4) RETURNING grant_id AS g`,
      [F.vendorId, F.bookedEvent, F.grantee, F.shopAdmin],
    ),
  );
  assert.ok(!('err' in r), `the INSERT fence rejected a legitimate grant: ${JSON.stringify(r)}`);
  F.grantId = r.rows[0]!.g;
  assert.equal((await targetOf(F.grantId)).event_id, F.bookedEvent);
});

test('POSITIVE CONTROL: and it may NOT issue one on the stranger’s day — the INSERT fence is real', async () => {
  const r = await asUser(F.shopAdmin, () =>
    db.query(
      `INSERT INTO public.vendor_event_access_grants (vendor_profile_id, event_id, grantee_user_id, granted_by)
       VALUES ($1, $2, $3, $4)`,
      [F.vendorId, F.strangerEvent, F.grantee, F.shopAdmin],
    ),
  );
  assert.ok('err' in r, 'a shop issued a day-of grant on a celebration it was never booked on');
  assert.match(r.err, /row-level security/);
});

test('REACHABILITY: with the trigger disabled, the SAME session repoints the grant — so RLS alone does NOT refuse it', async () => {
  const r = await asUserInRolledBackTxn(
    F.shopAdmin,
    `ALTER TABLE public.vendor_event_access_grants DISABLE TRIGGER vendor_event_access_grants_target_immutable`,
    async () => {
      const upd = await db.query(
        `UPDATE public.vendor_event_access_grants SET event_id = $2 WHERE grant_id = $1`,
        [F.grantId, F.strangerEvent],
      );
      const seen = await db.query<{ e: string }>(
        `SELECT event_id AS e FROM public.vendor_event_access_grants WHERE grant_id = $1`,
        [F.grantId],
      );
      return { affected: upd.affectedRows ?? 0, landedOn: seen.rows[0]?.e ?? null };
    },
  );
  assert.ok(!('err' in r), `the control could not run: ${JSON.stringify(r)}`);
  assert.equal(
    r.affected,
    1,
    'the UPDATE matched zero rows even with the trigger off — the fixture never reproduced the finding, so the refusal below proves nothing',
  );
  assert.equal(
    r.landedOn,
    F.strangerEvent,
    `shop admin ${F.shopAdmin} repointed grant ${F.grantId} onto stranger event ${F.strangerEvent} through RLS alone`,
  );
  // Rolled back — the trigger and the row are both back.
  assert.equal((await targetOf(F.grantId)).event_id, F.bookedEvent);
});

test('THE ROW: the shop admin cannot repoint the grant at a celebration it was never booked on', async () => {
  const before_ = await targetOf(F.grantId);
  assert.equal(before_.event_id, F.bookedEvent, 'precondition: the grant still names the booked event');

  const r = await asUser(F.shopAdmin, () =>
    db.query(`UPDATE public.vendor_event_access_grants SET event_id = $2 WHERE grant_id = $1`, [
      F.grantId,
      F.strangerEvent,
    ]),
  );

  assert.ok(
    'err' in r,
    `shop admin ${F.shopAdmin} moved grant ${F.grantId} from ${F.bookedEvent} to stranger event ${F.strangerEvent} and the database allowed it`,
  );
  assert.match(
    r.err,
    /DAYOF_GRANT_TARGET_IMMUTABLE/,
    `the write was refused, but not by the guard — by "${r.err}". A refusal nobody can name is a refusal nobody can trust.`,
  );

  const after_ = await targetOf(F.grantId);
  assert.equal(
    after_.event_id,
    F.bookedEvent,
    `grant ${F.grantId} MOVED to ${after_.event_id}: the statement raised and the row changed anyway`,
  );
});

test('…and it cannot hand the grant to a different account, or to a different shop, either', async () => {
  const other = await mkUser('grant-outsider@dayof.test', 'vendor');
  const moveGrantee = await asUser(F.shopAdmin, () =>
    db.query(`UPDATE public.vendor_event_access_grants SET grantee_user_id = $2 WHERE grant_id = $1`, [F.grantId, other]),
  );
  assert.ok('err' in moveGrantee, `grant ${F.grantId} was handed to account ${other}`);
  assert.match(moveGrantee.err, /DAYOF_GRANT_TARGET_IMMUTABLE/);

  const moveShop = await asUser(F.shopAdmin, () =>
    db.query(`UPDATE public.vendor_event_access_grants SET vendor_profile_id = gen_random_uuid() WHERE grant_id = $1`, [
      F.grantId,
    ]),
  );
  assert.ok('err' in moveShop, `grant ${F.grantId} was moved to another shop`);

  const t = await targetOf(F.grantId);
  assert.deepEqual(
    { e: t.event_id, v: t.vendor_profile_id, g: t.grantee_user_id },
    { e: F.bookedEvent, v: F.vendorId, g: F.grantee },
    'one of the three identity columns moved',
  );
});

test('WHAT THE MOVE WOULD HAVE BOUGHT: the grant is what current_vendor_dayof_grant_event_ids() returns', async () => {
  const r = await asUser(F.grantee, () =>
    db.query<{ e: string }>(`SELECT public.current_vendor_dayof_grant_event_ids() AS e`),
  );
  assert.ok(!('err' in r), JSON.stringify(r));
  const seen = r.rows.map((x) => x.e);
  assert.deepEqual(seen, [F.bookedEvent], 'the grantee resolves exactly the booked event');
  assert.ok(
    !seen.includes(F.strangerEvent),
    `the grantee can reach stranger event ${F.strangerEvent} — which is FOR ALL on vendor_event_sets and vendor_event_set_songs, plus the song desk`,
  );
});

test('THE ONLY LEGITIMATE UPDATE still works: the soft revoke, and the launcher’s upsert', async () => {
  const revoke = await asUser(F.shopAdmin, () =>
    db.query(`UPDATE public.vendor_event_access_grants SET revoked_at = NOW() WHERE grant_id = $1`, [F.grantId]),
  );
  assert.ok(!('err' in revoke), `the guard broke the revoke: ${JSON.stringify(revoke)}`);
  assert.equal(revoke.affectedRows, 1, 'the revoke matched no rows');

  const revoked = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_event_access_grants WHERE grant_id = $1 AND revoked_at IS NOT NULL`,
    [F.grantId],
  );
  assert.equal(revoked.rows[0]!.n, 1, 'revoked_at did not land');

  // The launcher re-grants with an upsert that RE-STATES the identity triple on
  // conflict. It must land on the IS-NOT-DISTINCT-FROM branch, not the refusal.
  const regrant = await asUser(F.shopAdmin, () =>
    db.query(
      `INSERT INTO public.vendor_event_access_grants (vendor_profile_id, event_id, grantee_user_id, granted_by, revoked_at)
       VALUES ($1, $2, $3, $4, NULL)
       ON CONFLICT (vendor_profile_id, event_id, grantee_user_id)
       DO UPDATE SET granted_by = EXCLUDED.granted_by, revoked_at = NULL,
                     vendor_profile_id = EXCLUDED.vendor_profile_id,
                     event_id = EXCLUDED.event_id,
                     grantee_user_id = EXCLUDED.grantee_user_id`,
      [F.vendorId, F.bookedEvent, F.grantee, F.shopAdmin],
    ),
  );
  assert.ok(!('err' in regrant), `the guard broke the launcher's re-grant upsert: ${JSON.stringify(regrant)}`);
  const live = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_event_access_grants WHERE grant_id = $1 AND revoked_at IS NULL`,
    [F.grantId],
  );
  assert.equal(live.rows[0]!.n, 1, 'the re-grant did not un-revoke the existing row');
});

test('ERASURE STAYS OPEN: nulling granted_by (RA 10173) is not a retarget', async () => {
  const r = await db.query(
    `UPDATE public.vendor_event_access_grants SET granted_by = NULL WHERE grant_id = $1`,
    [F.grantId],
  );
  assert.equal(r.affectedRows, 1, 'lib/erasure/coverage.ts nulls this column — the guard must not refuse it');
});

test('THE SHAPE THAT KEEPS IT SHUT: the trigger is armed on all three identity columns', async () => {
  const r = await db.query<{ armed: string[]; enabled: string }>(
    `SELECT array_agg(a.attname ORDER BY a.attname) AS armed, max(t.tgenabled::text) AS enabled
       FROM pg_trigger t
       JOIN unnest(t.tgattr::smallint[]) AS col(attnum) ON TRUE
       JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = col.attnum
      WHERE t.tgrelid = 'public.vendor_event_access_grants'::regclass
        AND t.tgname = 'vendor_event_access_grants_target_immutable'`,
  );
  const row = r.rows[0]!;
  assert.deepEqual(
    row.armed,
    ['event_id', 'grant_id', 'grantee_user_id', 'vendor_profile_id'],
    'the trigger stopped covering one of the identity columns',
  );
  assert.equal(row.enabled, 'O', 'the trigger is not enabled');
});
