/**
 * A COST CAN EXIST WITH NO SUPPLIER — and only the right people can read it.
 *
 * `event_vendor_line_items.vendor_id` is `UUID NOT NULL`, so until BA7 a couple
 * could not record a single peso without first inventing a supplier row. This
 * proves `event_costs` closed that, and closed it WITHOUT opening the couple's
 * household spending to anyone new.
 *
 * Three things are load-bearing, and each is asserted by EXERCISING it through
 * a real session rather than by reading the migration back:
 *
 *   1 · IT WORKS AT ALL. A couple with zero `event_vendors` rows can insert a
 *       cost and read it back. That is the defect, stated as a test.
 *   2 · WHO CAN READ IT. The couple, and a delegate the host actually granted
 *       the BUDGET area. Not another couple. Not a delegate granted every OTHER
 *       area. And — the policy this table deliberately does NOT have — not a
 *       supplier booked on the event, who can read `event_vendor_line_items`
 *       and has no business seeing what the couple spent on rings.
 *   3 · WHAT THE COLUMN CHECKS REFUSE. A negative amount, a blank label.
 *
 * 🔑 REFUSALS BY RLS ARE ASSERTED AS ROW COUNTS, NEVER AS THROWS. An RLS denial
 * and a no-op are indistinguishable from the caller, so `assert.rejects` would
 * prove nothing there. Where a CHECK constraint refuses, the throw IS the
 * mechanism and is asserted as one. Inserts are counted before-and-after rather
 * than read from `RETURNING` — `INSERT … RETURNING` needs the SELECT policy
 * too, so a `RETURNING` that throws can be a WITH CHECK that happily admitted
 * the row. That exact confusion made two tests in the sibling suite
 * (`a-shop-can-ask-for-a-payment.db.test.ts`) pass for the wrong reason.
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
async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asUser(uid: string) {
  await reset();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/** Total rows in the table, measured as the OWNER so RLS cannot hide any. */
async function totalCosts(): Promise<number> {
  await reset();
  const r = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.event_costs`);
  return r.rows[0]!.n;
}

/** How many rows `uid` can actually SEE on `eventId`. */
async function visibleTo(uid: string, eventId: string): Promise<number> {
  await asUser(uid);
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_costs WHERE event_id = $1`,
    [eventId],
  );
  await reset();
  return r.rows[0]!.n;
}

/** Insert through a real session. Returns HOW MANY ROWS LANDED, not RETURNING. */
async function tryInsert(
  uid: string,
  eventId: string,
  over: Partial<{ label: string; amount: string; paid: string; group: string }> = {},
): Promise<{ landed: number; error: string | null }> {
  const before = await totalCosts();
  await asUser(uid);
  let error: string | null = null;
  try {
    await db.query(
      `INSERT INTO public.event_costs (event_id, plan_group_id, label, amount_php, paid_php)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        eventId,
        over.group ?? 'rings',
        over.label ?? 'Wedding rings',
        over.amount ?? '40000',
        over.paid ?? '0',
      ],
    );
  } catch (e) {
    error = (e as Error).message;
  }
  await reset();
  return { landed: (await totalCosts()) - before, error };
}

type World = {
  couple: string;
  otherCouple: string;
  budgetDelegate: string;
  guestListDelegate: string;
  shopOwner: string;
  eventId: string;
  otherEventId: string;
  eventVendorId: string;
};

async function seed(tag: string): Promise<World> {
  await reset();
  const couple = await createUser(`cost-couple-${tag}@example.com`);
  const otherCouple = await createUser(`cost-other-${tag}@example.com`);
  const budgetDelegate = await createUser(`cost-budget-del-${tag}@example.com`);
  const guestListDelegate = await createUser(`cost-guest-del-${tag}@example.com`);
  const shopOwner = await createUser(`cost-shop-${tag}@example.com`);

  const mkEvent = async (name: string, owner: string) => {
    // `events_wedding_fields_consistency` requires ceremony_type + venue_setting
    // on a wedding and forbids them on anything else, so a wedding fixture must
    // carry both. It is a wedding on purpose: rings and the marriage licence
    // are the costs this table exists for.
    const e = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
       VALUES ($1,'wedding','civil','garden') RETURNING event_id`,
      [name],
    );
    const id = e.rows[0]!.event_id;
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
      [id, owner],
    );
    return id;
  };
  const eventId = await mkEvent(`Cost Wedding ${tag}`, couple);
  const otherEventId = await mkEvent(`Other Wedding ${tag}`, otherCouple);

  // A delegate the host granted BUDGET, and one granted everything BUT budget.
  // The second is the one that makes the first mean something.
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1,$2,'wedding_planner_external', now(),
             jsonb_build_object('areas', jsonb_build_object('budget','view')))`,
    [eventId, budgetDelegate],
  );
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1,$2,'wedding_planner_external', now(),
             jsonb_build_object('areas', jsonb_build_object('guest_list','edit')))`,
    [eventId, guestListDelegate],
  );

  // A SUPPLIER, really booked on this event. `event_vendor_line_items` grants
  // them a read; `event_costs` deliberately does not.
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,$2,'Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [shopOwner, `Cost Studio ${tag}`],
  );
  const booking = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'photographer',$2,'contracted',$3) RETURNING vendor_id`,
    [eventId, `Cost Studio ${tag}`, vp.rows[0]!.vendor_profile_id],
  );

  return {
    couple,
    otherCouple,
    budgetDelegate,
    guestListDelegate,
    shopOwner,
    eventId,
    otherEventId,
    eventVendorId: booking.rows[0]!.vendor_id,
  };
}

// ── 1 · IT WORKS AT ALL ──────────────────────────────────────────────────────

test('a couple can record rings with NO event_vendors row of their own', () => {
  return (async () => {
    const w = await seed('works');
    // The precondition IS the defect: this event has one supplier row, and it
    // belongs to a shop the couple booked — nothing they could hang a ring
    // purchase on. Prove there is no manual vendor to abuse before proving the
    // cost lands without one.
    await reset();
    const manual = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.event_vendors
       WHERE event_id = $1 AND marketplace_vendor_id IS NULL`,
      [w.eventId],
    );
    assert.equal(manual.rows[0]!.n, 0, 'the fixture already had somewhere to put the money');

    const r = await tryInsert(w.couple, w.eventId, { label: 'Wedding rings', amount: '40000' });
    assert.equal(r.landed, 1, `the couple could not record their own cost: ${r.error ?? ''}`);
    assert.equal(await visibleTo(w.couple, w.eventId), 1, 'they cannot read back what they wrote');
  })();
});

test('the couple can update and delete their own cost', () => {
  return (async () => {
    const w = await seed('mutate');
    await tryInsert(w.couple, w.eventId, { label: 'Licence', amount: '600' });

    await asUser(w.couple);
    await db.query(
      `UPDATE public.event_costs SET paid_php = 600 WHERE event_id = $1`,
      [w.eventId],
    );
    const paid = await db.query<{ paid_php: string }>(
      `SELECT paid_php FROM public.event_costs WHERE event_id = $1`,
      [w.eventId],
    );
    assert.equal(Number(paid.rows[0]!.paid_php), 600, 'the couple cannot record paying it');

    await db.query(`DELETE FROM public.event_costs WHERE event_id = $1`, [w.eventId]);
    await reset();
    assert.equal(await visibleTo(w.couple, w.eventId), 0, 'the couple cannot delete their own row');
  })();
});

// ── 2 · WHO CAN READ IT ──────────────────────────────────────────────────────

test('another couple sees NOTHING, and cannot plant a cost on this wedding', () => {
  return (async () => {
    const w = await seed('isolation');
    await tryInsert(w.couple, w.eventId, { label: 'Rings', amount: '40000' });

    assert.equal(await visibleTo(w.otherCouple, w.eventId), 0, 'a stranger can read the budget');

    // And the WITH CHECK half: forging someone else's event_id must not land.
    const forged = await tryInsert(w.otherCouple, w.eventId, { label: 'Not theirs' });
    assert.equal(forged.landed, 0, 'a stranger wrote a cost onto this wedding');
  })();
});

test('a delegate granted BUDGET reads it; one granted every other area does not', () => {
  return (async () => {
    const w = await seed('delegate');
    await tryInsert(w.couple, w.eventId, { label: 'Rings', amount: '40000' });

    assert.equal(
      await visibleTo(w.budgetDelegate, w.eventId),
      1,
      'a coordinator the host gave the budget to is looking at a budget with a hole in it',
    );
    assert.equal(
      await visibleTo(w.guestListDelegate, w.eventId),
      0,
      'a delegate never granted the budget can read the money',
    );

    // Read-only. There is no moderator write policy on this table, exactly as
    // there is none on `event_vendor_line_items`.
    await asUser(w.budgetDelegate);
    await db
      .query(`UPDATE public.event_costs SET amount_php = 1 WHERE event_id = $1`, [w.eventId])
      .catch(() => {});
    await reset();
    const amt = await db.query<{ amount_php: string }>(
      `SELECT amount_php FROM public.event_costs WHERE event_id = $1`,
      [w.eventId],
    );
    assert.equal(Number(amt.rows[0]!.amount_php), 40000, 'a delegate rewrote the couple’s money');
  })();
});

test('a BOOKED supplier cannot read it — the fourth policy is absent on purpose', () => {
  return (async () => {
    const w = await seed('vendorblind');
    await tryInsert(w.couple, w.eventId, { label: 'Wedding rings', amount: '40000' });

    // Prove the supplier really can read the SIBLING table. Without this the
    // assertion below would pass on a broken fixture — "sees nothing" is what a
    // mis-seeded vendor sees too, and this precondition caught exactly that
    // while the suite was being written.
    //
    // 🔑 THE SIBLING IS `event_vendor_line_items`, NOT `event_vendors`. A shop
    // has NO read policy on the booking row itself (couples + moderators only);
    // `event_vendor_line_items_vendor_read` is the one grant that lets a shop
    // see a couple's itemized money, via `current_vendor_event_vendor_ids()`.
    // That policy is precisely the one this table does not copy.
    await asUser(w.couple);
    await db.query(
      `INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php)
       VALUES ($1,$2,'Coverage package',90000)`,
      [w.eventId, w.eventVendorId],
    );
    await asUser(w.shopOwner);
    const sibling = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.event_vendor_line_items WHERE event_id = $1`,
      [w.eventId],
    );
    await reset();
    assert.equal(
      sibling.rows[0]!.n,
      1,
      'the fixture supplier cannot read its own line items, so this guard proves nothing',
    );

    assert.equal(
      await visibleTo(w.shopOwner, w.eventId),
      0,
      'a caterer can read what the couple spent on rings',
    );
  })();
});

test('anon holds no grant on the table at all', () => {
  return (async () => {
    await reset();
    const r = await db.query<{ privilege_type: string }>(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='event_costs' AND grantee='anon'`,
    );
    assert.deepEqual(r.rows, [], `anon holds ${r.rows.length} grant(s) on event_costs`);

    // Column grants outlive a table-level `has_table_privilege` check, so count
    // them separately — that is the audit hole the REVOKE in the migration is
    // written at table level to close.
    const cols = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.column_privileges
       WHERE table_schema='public' AND table_name='event_costs' AND grantee='anon'`,
    );
    assert.equal(cols.rows[0]!.n, 0, 'anon holds column grants on event_costs');
  })();
});

test('RLS is enabled on the table, not merely policied', () => {
  return (async () => {
    await reset();
    const r = await db.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_costs'::regclass`,
    );
    assert.equal(r.rows[0]!.relrowsecurity, true, 'policies exist but RLS is OFF');
  })();
});

// ── 3 · WHAT THE COLUMN CHECKS REFUSE ────────────────────────────────────────

test('the CHECKs refuse a negative amount and a blank label', () => {
  return (async () => {
    const w = await seed('checks');

    const negative = await tryInsert(w.couple, w.eventId, { amount: '-1' });
    assert.equal(negative.landed, 0);
    assert.match(String(negative.error), /amount_php|check/i);

    const negativePaid = await tryInsert(w.couple, w.eventId, { paid: '-1' });
    assert.equal(negativePaid.landed, 0);

    const blank = await tryInsert(w.couple, w.eventId, { label: '   ' });
    assert.equal(blank.landed, 0);
    assert.match(String(blank.error), /label|check/i);

    // Paid ABOVE the amount is NOT refused — overpaying is real, and the
    // resolver's job is to name it (`overpaid_cost`), never to make the
    // couple's own record unrepresentable.
    const over = await tryInsert(w.couple, w.eventId, { amount: '18000', paid: '25000' });
    assert.equal(over.landed, 1, `an overpayment was refused: ${over.error ?? ''}`);
  })();
});
