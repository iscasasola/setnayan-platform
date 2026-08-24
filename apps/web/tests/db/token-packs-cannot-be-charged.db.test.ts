/**
 * A vendor cannot be charged for a token pack, even if somebody switches one
 * back on.
 *
 * ── What was wrong ─────────────────────────────────────────────────────────
 * The vendor token currency was retired product-wide on 2026-08-07. The GRANT
 * half came out that day — `_apply_subscription_credit` says so in its own
 * body and returns `bundle: 0`, `addon_tokens: 0` as constants.
 *
 * **The CHARGE half was never closed.** `create_vendor_subscription` still
 * priced a pack from the catalog, folded it into `amount_php` ("the grand total
 * the vendor pays") and stored the count — and it is EXECUTE-granted to
 * `authenticated`, so the app sending `p_addon_token_pack_sku: null` was never
 * the control. The only thing refusing the call was `is_active = FALSE` on six
 * catalog rows whose prices (₱400 … ₱20,000) are still sitting in them.
 *
 * ⇒ Re-activate one row — the sort of tidy-up somebody does while cleaning a
 * catalog — and a vendor pays plan + pack by bank transfer, an admin confirms
 * it, and nothing is granted.
 *
 * ── Why the fixture activates the row ──────────────────────────────────────
 * 🔑 THIS IS THE WHOLE POINT OF THE TEST, AND A TEST THAT LEFT THE ROW INACTIVE
 * WOULD PASS WITHOUT PROVING ANYTHING. With every pack inactive, the OLD
 * function also refuses — with `INVALID_PACK`, from the catalog lookup. The
 * assertion only has force when the pack is ACTIVE and BUYABLE, because that is
 * the exact state the fix exists to survive. So the fixture switches one on.
 *
 * 🛡 MUTATION-CHECKED, occurrence count printed before → after: reverting the
 * function to its pre-fix body (add-on lookup restored) makes the active-pack
 * case go GREEN-to-RED here. An unmeasured mutation proves nothing.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

after(async () => { await db.close(); });

const UID = '00000000-0000-4000-8000-00000000ab01';
let vendorId: string;
/** A subscription SKU that really exists in the replayed catalog. */
let planSku: string;
/** A token-pack SKU, switched ON by the fixture — see the docblock. */
let packSku: string;

/**
 * Seed a VERIFIED shop whose owner is an admin, so the two authorisation gates
 * in `create_vendor_subscription` pass and the test reaches the rule it is
 * about. Seeded as the default role: `SET ROLE service_role` breaks the
 * on_auth_user_created trigger, and the default role bypasses RLS anyway.
 */
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [UID, 'packs@t.invalid']);

  const v = await db.query<{ vendor_profile_id: string }>(
    // `vendor_profiles_verified_requires_stamp` refuses 'verified' without a
    // `last_verified_at` — a shop cannot award itself the badge (2026-08-12).
    // The fixture satisfies the real rule rather than working around it.
    `INSERT INTO public.vendor_profiles
       (business_name, business_slug, user_id, verification_state, last_verified_at)
     VALUES ('Pack Test Shop','packtestshop',$1,'verified', now())
     RETURNING vendor_profile_id`, [UID]);
  vendorId = v.rows[0]!.vendor_profile_id;

  // handle_new_vendor_user may already have seeded the owner row; make the
  // membership certain either way rather than assuming which trigger ran.
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`, [vendorId, UID]);

  const plan = await db.query<{ sku_code: string }>(
    `SELECT sku_code FROM public.vendor_billing_catalog
      WHERE offering_type IN ('subscription_monthly','subscription_annual')
        AND is_active = TRUE AND sku_code LIKE 'pro\\_vendor\\_%' LIMIT 1`);
  assert.ok(plan.rows[0], 'the replayed catalog has no active pro plan — the fixture would prove nothing');
  planSku = plan.rows[0]!.sku_code;

  const pack = await db.query<{ sku_code: string }>(
    `UPDATE public.vendor_billing_catalog SET is_active = TRUE
      WHERE sku_code = (SELECT sku_code FROM public.vendor_billing_catalog
                         WHERE offering_type = 'token_pack' ORDER BY sku_code LIMIT 1)
      RETURNING sku_code`);
  assert.ok(pack.rows[0], 'no token_pack row to activate — this test needs one to be meaningful');
  packSku = pack.rows[0]!.sku_code;

  await setAuthUid(db, UID);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
});

/** The pack really is buyable in this fixture — the positive control. */
test('the fixture leaves a token pack ACTIVE, priced and grant-bearing', async () => {
  const r = await db.query<{ is_active: boolean; price_php: string; token_grant_count: number }>(
    `SELECT is_active, price_php, token_grant_count
       FROM public.vendor_billing_catalog WHERE sku_code = $1`, [packSku]);
  const row = r.rows[0]!;
  assert.equal(row.is_active, true, 'an inactive pack is refused by the OLD code too — the test would prove nothing');
  assert.ok(Number(row.price_php) > 0, 'a ₱0 pack could not overcharge anybody');
  assert.ok(row.token_grant_count > 0, 'a 0-count pack hits INVALID_PACK on the old path anyway');
});

test('a plan purchase naming an ACTIVE token pack is refused', async () => {
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription($1,$2)`, [planSku, packSku]),
    (err: Error) => {
      assert.match(err.message, /INVALID_PACK/,
        'the code must stay INVALID_PACK — the vendor checkout already turns that ' +
        'into "That token add-on is no longer available."; a new code would arrive ' +
        'with no reader and show the generic failure instead');
      return true;
    },
  );
  const n = await db.query<{ c: string }>(`SELECT count(*)::text AS c FROM public.vendor_subscriptions`);
  assert.equal(n.rows[0]!.c, '0', 'a refused purchase must not leave a row behind');
});

test('the plan alone still buys, and is charged the plan price and nothing more', async () => {
  // ⚖ THE COUNTERWEIGHT. A refusal that also broke ordinary plan purchases
  // would pass the rule above and take the product's only upgrade path with it.
  const before = await db.query<{ price_php: string }>(
    `SELECT price_php FROM public.vendor_billing_catalog WHERE sku_code = $1`, [planSku]);
  const planPrice = Number(before.rows[0]!.price_php);

  await db.query(`SELECT public.create_vendor_subscription($1,$2)`, [planSku, null]);

  const r = await db.query<{
    amount_php: string; addon_token_pack_sku: string | null;
    addon_token_count: number | null; addon_amount_php: string | null;
  }>(`SELECT amount_php, addon_token_pack_sku, addon_token_count, addon_amount_php
        FROM public.vendor_subscriptions ORDER BY created_at DESC LIMIT 1`);
  const row = r.rows[0]!;
  assert.equal(Number(row.amount_php), planPrice, 'the vendor is charged the plan price, with nothing folded in');
  assert.equal(row.addon_token_pack_sku, null);
  assert.equal(row.addon_token_count, null);
  assert.equal(row.addon_amount_php, null);
});

test('a blank pack argument still means "no add-on", exactly as it always did', async () => {
  // The refusal uses the SAME condition the old add-on branch used — not null
  // AND not blank — so nothing that used to work stops working. Widening it to
  // "not null" would start rejecting a caller that means none.
  await db.query(`SELECT public.create_vendor_subscription($1,$2)`, [planSku, '   ']);
  const n = await db.query<{ c: string }>(`SELECT count(*)::text AS c FROM public.vendor_subscriptions`);
  assert.equal(n.rows[0]!.c, '2', 'a blank add-on is not an add-on and must still buy the plan');
});

test('the parameter is still in the signature — dropping it breaks every purchase', async () => {
  // 🔑 NOT PEDANTRY. PostgREST resolves a function by its exact set of NAMED
  // arguments, and the vendor checkout sends `p_addon_token_pack_sku: null`.
  // Remove the parameter and that call matches no candidate: every plan
  // purchase fails, REJECTED rather than thrown, with an absence as the only
  // symptom. This assertion is what stops the next tidy-up.
  const r = await db.query<{ args: string }>(
    `SELECT pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_vendor_subscription'`);
  assert.equal(r.rows.length, 1, 'exactly one create_vendor_subscription — an overload would make RPC resolution ambiguous');
  assert.equal(r.rows[0]!.args, 'p_sku_code text, p_addon_token_pack_sku text');
});

test('the function no longer reads the token-pack catalog at all', async () => {
  // The refusal must be the ONLY thing left of the add-on path. A live lookup
  // sitting under an early RAISE reads like a feature to the next person, and
  // is one deleted line away from being one again.
  const r = await db.query<{ body: string }>(
    `SELECT pg_get_functiondef(p.oid) AS body
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_vendor_subscription'`);
  const body = r.rows[0]!.body;
  assert.equal(/offering_type\s*=\s*'token_pack'/.test(body), false,
    'the pack lookup is gone, not merely unreachable');
  assert.equal(/COALESCE\(v_addon_price/.test(body), false,
    'and so is the fold into amount_php — a fold with nothing to fold in reads like a live feature');
  assert.match(body, /INVALID_PACK: token packs were retired/,
    'what survives is the refusal, and it says why');
});

test('the checkout can still reach the function — the EXPLICIT grant survives the replace', async () => {
  // 🔑 `CREATE OR REPLACE` keeps the object and with it its ACL. A future hand
  // reaching for DROP + CREATE instead would silently take the grants with it,
  // and every vendor plan purchase would fail the same way dropping the
  // parameter does: refused at the API layer, with an absence as the only
  // symptom.
  //
  // 🪤 THE OBVIOUS TEST FOR THIS CANNOT FAIL, AND ONLY THE MUTATION SAID SO.
  // `has_function_privilege('authenticated', …, 'EXECUTE')` returns TRUE after a
  // DROP + CREATE as well — Postgres grants EXECUTE to PUBLIC on a new function
  // by default, so the privilege is there whether anybody meant it or not.
  // Measured: the sabotage landed (1 → 0 occurrences of CREATE OR REPLACE) and
  // the assertion stayed GREEN. It now reads the EXPLICIT acl, which a fresh
  // function does not have — `proacl` comes back NULL.
  const r = await db.query<{ acl: string | null }>(
    `SELECT array_to_string(p.proacl::text[], ' | ') AS acl
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_vendor_subscription'`);
  const acl = r.rows[0]!.acl;
  assert.ok(acl, 'proacl is NULL — the function was re-created rather than replaced, so its explicit grants are gone and only the PUBLIC default is left');
  assert.match(acl!, /authenticated=X/, 'the vendor checkout calls this as `authenticated`');
  assert.match(acl!, /service_role=X/, 'and the webhook path calls it as service_role');
});
