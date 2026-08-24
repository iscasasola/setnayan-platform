-- ============================================================================
-- The charge path for token packs is closed IN THE FUNCTION THAT CHARGES.
--
-- The vendor token currency was retired product-wide on 2026-08-07 (owner lock
-- 2026-07-21: "token can retire, there should be nothing that needs token any
-- more"). The GRANT half came out that day — `_apply_subscription_credit` says
-- so in its own body: "The token bundle and the add-on credit were REMOVED here
-- (2026-08-07). Activating a plan now activates a plan. Nothing else." It has
-- returned `bundle: 0` and `addon_tokens: 0` as constants ever since.
--
-- THE CHARGE HALF WAS NEVER CLOSED. Measured in production 2026-08-24 by the
-- object (pg_get_functiondef · pg_proc.proacl · row counts — not
-- schema_migrations, not a migration comment):
--
--   • `create_vendor_subscription` still priced a pack from
--     `vendor_billing_catalog WHERE offering_type = 'token_pack' AND is_active
--     = TRUE`, folded it into `amount_php` — the function's own comment calls
--     that "the grand total the vendor pays" — and stored the count.
--   • It is EXECUTE-granted to `authenticated`
--     (anon=X | authenticated=X | service_role=X), so any signed-in admin of a
--     VERIFIED shop could call it straight through PostgREST with a pack SKU.
--     The app passes `p_addon_token_pack_sku: null` on purpose, but THE APP IS
--     NOT THE CONTROL — the browser client and the anon key are public by
--     construction.
--   • The only thing refusing that call was `is_active = FALSE` on six catalog
--     rows (vendor_token_pack_4/5/10/25/50/100), whose PRICES are still sitting
--     in them (₱400 … ₱20,000). No application code writes that flag for packs,
--     so re-activating one is a hand edit — and it is exactly the tidy-up
--     somebody does while cleaning a catalog.
--
-- ⇒ Re-activate any one of those six rows and a vendor is quoted plan + pack,
--   pays the grand total by bank transfer, an admin confirms it, and NOTHING is
--   granted. Real money for nothing.
--
-- 🔑 A DATA FLAG IN ANOTHER TABLE IS NOT A REFUSAL. The rule now lives in the
-- same function as the charge, where it cannot be switched off by an UPDATE.
--
-- SAFE BY ARITHMETIC AS WELL AS BY DESIGN: production holds 2 subscription
-- rows, both `pending_payment`, 0 paid, 0 carrying a non-zero
-- `addon_token_count`, 0 carrying an `addon_token_pack_sku`. And
-- `create_vendor_subscription` is the ONLY function in the database that writes
-- those columns (measured: 0 others), so this closes the path rather than one
-- door onto it.
--
-- ⚠ THE PARAMETER IS KEPT, DELIBERATELY, AND MUST STAY.
-- PostgREST resolves a function by its exact set of NAMED arguments.
-- `app/vendor-dashboard/subscription/actions.ts` sends
-- `p_addon_token_pack_sku: null` with a comment saying why. Drop the parameter
-- and that call matches no candidate, so EVERY vendor plan purchase fails —
-- rejected, not thrown, and the only symptom is an absence. That is this
-- repo's most expensive recurring bug; do not "tidy" the signature.
--
-- ⛔ NOT DONE HERE, on purpose:
--   • `addon_token_count` / `addon_amount_php` are NOT dropped. Two live rows
--     carry the shape and a column drop is its own decision.
--   • The six catalog rows are untouched — their prices are history, and
--     deleting a catalog row has its own blast radius.
--   • No price, SKU or tier-ladder change.
--
-- Idempotent: CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_vendor_subscription(
  p_sku_code               TEXT,
  p_addon_token_pack_sku   TEXT DEFAULT NULL
)
RETURNS public.vendor_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_vendor_id UUID;
  v_price     NUMERIC(10,2);
  v_offering  TEXT;
  v_cycle     TEXT;
  v_period    INT;
  v_tier      public.vendor_tier_state;
  v_ref       TEXT;
  v_row       public.vendor_subscriptions;
BEGIN
  -- Admin-only: resolve the store where the caller is an admin (multi-admin org
  -- model — NOT founder-only). Preserved from 20270401574089 / 20270403095563.
  SELECT vid INTO v_vendor_id FROM public.current_vendor_ids('admin') AS vid LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_VENDOR_ADMIN: only a store admin can purchase a subscription';
  END IF;

  -- Verification gate (owner 2026-07-01): only a VERIFIED store may subscribe.
  IF COALESCE(
       (SELECT verification_state::text FROM public.vendor_profiles
         WHERE vendor_profile_id = v_vendor_id), '') <> 'verified' THEN
    RAISE EXCEPTION 'NOT_VERIFIED: verify your shop before subscribing';
  END IF;

  -- ── TOKEN PACKS CANNOT BE CHARGED FOR (2026-08-07 retirement) ────────────
  -- Placed AFTER the two authorisation gates on purpose: an unauthorised caller
  -- still learns nothing about this function, exactly as before.
  --
  -- The condition is the SAME ONE THE OLD ADD-ON BRANCH USED — not null and not
  -- blank — so a caller sending '' still means "no add-on" and still succeeds,
  -- as it always has. Only a value that would previously have BOUGHT something
  -- is refused; nothing that used to work stops working.
  --
  -- 🔑 THE ERROR CODE IS REUSED, NOT INVENTED. `INVALID_PACK` is already
  -- handled in the vendor checkout, which turns it into "That token add-on is
  -- no longer available." — the correct sentence for this refusal, already
  -- shipped. A new code would have arrived with no reader and shown the generic
  -- "we couldn't start that upgrade" instead.
  IF p_addon_token_pack_sku IS NOT NULL AND btrim(p_addon_token_pack_sku) <> '' THEN
    RAISE EXCEPTION
      'INVALID_PACK: token packs were retired 2026-08-07 and nothing grants them — % cannot be purchased',
      p_addon_token_pack_sku;
  END IF;

  -- Plan price + offering from the catalog (subscriptions only).
  SELECT price_php, offering_type INTO v_price, v_offering
    FROM public.vendor_billing_catalog
    WHERE sku_code = p_sku_code
      AND offering_type IN ('subscription_monthly', 'subscription_annual')
      AND is_active = TRUE;
  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'INVALID_SKU: %', p_sku_code;
  END IF;

  IF v_offering = 'subscription_annual' THEN
    v_cycle := 'annual';
    v_period := 365;
  ELSE
    v_cycle := 'monthly';
    v_period := 28;
  END IF;

  IF p_sku_code LIKE 'solo\_vendor\_%' THEN
    v_tier := 'solo';
  ELSIF p_sku_code LIKE 'pro\_vendor\_%' THEN
    v_tier := 'pro';
  ELSIF p_sku_code LIKE 'enterprise\_vendor\_%' THEN
    v_tier := 'enterprise';
  ELSE
    RAISE EXCEPTION 'UNMAPPED_SKU_TIER: %', p_sku_code;
  END IF;

  -- amount_php = what the vendor pays. With the add-on refused above there is
  -- no second component left to add, so this is simply the plan price: the old
  -- two-term sum is DELETED rather than left adding a zero, because an
  -- arithmetic step with nothing to add reads like a live feature to the next
  -- person.
  --
  -- 🔑 The removed expression is deliberately NOT quoted here. A guard asserts
  -- on this function's own body via pg_get_functiondef, which INCLUDES these
  -- comments — naming the thing removed would put the defect back inside the
  -- sentence announcing its removal, and the guard would fail on the fix.
  v_ref := 'SUB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.vendor_subscriptions
    (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code, period_days,
     holder_user_id, addon_token_pack_sku, addon_token_count, addon_amount_php)
  VALUES
    (v_vendor_id, p_sku_code, v_tier, v_cycle, v_price, v_ref, v_period,
     -- The three add-on columns are written EXPLICITLY NULL rather than
     -- omitted, so the row shape is unchanged for anything still reading it.
     auth.uid(), NULL, NULL, NULL)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- What a reader who queries the OBJECT is told. Applied migrations are never
-- edited, so this comment — not the header above — is what someone inspecting
-- the live function will find.
COMMENT ON FUNCTION public.create_vendor_subscription(TEXT, TEXT) IS
  'Starts a vendor plan purchase (apply-then-pay). Token packs were retired '
  '2026-08-07 and NOTHING grants them, so a non-blank p_addon_token_pack_sku is '
  'refused with INVALID_PACK — the refusal lives here, in the function that '
  'charges, not in vendor_billing_catalog.is_active, which an UPDATE can flip. '
  'THE PARAMETER MUST STAY: PostgREST resolves by the exact set of named '
  'arguments and the checkout sends it as null, so dropping it breaks every '
  'plan purchase silently.';
