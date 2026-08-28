/**
 * CREW SHIFTS: POST → SEE → CLAIM, and nothing wider than that.
 *
 * ⚠ WHAT THIS FILE CANNOT PROVE, SAID FIRST. The PGlite replay builds from the
 * REPO's `CREATE TABLE`, which has ALWAYS declared `vendor_profile_id` nullable
 * — while PRODUCTION carried NOT NULL. So the drift this migration repairs is
 * INVISIBLE here: these tests would have passed before it too. The drift was
 * measured against production and the migration dry-run against production
 * inside `BEGIN…ROLLBACK`; the transcript is in the PR. What this file proves is
 * the POLICIES and the CLAIM, which the replay can genuinely exercise.
 *
 * 🔑 EVERY REFUSAL IS ASSERTED AS A VALUE, NEVER AS A THROW, where RLS is what
 * refuses — an RLS denial and an empty read are the same thing to a caller, so
 * `assert.rejects` would prove nothing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
before(async () => { replay = await createReplayedDb(); db = replay.db; });
after(async () => { await db?.close(); });

async function setAuthRole(role: string | null) {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string) {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`, [email]);
  return r.rows[0]!.id;
}

type World = {
  host: string; shopOwner: string; rivalOwner: string;
  shop: string; rival: string; eventId: string;
};

/** A host, a shop BOOKED on their celebration, and a rival shop that is not. */
async function seed(tag: string): Promise<World> {
  await reset();
  const host = await createUser(`gig-host-${tag}@example.com`);
  const shopOwner = await createUser(`gig-shop-${tag}@example.com`);
  const rivalOwner = await createUser(`gig-rival-${tag}@example.com`);

  const mk = async (uid: string, name: string) => {
    const vp = (await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,$2,'Manila',ARRAY['photography']::text[],'verified',NOW())
       RETURNING vendor_profile_id`, [uid, name])).rows[0]!.vendor_profile_id;
    // The founding admin seat /open-shop creates. `current_vendor_profile_ids()`
    // covers a legacy owner without one, but the claim RPC should work for a
    // shop that looks exactly like a real registration.
    await db.query(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
       VALUES ($1,$2,'admin') ON CONFLICT DO NOTHING`, [vp, uid]);
    return vp;
  };
  const shop = await mk(shopOwner, `Crew Co ${tag}`);
  const rival = await mk(rivalOwner, `Rival Crew ${tag}`);

  const eventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Gig Test Day','birthday') RETURNING event_id`)).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, host]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'photographer','Crew Co','contracted',$2)`, [eventId, shop]);

  return { host, shopOwner, rivalOwner, shop, rival, eventId };
}

async function countGigs(): Promise<number> {
  await reset();
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.manpower_gigs`))
    .rows[0]!.n;
}

/** Post through a real session. Returns how many rows LANDED (never RETURNING —
 *  an INSERT … RETURNING needs the SELECT policy too, and that would make a
 *  permitted insert read as a refusal). */
async function tryPost(
  w: World, as: string,
  over: Partial<{ eventId: string; postedBy: string; vendorProfileId: string | null; status: string }> = {},
): Promise<number> {
  const before = await countGigs();
  await asUser(as);
  try {
    await db.query(
      `INSERT INTO public.manpower_gigs
         (event_id, posted_by_user_id, gig_label, cash_amount_php_centavos, vendor_profile_id, status)
       VALUES ($1,$2,'Second shooter',1500000,$3,$4)`,
      [over.eventId ?? w.eventId, over.postedBy ?? as,
       over.vendorProfileId ?? null, over.status ?? 'pending']);
  } catch { /* an RLS refusal raises 42501; the count below answers either way */ }
  finally { await reset(); }
  return (await countGigs()) - before;
}

// ── 1 · THE HOST CAN POST AN OPEN SHIFT ───────────────────────────────────

test('a host posts an open shift on their own celebration', async () => {
  const w = await seed('post');
  assert.equal(await tryPost(w, w.host), 1);
});

test('a stranger cannot post one on somebody else’s celebration', async () => {
  const w = await seed('post-stranger');
  assert.equal(await tryPost(w, w.shopOwner), 0);
});

test('a host cannot post a shift PRE-ASSIGNED to a shop that never agreed', async () => {
  // Without the `vendor_profile_id IS NULL` clause a host could hand a shop
  // work — and a payment record — it never accepted.
  const w = await seed('post-preassigned');
  assert.equal(await tryPost(w, w.host, { vendorProfileId: w.shop }), 0);
});

test('a host cannot sign a shift in somebody else’s name', async () => {
  const w = await seed('post-forge');
  assert.equal(await tryPost(w, w.host, { postedBy: w.shopOwner }), 0);
});

test('a host cannot post one that is already accepted', async () => {
  const w = await seed('post-status');
  assert.equal(await tryPost(w, w.host, { status: 'accepted' }), 0);
});

// ── 2 · A BOOKED SHOP CAN SEE IT — AND ONLY IT ────────────────────────────

async function openGig(w: World): Promise<string> {
  await reset();
  return (await db.query<{ gig_id: string }>(
    `INSERT INTO public.manpower_gigs
       (event_id, posted_by_user_id, gig_label, cash_amount_php_centavos)
     VALUES ($1,$2,'Second shooter',1500000) RETURNING gig_id`,
    [w.eventId, w.host])).rows[0]!.gig_id;
}

async function visibleTo(uid: string): Promise<number> {
  await asUser(uid);
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.manpower_gigs`);
  await reset();
  return r.rows[0]!.n;
}

test('the booked shop sees the open shift; a shop that is not booked does not', async () => {
  const w = await seed('see');
  await openGig(w);
  assert.equal(await visibleTo(w.shopOwner), 1, 'the booked shop cannot see claimable work');
  assert.equal(await visibleTo(w.rivalOwner), 0, 'a shop that was never booked can see it');
});

test('once claimed, the shift leaves every other shop’s view', async () => {
  // A shop sees work it can TAKE, never a record of what a rival was paid.
  const w = await seed('see-claimed');
  const gig = await openGig(w);
  await setAuthUid(db, w.shopOwner);
  await db.query(`SELECT public.claim_manpower_gig($1)`, [gig]);
  await setAuthUid(db, null);
  assert.equal(await visibleTo(w.rivalOwner), 0);
  assert.equal(await visibleTo(w.shopOwner), 1, 'the claimer keeps it via the owner policy');
});

// ── 3 · AND CAN CLAIM IT ──────────────────────────────────────────────────

async function claim(gig: string, as: string | null) {
  await setAuthUid(db, as);
  const r = await db.query<{ out: { ok: boolean; reason?: string } }>(
    `SELECT public.claim_manpower_gig($1) AS out`, [gig]);
  await setAuthUid(db, null);
  return r.rows[0]!.out;
}

test('the booked shop claims it, once', async () => {
  const w = await seed('claim');
  const gig = await openGig(w);
  const first = await claim(gig, w.shopOwner);
  assert.equal(first.ok, true);
  assert.equal(first.reason, 'claimed');

  await reset();
  const row = await db.query<{ status: string; vendor_profile_id: string | null }>(
    `SELECT status, vendor_profile_id FROM public.manpower_gigs WHERE gig_id=$1`, [gig]);
  assert.equal(row.rows[0]!.status, 'accepted');
  assert.equal(row.rows[0]!.vendor_profile_id, w.shop);

  const again = await claim(gig, w.shopOwner);
  assert.equal(again.ok, true);
  assert.equal(again.reason, 'already_yours', 'a re-claim by the holder is not an error');
});

test('a shop that is not booked on the celebration cannot claim it', async () => {
  const w = await seed('claim-rival');
  const gig = await openGig(w);
  const out = await claim(gig, w.rivalOwner);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'not_booked_here');

  await reset();
  const row = await db.query<{ vendor_profile_id: string | null }>(
    `SELECT vendor_profile_id FROM public.manpower_gigs WHERE gig_id=$1`, [gig]);
  assert.equal(row.rows[0]!.vendor_profile_id, null, 'a rival took work that was not theirs');
});

test('a LOST RACE never names the rival that won', async () => {
  const w = await seed('claim-race');
  // Book the rival too, so both are eligible and only the race separates them.
  await reset();
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'videographer','Rival Crew','contracted',$2)`, [w.eventId, w.rival]);
  const gig = await openGig(w);

  assert.equal((await claim(gig, w.shopOwner)).ok, true);
  const loser = await claim(gig, w.rivalOwner);
  assert.equal(loser.ok, false);
  assert.equal(loser.reason, 'already_claimed');
  assert.ok(
    !JSON.stringify(loser).includes(w.shop),
    'the losing shop was told WHICH rival holds the shift',
  );
});

test('WITH NO SESSION THE CLAIM REFUSES — the service-role trap, asserted', async () => {
  const w = await seed('claim-nosession');
  const gig = await openGig(w);
  const out = await claim(gig, null);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'not_booked_here');
});

test('claiming a shift that does not exist says so', async () => {
  const w = await seed('claim-missing');
  await setAuthUid(db, w.shopOwner);
  const r = await db.query<{ out: { ok: boolean; reason?: string } }>(
    `SELECT public.claim_manpower_gig('00000000-0000-0000-0000-000000000000'::uuid) AS out`);
  await setAuthUid(db, null);
  assert.equal(r.rows[0]!.out.ok, false);
  assert.equal(r.rows[0]!.out.reason, 'not_found');
});

// ── 4 · AND NOTHING WIDER ─────────────────────────────────────────────────

test('there is still NO update policy — the claim is the only writer', async () => {
  // 🔒 `authenticated` holds UPDATE on every column, so any UPDATE policy wide
  // enough to permit a claim is wide enough to let a shop rewrite what it is
  // about to be paid.
  await reset();
  const r = await db.query<{ cmd: string }>(
    `SELECT cmd FROM pg_policies WHERE schemaname='public' AND tablename='manpower_gigs'`);
  const cmds = r.rows.map((x) => x.cmd);
  assert.ok(!cmds.includes('UPDATE'), 'an UPDATE policy appeared on manpower_gigs');
  assert.ok(!cmds.includes('DELETE'), 'a DELETE policy appeared on manpower_gigs');
});

test('a shop cannot rewrite what it is about to be paid', async () => {
  const w = await seed('no-price-edit');
  const gig = await openGig(w);
  await claim(gig, w.shopOwner);

  await asUser(w.shopOwner);
  try {
    await db.query(
      `UPDATE public.manpower_gigs SET cash_amount_php_centavos = 9900000 WHERE gig_id=$1`, [gig]);
  } catch { /* refused either way — the value below is the assertion */ }
  await reset();
  const row = await db.query<{ amt: string }>(
    `SELECT cash_amount_php_centavos::text AS amt FROM public.manpower_gigs WHERE gig_id=$1`, [gig]);
  assert.equal(row.rows[0]!.amt, '1500000', 'the claiming shop edited its own fee');
});

test('anon reaches crew shifts by no route at all', async () => {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT (SELECT count(*) FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='manpower_gigs' AND grantee='anon')
          + (SELECT count(*) FROM pg_policies WHERE schemaname='public'
              AND tablename='manpower_gigs' AND ('anon' = ANY(roles) OR 'public' = ANY(roles)))
          AS n`);
  assert.equal(r.rows[0]!.n, 0, 'anon can reach manpower_gigs');
});
