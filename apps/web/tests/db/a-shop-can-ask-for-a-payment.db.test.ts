/**
 * A SHOP CAN ASK A BOOKED CUSTOMER FOR A PAYMENT — and cannot do anything else.
 *
 * `vendor_payment_asks` is a row one party writes ABOUT ANOTHER PARTY'S MONEY.
 * That makes three things load-bearing, and each is asserted by exercising it
 * rather than by reading the migration back:
 *
 *   1 · WHO MAY WRITE ONE. Only a shop with a CONFIRMED booking on that
 *       celebration, and only in its own name. A shop merely in conversation is
 *       refused, and so is a couple writing an ask against themselves.
 *   2 · WHAT MAY BE CHANGED AFTERWARDS. Nothing, by anybody, through the table.
 *       Neither side has an UPDATE or DELETE policy — and neither holds the
 *       GRANT either, which is the fence that survives somebody later adding a
 *       permissive policy by mistake. `has_table_privilege` alone would not
 *       prove this: it answers FALSE while COLUMN grants stand, so the column
 *       privileges are counted too.
 *   3 · THAT THE INVERSE WORKS. A forward primitive with no inverse is a defect
 *       this repo has paid for; withdrawal is single-winner and idempotent.
 *
 * 🔑 EVERY REFUSAL IS ASSERTED AS A VALUE, NEVER AS A THROW where RLS is what
 * refuses — an RLS denial and a no-op look identical from the caller, so
 * `assert.rejects` would prove nothing. Where a CHECK constraint refuses, the
 * throw IS the mechanism and is asserted as one.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

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
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

type World = {
  shopOwner: string;
  otherShopOwner: string;
  coupleUser: string;
  vendorProfileId: string;
  otherVendorProfileId: string;
  eventId: string;
  eventVendorId: string;
};

/** A confirmed booking of `shop` on `event`, plus a rival shop and the couple. */
async function seed(tag: string, status = 'contracted'): Promise<World> {
  await reset();
  const shopOwner = await createUser(`ask-shop-${tag}@example.com`);
  const otherShopOwner = await createUser(`ask-other-${tag}@example.com`);
  const coupleUser = await createUser(`ask-couple-${tag}@example.com`);

  const mk = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY['photography']::text[],'verified',NOW())
         RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;

  const vendorProfileId = await mk(shopOwner, `Ask Studio ${tag}`);
  const otherVendorProfileId = await mk(otherShopOwner, `Rival Studio ${tag}`);

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Ask Test Day', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUser],
  );
  const b = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'photographer',$2,$3,$4) RETURNING vendor_id`,
    [eventId, `Ask Studio ${tag}`, status, vendorProfileId],
  );
  return {
    shopOwner,
    otherShopOwner,
    coupleUser,
    vendorProfileId,
    otherVendorProfileId,
    eventId,
    eventVendorId: b.rows[0]!.vendor_id,
  };
}

/**
 * Insert an ask through a real session. Returns HOW MANY ROWS LANDED, measured
 * by counting the table before and after — not by `RETURNING`.
 *
 * 🔴 IT USED `RETURNING ask_id` AND THAT MADE TWO OF THESE TESTS PASS FOR THE
 * WRONG REASON. `INSERT … RETURNING` needs the SELECT policy as well, so an
 * insert the WITH CHECK happily admitted still threw — and the test read the
 * throw as "the insert policy refused it". Measured by mutation: deleting the
 * booked-event requirement from the WITH CHECK left this suite GREEN. Counting
 * rows asks the question the test claims to ask.
 *
 * ⚠ AND `status` IS PAIRED WITH ITS TIMESTAMP. Posting `'withdrawn'` with a
 * NULL `withdrawn_at` is refused by the coherence CHECK whatever the policy
 * says, so the forged-status test was measuring the CHECK. It now supplies a
 * timestamp, leaving the policy as the only thing that can refuse.
 */
async function tryAsk(
  w: World,
  as: string,
  over: Partial<{ vendorProfileId: string; status: string; askedBy: string; amount: string }> = {},
): Promise<number> {
  const before = await countAsks();
  await asUser(as);
  const status = over.status ?? 'open';
  try {
    await db.query(
      `INSERT INTO public.vendor_payment_asks
         (event_vendor_id, event_id, vendor_profile_id, amount_php, note, status, withdrawn_at, asked_by_user_id)
       VALUES ($1,$2,$3,$4,'Second installment',$5,$6,$7)`,
      [
        w.eventVendorId,
        w.eventId,
        over.vendorProfileId ?? w.vendorProfileId,
        over.amount ?? '18000',
        status,
        // Satisfy the coherence CHECK so the POLICY is the only fence left.
        status === 'withdrawn' ? new Date().toISOString() : null,
        over.askedBy ?? as,
      ],
    );
  } catch {
    // An RLS refusal raises 42501; either shape is a refusal, and the count
    // below is the answer in both.
  } finally {
    await reset();
  }
  return (await countAsks()) - before;
}

async function countAsks(): Promise<number> {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_payment_asks`,
  );
  return r.rows[0]!.n;
}

// ── 1 · WHO MAY WRITE ONE ──────────────────────────────────────────────────

test('a booked shop can ask its own customer', async () => {
  const w = await seed('happy');
  assert.equal(await tryAsk(w, w.shopOwner), 1);
});

test('a shop that is NOT booked cannot ask — the gate is the booking, not the link', async () => {
  // `current_vendor_booked_event_ids()` requires a CONFIRMED status. A shop
  // still in conversation is linked to the celebration and must still be
  // refused: an ask for money before a booking exists is not a reminder, it is
  // a stranger billing somebody.
  const w = await seed('unbooked', 'shortlisted');
  const before = await countAsks();
  assert.equal(await tryAsk(w, w.shopOwner), 0);
  assert.equal(await countAsks(), before, 'an unbooked shop wrote an ask');
});

test('another shop cannot ask on somebody else’s booking', async () => {
  const w = await seed('rival');
  const before = await countAsks();
  assert.equal(
    await tryAsk(w, w.otherShopOwner, { vendorProfileId: w.otherVendorProfileId }),
    0,
  );
  assert.equal(await countAsks(), before);
});

test('a shop cannot sign an ask in somebody else’s name', async () => {
  // THE ROW IS YOURS, THE FIELD IS NOT. `asked_by_user_id` records WHO asked;
  // without the WITH CHECK pinning it to auth.uid() a shop could stamp a
  // teammate — or the couple — as the author of its own demand for money.
  const w = await seed('forge-author');
  const before = await countAsks();
  assert.equal(await tryAsk(w, w.shopOwner, { askedBy: w.coupleUser }), 0);
  assert.equal(await countAsks(), before);
});

test('a shop cannot post an ask that is already withdrawn', async () => {
  // Posting a resolved state writes history nobody lived through, and it is the
  // one state the RPC exists to be the only writer of.
  //
  // ⚠ MEASURED, AND WORTH SAYING: NO SINGLE-CLAUSE MUTATION CAN MAKE THIS FAIL.
  // Three fences hold it — `status = 'open'`, `withdrawn_at IS NULL`, and the
  // coherence CHECK — and each covers the others. Removing `status = 'open'`
  // alone leaves this test GREEN, which reads exactly like a decorative guard
  // and is not one: removing BOTH policy clauses turns this line RED (verified
  // by mutation, 1 → 0 occurrences). That redundancy is the design; the test
  // asserts the OUTCOME, which is what a shop can actually do.
  const w = await seed('forge-status');
  const before = await countAsks();
  assert.equal(await tryAsk(w, w.shopOwner, { status: 'withdrawn' }), 0);
  assert.equal(await countAsks(), before);
});

test('the couple cannot write an ask against themselves', async () => {
  const w = await seed('couple-writes');
  const before = await countAsks();
  assert.equal(await tryAsk(w, w.coupleUser), 0);
  assert.equal(await countAsks(), before);
});

// ── 2 · WHAT MAY BE CHANGED AFTERWARDS: NOTHING, THROUGH THE TABLE ─────────

test('neither side holds an UPDATE or DELETE policy on the table', async () => {
  await reset();
  const r = await db.query<{ cmd: string }>(
    `SELECT cmd FROM pg_policies WHERE schemaname='public' AND tablename='vendor_payment_asks'`,
  );
  const cmds = r.rows.map((x) => x.cmd);
  assert.ok(cmds.length >= 4, `expected the four policies, saw ${cmds.length}`);
  for (const bad of ['UPDATE', 'DELETE', 'ALL']) {
    assert.ok(!cmds.includes(bad), `a ${bad} policy appeared on vendor_payment_asks`);
  }
});

test('and neither holds the GRANT either — the fence outside the policy', async () => {
  // 🔑 A TABLE-LEVEL PRIVILEGE CHECK IS NOT ENOUGH: `has_table_privilege`
  // answers FALSE while COLUMN grants stand, which is how a table can read as
  // closed and be open. Both are counted.
  await reset();
  const t = await db.query<{ priv: string }>(
    `SELECT privilege_type AS priv FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='vendor_payment_asks'
        AND grantee='authenticated'`,
  );
  const privs = new Set(t.rows.map((x) => x.priv));
  assert.deepEqual([...privs].sort(), ['INSERT', 'SELECT'], 'authenticated holds more than SELECT+INSERT');

  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.column_privileges
      WHERE table_schema='public' AND table_name='vendor_payment_asks'
        AND grantee='authenticated' AND privilege_type NOT IN ('SELECT','INSERT')`,
  );
  assert.equal(c.rows[0]!.n, 0, 'a column-level write grant survives on vendor_payment_asks');
});

test('anon reaches this table by no route at all', async () => {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT
       (SELECT count(*) FROM information_schema.role_table_grants
         WHERE table_schema='public' AND table_name='vendor_payment_asks' AND grantee='anon')
     + (SELECT count(*) FROM information_schema.column_privileges
         WHERE table_schema='public' AND table_name='vendor_payment_asks' AND grantee='anon')
     + (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='vendor_payment_asks'
           AND ('anon' = ANY(roles) OR 'public' = ANY(roles)))
     AS n`,
  );
  // A new table in `public` is BORN with seven grants to anon — this asserts the
  // migration's REVOKE actually ran, not that Postgres was kind.
  assert.equal(r.rows[0]!.n, 0, 'anon can still reach vendor_payment_asks');
});

test('row security is on', async () => {
  await reset();
  const r = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid='public.vendor_payment_asks'::regclass`,
  );
  assert.equal(r.rows[0]!.on, true);
});

// ── 3 · THE CONSTRAINTS ────────────────────────────────────────────────────

test('an ask for nothing, or for a negative amount, is refused by the database', async () => {
  const w = await seed('amount');
  await reset();
  for (const bad of ['0', '-1']) {
    await assert.rejects(
      db.query(
        `INSERT INTO public.vendor_payment_asks
           (event_vendor_id, event_id, vendor_profile_id, amount_php, asked_by_user_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [w.eventVendorId, w.eventId, w.vendorProfileId, bad, w.shopOwner],
      ),
      `amount ${bad} was accepted`,
    );
  }
});

test('a withdrawn ask cannot exist without the moment it was withdrawn', async () => {
  const w = await seed('coherence');
  await reset();
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_payment_asks
         (event_vendor_id, event_id, vendor_profile_id, amount_php, status, withdrawn_at, asked_by_user_id)
       VALUES ($1,$2,$3,1000,'withdrawn',NULL,$4)`,
      [w.eventVendorId, w.eventId, w.vendorProfileId, w.shopOwner],
    ),
    'a withdrawn ask with no timestamp was accepted',
  );
});

// ── 4 · THE INVERSE ────────────────────────────────────────────────────────

async function newAsk(w: World): Promise<string> {
  await reset();
  const r = await db.query<{ ask_id: string }>(
    `INSERT INTO public.vendor_payment_asks
       (event_vendor_id, event_id, vendor_profile_id, amount_php, asked_by_user_id)
     VALUES ($1,$2,$3,18000,$4) RETURNING ask_id`,
    [w.eventVendorId, w.eventId, w.vendorProfileId, w.shopOwner],
  );
  return r.rows[0]!.ask_id;
}

async function withdraw(askId: string, as: string | null) {
  await setAuthUid(db, as);
  const r = await db.query<{ out: { ok: boolean; reason?: string; already?: boolean } }>(
    `SELECT public.withdraw_vendor_payment_ask($1) AS out`,
    [askId],
  );
  await setAuthUid(db, null);
  return r.rows[0]!.out;
}

test('the shop that asked can take it back, once, and a second call is a no-op', async () => {
  const w = await seed('withdraw');
  const askId = await newAsk(w);

  const first = await withdraw(askId, w.shopOwner);
  assert.equal(first.ok, true);
  assert.equal(first.already, false);

  const second = await withdraw(askId, w.shopOwner);
  assert.equal(second.ok, true, 'a repeat withdrawal errored instead of no-opping');
  assert.equal(second.already, true);

  await reset();
  const row = await db.query<{ status: string; withdrawn_at: string | null }>(
    `SELECT status, withdrawn_at FROM public.vendor_payment_asks WHERE ask_id=$1`,
    [askId],
  );
  assert.equal(row.rows[0]!.status, 'withdrawn');
  assert.ok(row.rows[0]!.withdrawn_at, 'the receipt was not stamped');
});

test('a stranger cannot take back somebody else’s ask', async () => {
  const w = await seed('withdraw-rival');
  const askId = await newAsk(w);
  const out = await withdraw(askId, w.otherShopOwner);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'not_yours');

  await reset();
  const row = await db.query<{ status: string }>(
    `SELECT status FROM public.vendor_payment_asks WHERE ask_id=$1`,
    [askId],
  );
  assert.equal(row.rows[0]!.status, 'open', 'a rival withdrew an ask that was not theirs');
});

test('the couple cannot take back an ask that was made of them', async () => {
  // They answer it by paying, or by talking. Silently deleting a supplier's
  // request for money from the supplier's own screen is not an answer.
  const w = await seed('withdraw-couple');
  const askId = await newAsk(w);
  const out = await withdraw(askId, w.coupleUser);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'not_yours');
});

test('WITH NO SESSION THE RPC REFUSES — the service-role trap, asserted', async () => {
  // 🔴 The service-role client carries no user, so `auth.uid()` is NULL and
  // every ownership test inside the function fails. Calling this RPC on the
  // admin client would refuse every withdrawal in production while the feature
  // looked finished. That defect was caught in this repo one day before this
  // file was written; this is what stops it coming back.
  const w = await seed('withdraw-nosession');
  const askId = await newAsk(w);
  const out = await withdraw(askId, null);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'not_yours');
});

test('withdrawing an ask that does not exist says so, rather than pretending', async () => {
  const w = await seed('withdraw-missing');
  await setAuthUid(db, w.shopOwner);
  const r = await db.query<{ out: { ok: boolean; reason?: string } }>(
    `SELECT public.withdraw_vendor_payment_ask('00000000-0000-0000-0000-000000000000'::uuid) AS out`,
  );
  await setAuthUid(db, null);
  assert.equal(r.rows[0]!.out.ok, false);
  assert.equal(r.rows[0]!.out.reason, 'not_found');
});

// ── 5 · WHAT THE TABLE MUST NEVER GROW ─────────────────────────────────────

test('there is no "paid" state — that answer belongs to the ledger', async () => {
  // Two copies of a money rule always drift. Whether money arrived is
  // `event_vendor_payments` + `vendor_confirmed_at`, and nothing else.
  await reset();
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='public.vendor_payment_asks'::regclass
        AND conname LIKE '%status%'`,
  );
  const def = r.rows.map((x) => x.def).join(' ');
  assert.ok(def.includes("'open'"), 'the status CHECK went missing');
  assert.ok(def.includes("'withdrawn'"), 'the status CHECK went missing');
  assert.ok(!/'paid'|'settled'|'received'/.test(def), 'the ask grew a money state of its own');
});

test('an ask never writes the budget ledger — no trigger, no cascade into line items', async () => {
  // A change order settles into `event_vendor_line_items` because it CHANGES
  // what is owed. An ask does not, and if one ever did it would DOUBLE the
  // couple's total.
  const w = await seed('no-ledger');
  await reset();
  const before = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_line_items WHERE vendor_id=$1`,
    [w.eventVendorId],
  );
  await newAsk(w);
  const after = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_line_items WHERE vendor_id=$1`,
    [w.eventVendorId],
  );
  assert.equal(after.rows[0]!.n, before.rows[0]!.n, 'asking for a payment moved the ledger');
});
