/**
 * PLAN ALLOWANCES IN THE DATABASE — the two numbers SQL holds, against the TypeScript table, plus the included-branch
 * gate. Covers 20271307996183_supplier_plan_allowances_2026_11_04.
 *
 * Owner 2026-11-04 (DECISION_LOG "SUPPLIER PLAN ALLOWANCES" + "BRANCHES PER PLAN"), verbatim: *"waitlist 0,0,1,5"* ·
 * *"branches 0,0,3,10"*. Free·Verified / Solo / Pro / Ultra. (The Custom plan was retired 2026-11-06.)
 * Ultra trimmed the same day ("WITH TRIMMED ALLOWANCES"): waitlist 3, branches 6. Expectations read TIER_CAPS.
 *
 * 🔑 PARITY DERIVES FROM THE TYPESCRIPT SIDE (`TIER_CAPS`), so editing one side alone turns CI red.
 * 🔑 GRANDFATHERING is asserted, not assumed: a shop over its allowance keeps every live included branch, renames and
 *    cancels them freely, and is refused only the NEXT one.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  VENDOR_TIERS,
  TIER_CAPS,
  type VendorTier,
} from '../../lib/vendor-tier-caps';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

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
const uniq = (label: string) => `${label}-${++seq}`;

async function newVendor(label: string, tier: VendorTier): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq(label)}@allowances.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const vendorProfileId =
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Allowance Test', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(`UPDATE public.vendor_profiles SET tier_state = $2 WHERE vendor_profile_id = $1`, [vendorProfileId, tier]);
  return vendorProfileId;
}

async function addBranch(vendor: string, included: boolean): Promise<{ id: string | null; error: string | null }> {
  try {
    const r = await db.query<{ branch_id: string }>(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km, included_in_plan)
       VALUES ($1, $2, 'Cebu', 100, $3) RETURNING branch_id`,
      [vendor, uniq('branch'), included],
    );
    return { id: r.rows[0]!.branch_id, error: null };
  } catch (e) {
    return { id: null, error: String((e as Error).message) };
  }
}

test('vendor_tier_limit says exactly what TIER_CAPS says — waitlist and branches, every tier; no bookings-per-date key', async () => {
  for (const tier of VENDOR_TIERS) {
    const r = await db.query<{ wa: number; br: number; bpd: number | null }>(
      `SELECT public.vendor_tier_limit($1,'waitlist_acceptances') AS wa,
              public.vendor_tier_limit($1,'branches_included') AS br,
              public.vendor_tier_limit($1,'bookings_per_date_per_service') AS bpd`,
      [tier],
    );
    assert.equal(r.rows[0]!.wa, TIER_CAPS[tier].waitlistAcceptances, `${tier} waitlist`);
    assert.equal(r.rows[0]!.br, TIER_CAPS[tier].branchesIncluded, `${tier} branches`);
    // Owner 2026-11-18 (ruling 17): bookings per date are not a plan limit — the key answers NULL on every plan.
    assert.equal(r.rows[0]!.bpd, null, `${tier} bookings per date per service`);
  }
  const unknown = await db.query<{ br: number; bpd: number | null }>(
    `SELECT public.vendor_tier_limit(NULL,'branches_included') AS br,
            public.vendor_tier_limit(NULL,'bookings_per_date_per_service') AS bpd`,
  );
  assert.equal(unknown.rows[0]!.br, 0, 'an unknown tier reads as Free — no included branches');
  assert.equal(unknown.rows[0]!.bpd, null, 'no plan serves a bookings-per-date number');
});

test('Pro may add its included branches and is refused the next one', async () => {
  const pro = await newVendor('pro', 'pro');
  for (let i = 0; i < TIER_CAPS.pro.branchesIncluded; i++) {
    const r = await addBranch(pro, true);
    assert.equal(r.error, null, `included branch ${i + 1} refused: ${r.error}`);
  }
  const over = await addBranch(pro, true);
  assert.match(over.error ?? '', /included_branch_allowance/, 'a 4th included branch was let in');
});

test('Free, Verified and Solo have no included branches', async () => {
  for (const tier of ['free', 'verified', 'solo'] as const) {
    const v = await newVendor(tier, tier);
    const r = await addBranch(v, true);
    assert.match(r.error ?? '', /included_branch_allowance/, `${tier} got a free branch`);
  }
});

test('a PAID branch (included_in_plan false) is never counted or refused here', async () => {
  const solo = await newVendor('solo-paid', 'solo');
  assert.equal((await addBranch(solo, false)).error, null);
});

test('cancelling an included branch frees its place; un-cancelling past the allowance is refused', async () => {
  const pro = await newVendor('pro-cancel', 'pro');
  const ids: string[] = [];
  for (let i = 0; i < TIER_CAPS.pro.branchesIncluded; i++) ids.push((await addBranch(pro, true)).id!);
  await db.query(`UPDATE public.vendor_branches SET cancelled_at = NOW() WHERE branch_id = $1`, [ids[0]]);
  const again = await addBranch(pro, true);
  assert.equal(again.error, null, 'the freed place was not given back');
  await assert.rejects(
    db.query(`UPDATE public.vendor_branches SET cancelled_at = NULL WHERE branch_id = $1`, [ids[0]]),
    /included_branch_allowance/,
    'un-cancelling took a 4th included branch',
  );
});

test('GRANDFATHERED: a shop over a lowered allowance keeps its branches, edits them, and is refused only the next', async () => {
  const ent = await newVendor('ultra-down', 'enterprise');
  const ids: string[] = [];
  const held = TIER_CAPS.enterprise.branchesIncluded; // Ultra 3 (owner 2026-11-19) — more than Pro's 1
  assert.ok(held > TIER_CAPS.pro.branchesIncluded + 1, 'the scenario needs Ultra to hold more than Pro + 1');
  for (let i = 0; i < held; i++) ids.push((await addBranch(ent, true)).id!);
  // Drop the plan underneath them (admin path — the downgrade guard is a separate concern, so write tier directly).
  await db.query(`ALTER TABLE public.vendor_profiles DISABLE TRIGGER USER`);
  try {
    await db.query(`UPDATE public.vendor_profiles SET tier_state = 'pro' WHERE vendor_profile_id = $1`, [ent]);
  } finally {
    await db.query(`ALTER TABLE public.vendor_profiles ENABLE TRIGGER USER`);
  }
  const live = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_branches
      WHERE parent_vendor_profile_id = $1 AND included_in_plan AND cancelled_at IS NULL`,
    [ent],
  );
  assert.equal(live.rows[0]!.n, held, 'a lowered allowance removed a branch the shop already had');
  await db.query(`UPDATE public.vendor_branches SET branch_label = 'Renamed' WHERE branch_id = $1`, [ids[1]]);
  await db.query(`UPDATE public.vendor_branches SET cancelled_at = NOW() WHERE branch_id = $1`, [ids[2]]);
  const next = await addBranch(ent, true);
  assert.match(next.error ?? '', /included_branch_allowance/, 'an over-allowance shop added another included branch');
});

/**
 * One Ultra Add-on payment, as the activation hook leaves it: a PAID `vendor_ultra_addon__<id>` order with its own
 * 28-day window (`expires_at`). `endsInDays` < 0 = a window that has already run out.
 */
async function ultraAddOnOrder(vendor: string, endsInDays: number, status = 'paid'): Promise<void> {
  const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [vendor]);
  await db.query(
    `INSERT INTO public.orders (user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code, expires_at)
     VALUES ($1, $2, $3, 'Ultra Add-on', 2490, $4, 'SN' || upper(substr(md5(random()::text), 1, 8)), now() + make_interval(days => $5))`,
    [owner.rows[0]!.user_id, vendor, `vendor_ultra_addon__${vendor}`, status, endsInDays],
  );
}

test('THE ULTRA ADD-ON (owner 2026-11-19): +1 included branch per LIVE add-on, on Ultra only', async () => {
  const ultra = await newVendor('ultra-addon', 'enterprise');
  await ultraAddOnOrder(ultra, 20); // live
  await ultraAddOnOrder(ultra, 3); // live — it stacks
  await ultraAddOnOrder(ultra, -1); // ⏳ its 28 days ran out — must NOT count (review 2026-11-19)
  await ultraAddOnOrder(ultra, 20, 'refunded'); // refunded — must NOT count
  const live = await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons($1) AS n`, [ultra]);
  assert.equal(live.rows[0]!.n, 2, 'the live count is not "paid AND in window"');
  const cap = TIER_CAPS.enterprise.branchesIncluded + 2;
  for (let i = 0; i < cap; i++) {
    const r = await addBranch(ultra, true);
    assert.equal(r.error, null, `Ultra + 2 live add-ons: included branch ${i + 1} of ${cap} refused: ${r.error}`);
  }
  assert.match((await addBranch(ultra, true)).error ?? '', /included_branch_allowance/, 'one past Ultra + its live add-ons was let in');

  // A live add-on on a plan that is not Ultra adds nothing (a lapsed Ultra keeps its orders until they run out).
  const pro = await newVendor('pro-addon', 'pro');
  await ultraAddOnOrder(pro, 20);
  for (let i = 0; i < TIER_CAPS.pro.branchesIncluded; i++) assert.equal((await addBranch(pro, true)).error, null);
  assert.match((await addBranch(pro, true)).error ?? '', /included_branch_allowance/, 'a Pro shop was given an Ultra Add-on branch');
});

test('ONE PAYMENT IS 28 DAYS, NOT FOREVER: an Ultra Add-on whose window ran out gives nothing', async () => {
  const ultra = await newVendor('ultra-lapsed', 'enterprise');
  await ultraAddOnOrder(ultra, -1);
  assert.equal((await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons($1) AS n`, [ultra])).rows[0]!.n, 0);
  for (let i = 0; i < TIER_CAPS.enterprise.branchesIncluded; i++) assert.equal((await addBranch(ultra, true)).error, null);
  assert.match((await addBranch(ultra, true)).error ?? '', /included_branch_allowance/, 'a lapsed add-on still gave a branch');
});

test('the app\'s read of the live count answers only for the caller\'s own shop', async () => {
  const mine = await newVendor('ultra-read-mine', 'enterprise');
  const theirs = await newVendor('ultra-read-theirs', 'enterprise');
  await ultraAddOnOrder(mine, 10);
  const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [mine]);
  await setAuthUid(db, owner.rows[0]!.user_id);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const own = await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons_for($1) AS n`, [mine]);
    assert.equal(own.rows[0]!.n, 1);
    await assert.rejects(() => db.query(`SELECT public.vendor_live_ultra_addons_for($1)`, [theirs]), /not your shop/);
    await assert.rejects(() => db.query(`SELECT public.vendor_live_ultra_addons($1)`, [mine]), /permission denied/, 'the internal count is callable by a shop');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
});

/**
 * ⏳ THE "+1" ADD-ONS LAST 28 DAYS PER PAYMENT TOO (review 2026-11-19: "counts every paid add-on order with no 28-day
 * expiry"). A paid `vendor_extra_category__<id>` order with its window; `endsInDays` < 0 = already ran out; null = an
 * order with no window at all.
 */
async function plusOneOrder(vendor: string, prefix: string, endsInDays: number | null, status = 'paid'): Promise<void> {
  const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [vendor]);
  await db.query(
    `INSERT INTO public.orders (user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code, expires_at)
     VALUES ($1, $2, $3, '+1 add-on', 1, $4, 'SN' || upper(substr(md5(random()::text), 1, 8)),
             CASE WHEN $5::int IS NULL THEN NULL ELSE now() + make_interval(days => $5::int) END)`,
    [owner.rows[0]!.user_id, vendor, `${prefix}${vendor}`, status, endsInDays],
  );
}

test('A "+1" ADD-ON COUNTS ONLY THE PAID PERIODS THAT STILL COVER TODAY — the recount lowers a lapsed one', async () => {
  const ultra = await newVendor('plus-one-recount', 'enterprise');
  await plusOneOrder(ultra, 'vendor_extra_category__', 20); // live
  await plusOneOrder(ultra, 'vendor_extra_category__', 2); // live — it stacks
  await plusOneOrder(ultra, 'vendor_extra_category__', -1); // ⏳ ran out — must not count
  await plusOneOrder(ultra, 'vendor_extra_category__', 20, 'refunded'); // refunded — must not count
  await plusOneOrder(ultra, 'vendor_extra_category__', null); // no window — grants nothing
  await plusOneOrder(ultra, 'vendor_extra_waitlist__', -3); // the only wait-list one ran out
  // The counts the old recompute would have stored: every paid order, forever.
  await db.query(`ALTER TABLE public.vendor_profiles DISABLE TRIGGER USER`);
  try {
    await db.query(
      `UPDATE public.vendor_profiles SET extra_parent_categories = 4, extra_waitlist_acceptances = 1 WHERE vendor_profile_id = $1`,
      [ultra],
    );
  } finally {
    await db.query(`ALTER TABLE public.vendor_profiles ENABLE TRIGGER USER`);
  }
  const changed = await db.query<{ n: number }>(`SELECT public.recount_vendor_count_addons() AS n`);
  assert.ok(changed.rows[0]!.n >= 1, 'the recount changed no shop');
  const after1 = await db.query<{ c: number; w: number }>(
    `SELECT extra_parent_categories AS c, extra_waitlist_acceptances AS w FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [ultra],
  );
  assert.equal(after1.rows[0]!.c, 2, 'a lapsed, refunded or window-less "+1" category still counted');
  assert.equal(after1.rows[0]!.w, 0, 'a lapsed "+1" wait list place still counted');
  // Idempotent: a second run changes nothing for this shop.
  await db.query(`SELECT public.recount_vendor_count_addons()`);
  const after2 = await db.query<{ c: number }>(`SELECT extra_parent_categories AS c FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [ultra]);
  assert.equal(after2.rows[0]!.c, 2);
});

test('A PAID SINGLE SEAT LASTS 28 DAYS, NOT FOREVER — the recount lowers a lapsed seat (controller ruling, 22 Nov)', async () => {
  // The single extra seat had the "+1"s' fault: `extra_agent_seats` counted every paid `vendor_extra_seat__<shop>`
  // order with no window. Now each paid order covers its own 28 days.
  // SABOTAGE THAT TURNS THIS RED (run once, 22 Nov): drop `extra_agent_seats = live.seat` (or the seat sub-select) from
  // `recount_vendor_count_addons()` in 20271351415438 → the stored 5 stays 5 and the first assertion fails.
  const ultra = await newVendor('seat-recount', 'enterprise');
  await plusOneOrder(ultra, 'vendor_extra_seat__', 20); // live
  await plusOneOrder(ultra, 'vendor_extra_seat__', 1); // live — one day left
  await plusOneOrder(ultra, 'vendor_extra_seat__', -1); // ⏳ ran out — must not count
  await plusOneOrder(ultra, 'vendor_extra_seat__', 20, 'refunded'); // refunded — must not count
  await plusOneOrder(ultra, 'vendor_extra_seat__', null); // no window — grants nothing
  // What the old recompute stored: every paid order, forever.
  await db.query(`ALTER TABLE public.vendor_profiles DISABLE TRIGGER USER`);
  try {
    await db.query(`UPDATE public.vendor_profiles SET extra_agent_seats = 5 WHERE vendor_profile_id = $1`, [ultra]);
  } finally {
    await db.query(`ALTER TABLE public.vendor_profiles ENABLE TRIGGER USER`);
  }
  const changed = await db.query<{ n: number }>(`SELECT public.recount_vendor_count_addons() AS n`);
  assert.ok(changed.rows[0]!.n >= 1, 'the recount changed no shop — a shop holding only seats is not recounted');
  const seats = async () =>
    (await db.query<{ s: number }>(`SELECT extra_agent_seats AS s FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [ultra])).rows[0]!.s;
  assert.equal(await seats(), 2, 'a lapsed, refunded or window-less seat order still counted');
  // Idempotent.
  await db.query(`SELECT public.recount_vendor_count_addons()`);
  assert.equal(await seats(), 2);
  // When the last windows lapse, the seats are gone — with no order event at all.
  await db.query(`UPDATE public.orders SET expires_at = now() - interval '1 hour' WHERE service_key = $1 AND status = 'paid' AND expires_at > now()`, [`vendor_extra_seat__${ultra}`]);
  await db.query(`SELECT public.recount_vendor_count_addons()`);
  assert.equal(await seats(), 0, 'a seat whose 28 days ended is still held');
  // And a seat order is never told to renew (nothing sells or renews one) — even one due inside the window.
  await plusOneOrder(ultra, 'vendor_extra_seat__', 3);
  const due = await db.query<{ service_key: string }>(`SELECT service_key FROM public.subscriptions_due_for_renewal_reminder(7)`);
  assert.ok(!due.rows.some((r) => r.service_key.startsWith('vendor_extra_seat__')), 'a seat order would be emailed "renew"');
});

test('NO YEARLY ULTRA ADD-ON ROW (controller ruling, 22 Nov): the catalogue holds exactly one, per 4 weeks', async () => {
  const rows = await db.query<{ sku_code: string; offering_type: string }>(
    `SELECT sku_code, offering_type FROM public.vendor_billing_catalog
      WHERE sku_code LIKE 'vendor\_ultra\_addon%' OR offering_type = 'ultra_addon' ORDER BY sku_code`,
  );
  assert.deepEqual(rows.rows, [{ sku_code: 'vendor_ultra_addon', offering_type: 'ultra_addon' }]);
});

test('the "+1" recount is the service role\'s alone — a signed-in shop cannot raise or reset its own count', async () => {
  const shop = await newVendor('plus-one-recount-auth', 'enterprise');
  const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop]);
  await setAuthUid(db, owner.rows[0]!.user_id);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    await assert.rejects(() => db.query(`SELECT public.recount_vendor_count_addons()`), /permission denied/);
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
});

test('📮 THE RENEWAL REMINDER FIRES FOR AN ULTRA ADD-ON (owner 2026-11-19, ad44b079) — and never for a retired "+1"', async () => {
  const ultra = await newVendor('ultra-renewal-reminder', 'enterprise');
  await ultraAddOnOrder(ultra, 3); // ends in 3 days → due for the 7-day reminder
  await ultraAddOnOrder(ultra, 20); // not yet due
  await ultraAddOnOrder(ultra, -1); // already lapsed
  await plusOneOrder(ultra, 'vendor_extra_category__', 3); // retired, not sold — never told to renew
  const due = await db.query<{ service_key: string; buyer_email: string | null }>(
    `SELECT service_key, buyer_email FROM public.subscriptions_due_for_renewal_reminder(7)
      WHERE service_key LIKE '%' || $1`,
    [ultra],
  );
  assert.deepEqual(due.rows.map((r) => r.service_key), [`vendor_ultra_addon__${ultra}`], 'the reminder did not pick the due Ultra Add-on, or picked a retired "+1"');
  assert.ok(due.rows[0]!.buyer_email, 'the reminder has nobody to send to');
  // Once reminded for this window it is not picked again (the sender's lock).
  const order = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.orders WHERE service_key = $1 AND expires_at < now() + interval '7 days' AND expires_at > now()`,
    [`vendor_ultra_addon__${ultra}`],
  );
  await db.query(`INSERT INTO public.renewal_reminder_log (order_id, reminder_window) VALUES ($1, '7d')`, [order.rows[0]!.order_id]);
  const again = await db.query(`SELECT 1 FROM public.subscriptions_due_for_renewal_reminder(7) WHERE service_key LIKE '%' || $1`, [ultra]);
  assert.equal(again.rows.length, 0, 'an Ultra Add-on was reminded twice in one window');
});
