/**
 * A SHOP KEEPS THE RECORD OF MONEY IT ASKED FOR, EVEN AFTER THE COUPLE REMOVES
 * THE CELEBRATION — and can still READ it.
 *
 * ⚖ The owner's 2026-08-21 rule: on a SHARED record the vendor keeps it, and
 * *the test is whether the supplier took part in it*. A shop WROTE the ask.
 *
 * 🔑 MEASURED BY DELETING, NEVER BY READING THE CONSTRAINT CATALOGUE. Six
 * `BEFORE DELETE` triggers rewrite the outcome on this event tree before any
 * `ON DELETE` rule fires, so counting FK clauses both over- and under-states
 * survival. Every test below deletes a seeded celebration and looks at what is
 * left.
 *
 * 🔑 AND SURVIVING IS ONLY HALF. A preserved row whose READERS cannot tolerate
 * a NULL event is kept and invisible — worse than deleted, because it looks
 * handled. The read is asserted from the shop's own session, after the delete.
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
  shop: string; eventId: string; eventVendorId: string; askId: string;
};

async function seed(tag: string): Promise<World> {
  await reset();
  const host = await createUser(`ask-host-${tag}@example.com`);
  const shopOwner = await createUser(`ask-shop-${tag}@example.com`);
  const rivalOwner = await createUser(`ask-rival-${tag}@example.com`);

  const mk = async (uid: string, name: string) => {
    const vp = (await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,$2,'Manila',ARRAY['photography']::text[],'verified',NOW())
       RETURNING vendor_profile_id`, [uid, name])).rows[0]!.vendor_profile_id;
    await db.query(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
       VALUES ($1,$2,'admin') ON CONFLICT DO NOTHING`, [vp, uid]);
    return vp;
  };
  const shop = await mk(shopOwner, `Ask Co ${tag}`);
  await mk(rivalOwner, `Rival Co ${tag}`);

  const eventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Ask Outlives Day','birthday') RETURNING event_id`)).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, host]);
  const eventVendorId = (await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'photographer','Ask Co','contracted',$2) RETURNING vendor_id`,
    [eventId, shop])).rows[0]!.vendor_id;
  const askId = (await db.query<{ ask_id: string }>(
    `INSERT INTO public.vendor_payment_asks
       (event_vendor_id, event_id, vendor_profile_id, amount_php, note)
     VALUES ($1,$2,$3,18000,'second installment') RETURNING ask_id`,
    [eventVendorId, eventId, shop])).rows[0]!.ask_id;

  return { host, shopOwner, rivalOwner, shop, eventId, eventVendorId, askId };
}

async function deleteCelebration(eventId: string) {
  await reset();
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);
}

// ── 1 · IT SURVIVES ───────────────────────────────────────────────────────

test('the ask outlives the celebration, with its amount', async () => {
  const w = await seed('survives');
  await deleteCelebration(w.eventId);
  const r = await db.query<{ n: number; amt: string | null; ev: string | null }>(
    `SELECT count(*)::int AS n,
            max(amount_php::text) AS amt,
            max(event_id::text)   AS ev
       FROM public.vendor_payment_asks WHERE ask_id = $1`, [w.askId]);
  assert.equal(r.rows[0]!.n, 1, 'the shop lost the record of what it asked to be paid');
  assert.equal(r.rows[0]!.amt, '18000.00', 'the amount did not survive');
  assert.equal(r.rows[0]!.ev, null, 'the event link should be RELEASED, not kept dangling');
});

test('the booking it belongs to survives too — they are kept together', async () => {
  const w = await seed('with-booking');
  await deleteCelebration(w.eventId);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors WHERE vendor_id = $1`,
    [w.eventVendorId]);
  assert.equal(r.rows[0]!.n, 1, 'the booking vanished — the ask would be an orphan of an orphan');
});

// ── 2 · AND THE SHOP CAN STILL READ IT ────────────────────────────────────

test('the shop can still read its own orphaned ask', async () => {
  // 🔑 THE HALF THAT MAKES SURVIVAL WORTH ANYTHING. The read is gated on
  // `event_id IN current_vendor_booked_event_ids()`, which a NULL event can
  // never satisfy — without the orphan arm the row is kept and invisible.
  const w = await seed('readable');
  await deleteCelebration(w.eventId);
  await asUser(w.shopOwner);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks WHERE ask_id = $1`, [w.askId]);
  await reset();
  assert.equal(r.rows[0]!.n, 1, 'the ask was preserved and hidden — worse than deleting it');
});

test('a LIVE ask is still gated on the booking — the orphan arm widened nothing else', async () => {
  const w = await seed('live-gate');
  // No deletion. The rival is not booked on this celebration.
  await asUser(w.rivalOwner);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks WHERE ask_id = $1`, [w.askId]);
  await reset();
  assert.equal(r.rows[0]!.n, 0, 'a shop that was never booked can read a live ask');
});

test('the LIVE gate still bites the OWNER when the booking is no longer live', async () => {
  /*
    ⚠ ADDED AFTER A MUTATION CAME BACK GREEN. Replacing the booked-event clause
    with `OR TRUE` left the whole suite passing, because every other test here
    measures the gate through a RIVAL — and a rival is already stopped by the
    ownership half. The only thing the event clause adds is on the OWNER: while
    the celebration still exists, a shop whose booking is no longer live loses
    sight of the ask.

    This asserts what the shipped policy DOES. It is deliberately narrow: the
    ORPHAN arm is what carries a shop's record through a DELETION, and it is
    unaffected here because the celebration is still there.
  */
  const w = await seed('live-gate-owner');
  await reset();
  await db.query(
    `UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`,
    [w.eventVendorId]);

  await asUser(w.shopOwner);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks WHERE ask_id = $1`, [w.askId]);
  await reset();
  assert.equal(
    r.rows[0]!.n, 0,
    'the booked-event gate stopped applying — a shop reads asks on celebrations it is not booked for',
  );
});

test('a rival shop cannot read somebody else’s ORPHAN either', async () => {
  /*
    ⚠ THE FIRST VERSION OF THIS CHECK, RUN AGAINST PRODUCTION, REPORTED A LEAK
    THAT DID NOT EXIST. The "rival" chosen there happened to be a Setnayan
    ADMIN, and `vendor_payment_asks_admin_read` admitted them — POLICIES ARE
    OR-ED, so the orphan arm was never what let them in. The rival here owns a
    shop and is not an admin, which is the only shape that measures the arm.
  */
  const w = await seed('orphan-rival');
  await deleteCelebration(w.eventId);
  await asUser(w.rivalOwner);
  const seen = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks WHERE ask_id = $1`, [w.askId]);
  const admin = await db.query<{ a: boolean }>(`SELECT public.is_admin() AS a`);
  await reset();
  assert.equal(admin.rows[0]!.a, false, 'the rival is an admin — this test would prove nothing');
  assert.equal(seen.rows[0]!.n, 0, 'a rival shop can read an orphaned ask that is not theirs');
});

test('the couple is NOT given an orphan arm — they removed the celebration', async () => {
  const w = await seed('couple-orphan');
  await deleteCelebration(w.eventId);
  await asUser(w.host);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks WHERE ask_id = $1`, [w.askId]);
  await reset();
  assert.equal(r.rows[0]!.n, 0, 'the couple was handed back a fragment of what they deleted');
});

// ── 3 · AND NO NEW WRITE PATH ─────────────────────────────────────────────

test('a NULL event cannot be used to AUTHOR an ask belonging to no celebration', async () => {
  // The orphan state must only ever be reached by a deletion, never created.
  const w = await seed('no-author');
  const before = (await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks`)).rows[0]!.n;
  await asUser(w.shopOwner);
  try {
    await db.query(
      `INSERT INTO public.vendor_payment_asks
         (event_vendor_id, event_id, vendor_profile_id, amount_php, asked_by_user_id)
       VALUES ($1, NULL, $2, 5000, $3)`, [w.eventVendorId, w.shop, w.shopOwner]);
  } catch { /* refused either way — the count is the assertion */ }
  await reset();
  const after = (await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks`)).rows[0]!.n;
  assert.equal(after, before, 'an ask belonging to no celebration was authored');
});

test('there is still no UPDATE or DELETE policy for anybody', async () => {
  await reset();
  const r = await db.query<{ cmd: string }>(
    `SELECT cmd FROM pg_policies WHERE schemaname='public' AND tablename='vendor_payment_asks'`);
  const cmds = r.rows.map((x) => x.cmd);
  for (const bad of ['UPDATE', 'DELETE', 'ALL']) {
    assert.ok(!cmds.includes(bad), `a ${bad} policy appeared on vendor_payment_asks`);
  }
});
