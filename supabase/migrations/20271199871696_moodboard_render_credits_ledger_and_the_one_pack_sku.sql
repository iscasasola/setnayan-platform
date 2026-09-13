-- ============================================================================
-- 20271199871696_moodboard_render_credits_ledger_and_the_one_pack_sku.sql
--
-- Mood Board "Make it real" — the MONEY SUBSTRATE (MB2). Ledger + config + the
-- one catalog SKU. No UI, no render pipeline, no cache logic: those are MB7,
-- MB8 and MB9 and they all sit on this.
--
-- ── THE PRICE — ONE SURVIVING ROW, FOUR CORPSES ────────────────────────────
-- 2026-09-03 produced FIVE render price rows. The live one (DECISION_LOG.md,
-- grep "ONE RENDER PACK ONLY") is: ONE pack only, 50 renders for ₱1,000. The
-- retired ones, named here so nobody resurrects one by accident, are
-- ₱300/single · ₱500/5 · ₱200/5 · ₱15-per-photo with ₱60/4 · ₱750/50.
--
-- ⚠ ₱1,000 / 50 = ₱20 a render, and that is NOT an arithmetic fault to fix.
-- It was retired as one earlier the same day and then DELIBERATELY REINSTATED
-- by the owner, who was shown the ₱15 → ₱20 arithmetic before choosing.
-- "Correcting" ₱20 back to ₱15 would undo a ruling while believing it was
-- fixing a bug. Leave it.
--
-- 🔑 The price lives in `platform_retail_catalog_v2` and NOWHERE ELSE. That
-- table is admin-managed and is the only figure a customer is ever charged.
-- Nothing in app code may derive, mirror or restate a peso amount for this SKU.
--
-- ── CREDITS ARE NOT PESOS ──────────────────────────────────────────────────
-- Costs are stated to the couple in CREDITS ("Render · 1 credit", "The whole
-- look · 5 credits"), never in pesos, per the same-day "20 RENDERABLE PARTS"
-- row. The 1-vs-5 split and the 50-credit pack size are PRODUCT parameters, so
-- they live in `moodboard_render_config` — admin-editable, one row, read by the
-- app — for exactly the reason `papic_event_pool_config` exists: a number that
-- governs what a couple may spend must not be a constant in a bundle.
--
-- ── WHAT THIS CREATES ──────────────────────────────────────────────────────
--   1. SKU `MOODBOARD_RENDER_PACK` in platform_retail_catalog_v2.
--   2. `moodboard_render_config` — Pattern H (static reference): RLS at CREATE
--      TABLE, public SELECT, no write policy (service-role / admin only),
--      mirroring papic_tier_config and platform_retail_catalog_v2.
--   3. `event_render_credit_grants` — the append-only grant side of the ledger.
--      One INSERT per purchase / comp / admin grant.
--   4. `event_render_credit_usage` — ONE row per event holding the spent
--      counter, bumped atomically. Same shape as papic_event_pool_usage, and
--      for the same reason: a SUM over an append-only ledger cannot be checked
--      and incremented atomically without a row to lock, so two concurrent
--      renders would both read "1 credit left" and both spend it.
--   5. Three functions: balance · reserve · release.
--
-- 🔑 RESERVE-THEN-RELEASE, NOT DEBIT-ON-SUCCESS. A render that fails must not
-- silently eat a credit, and a credit spent on nothing is the exact disease
-- this repo keeps closing — a failure that renders identically to success.
-- MB8 reserves BEFORE calling the model and releases if the call does not
-- produce an image.
--
-- ⚠ NO TRIGGERS HERE, ON PURPOSE. A BEFORE INSERT trigger testing IS NOT NULL
-- on a defaulted column refused every insert for five weeks on this repo
-- (supplier-add outage). Every invariant below is a CHECK constraint or is
-- enforced inside an explicit function, so a plain INSERT either succeeds or
-- fails loudly on a named constraint.
--
-- ADDITIVE + IDEMPOTENT. Nothing is dropped, no existing row changes. Inert on
-- apply: until MB7/MB8 call these functions, nothing here runs.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge; a direct apply stamps the
-- prod ledger with a version that has no file on main and jams db push for
-- every subsequent merge.
-- ============================================================================

BEGIN;

-- ---- 1. the ONE SKU --------------------------------------------------------
-- 50 renders for ₱1,000. saas_overhead_cost_php is the MODEL spend the owner
-- was quoted against this pack in the same decision row: ~₱2.2 per image on
-- Nano Banana / Gemini 2.5 Flash Image × 50 = ~₱110. It is a cost field, not a
-- customer-facing price.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able)
VALUES
  ('MOODBOARD_RENDER_PACK', 'Mood Board Render Pack — 50 renders', 1000.00, 110.00, FALSE)
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able;

-- ---- 2. admin-editable render parameters (Pattern H) -----------------------

CREATE TABLE IF NOT EXISTS public.moodboard_render_config (
  config_key          TEXT PRIMARY KEY DEFAULT 'default',
  -- 1 credit a part · 5 credits the whole look (owner 2026-09-03). The whole
  -- look is deliberately the value play: 20 parts singly is 20 credits, the
  -- combined image is 5.
  credits_per_part    INTEGER NOT NULL DEFAULT 1  CHECK (credits_per_part   >= 0),
  credits_whole_look  INTEGER NOT NULL DEFAULT 5  CHECK (credits_whole_look >= 0),
  -- How many credits one purchase of pack_service_code grants.
  credits_per_pack    INTEGER NOT NULL DEFAULT 50 CHECK (credits_per_pack   >  0),
  -- The catalog row that carries the PRICE. The price itself is never copied
  -- here — this is a pointer, so there is exactly one peso figure in the system.
  pack_service_code   TEXT NOT NULL DEFAULT 'MOODBOARD_RENDER_PACK'
                        REFERENCES public.platform_retail_catalog_v2(service_code),
  -- Product cap on the per-box free-text note. The DB CHECK on
  -- event_renders.note is a far looser ABUSE fence; this is the figure the UI
  -- and the prompt builder enforce, and it is admin-editable because it trades
  -- couple expressiveness against prompt length.
  max_note_chars      INTEGER NOT NULL DEFAULT 500 CHECK (max_note_chars BETWEEN 1 AND 4000),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.moodboard_render_config IS
  'Mood Board "Make it real" product parameters (owner 2026-09-03). '
  'credits_per_part=1 · credits_whole_look=5 · credits_per_pack=50. '
  'PRICING-RELEVANT and admin-editable on purpose — never hardcode these in '
  'app code. The PESO price is NOT here: pack_service_code points at '
  'platform_retail_catalog_v2, which is the only place a customer price lives.';

ALTER TABLE public.moodboard_render_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS moodboard_render_config_public_read ON public.moodboard_render_config;
CREATE POLICY moodboard_render_config_public_read ON public.moodboard_render_config
  FOR SELECT USING (TRUE);
-- No INSERT/UPDATE/DELETE policy: writes are service-role / admin only.

INSERT INTO public.moodboard_render_config (config_key) VALUES ('default')
ON CONFLICT (config_key) DO NOTHING;

-- ---- 3. the grant side of the ledger (append-only) -------------------------

CREATE TABLE IF NOT EXISTS public.event_render_credit_grants (
  grant_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- CHECKs are explicitly NAMED: the Ugat schema-claims guard asserts them by
  -- name, and an autonamed constraint renumbers the moment a second CHECK lands
  -- on the same column, leaving a guard that passes because it matched nothing.
  credits      INTEGER NOT NULL
                 CONSTRAINT event_render_credit_grants_credits_positive
                 CHECK (credits > 0),
  source       TEXT NOT NULL DEFAULT 'pack_order'
                 CONSTRAINT event_render_credit_grants_source_allowed
                 CHECK (source IN ('pack_order', 'admin', 'comp', 'migration')),
  order_id     UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_render_credit_grants_event_idx
  ON public.event_render_credit_grants (event_id, created_at DESC);

-- One grant per paid order, so a re-run of the fulfilment path cannot double-
-- grant. Partial: admin/comp grants carry no order_id and are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS event_render_credit_grants_order_unique
  ON public.event_render_credit_grants (order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.event_render_credit_grants IS
  'Append-only grant side of the per-event render-credit ledger (MB2). One row '
  'per purchased pack / comp / admin grant; credits is always positive. The '
  'spend side is event_render_credit_usage, never a negative row here. UNIQUE '
  'on order_id (partial) makes fulfilment idempotent.';

ALTER TABLE public.event_render_credit_grants ENABLE ROW LEVEL SECURITY;

-- Pattern B, READ HALF ONLY. Any event member may see what the event was
-- granted — the couple must be able to see the credits they paid for, and a
-- balance nobody can read is the invisible-state failure this arc exists to
-- close. There is deliberately NO write policy: a couple granting itself
-- credits is the one thing this table must make impossible, so writes are
-- service-role / SECURITY DEFINER only (same posture as
-- papic_event_point_grants, which additionally hides its reads).
DROP POLICY IF EXISTS event_render_credit_grants_member_read
  ON public.event_render_credit_grants;
CREATE POLICY event_render_credit_grants_member_read
  ON public.event_render_credit_grants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_render_credit_grants.event_id
        AND em.user_id  = auth.uid()
    )
    OR public.is_admin()
  );

-- ---- 4. the spend side — ONE row per event, bumped atomically --------------

CREATE TABLE IF NOT EXISTS public.event_render_credit_usage (
  event_id       UUID PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  credits_used   INTEGER NOT NULL DEFAULT 0
                   CONSTRAINT event_render_credit_usage_nonneg
                   CHECK (credits_used >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.event_render_credit_usage IS
  'Render credits spent by an event (MB2). ONE row per event, event-LIFETIME, '
  'bumped atomically by moodboard_reserve_render_credits and unwound by '
  'moodboard_release_render_credits when a render does not produce an image. '
  'Exists as a counter rather than a SUM over an append-only ledger because a '
  'SUM cannot be checked and incremented under one row lock.';

ALTER TABLE public.event_render_credit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_render_credit_usage_member_read
  ON public.event_render_credit_usage;
CREATE POLICY event_render_credit_usage_member_read
  ON public.event_render_credit_usage
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_render_credit_usage.event_id
        AND em.user_id  = auth.uid()
    )
    OR public.is_admin()
  );
-- No write policy: writes are service-role / SECURITY DEFINER only.

-- ---- 5. may this caller act on this event? --------------------------------
-- service_role and trusted server contexts have no auth.uid(); a browser
-- session always does. So a NULL uid means "the server is asking" and a
-- non-NULL uid must prove membership. `anon` is never granted EXECUTE on the
-- spending functions below, so it can never reach this with a NULL uid.

CREATE OR REPLACE FUNCTION public.moodboard_render_caller_may_act(
  p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN TRUE;                       -- service_role / trusted server context
  END IF;
  RETURN public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = p_event_id
      AND em.user_id  = auth.uid()
  );
END;
$$;

-- ---- 6. balance ------------------------------------------------------------
-- The single truth for "how many renders can this event still buy". Returns
-- NULL for a caller with no business asking, so a refused read is
-- distinguishable from a genuine zero — the two must never render the same.

CREATE OR REPLACE FUNCTION public.moodboard_render_balance(
  p_event_id UUID
) RETURNS TABLE (
  credits_granted INTEGER,
  credits_used    INTEGER,
  credits_left    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted INTEGER;
  v_used    INTEGER;
BEGIN
  IF NOT public.moodboard_render_caller_may_act(p_event_id) THEN
    RETURN;                            -- zero rows, NOT a zero balance
  END IF;

  SELECT COALESCE(SUM(g.credits), 0) INTO v_granted
    FROM public.event_render_credit_grants g
   WHERE g.event_id = p_event_id;

  SELECT COALESCE(u.credits_used, 0) INTO v_used
    FROM public.event_render_credit_usage u
   WHERE u.event_id = p_event_id;

  v_used := COALESCE(v_used, 0);

  credits_granted := v_granted;
  credits_used    := v_used;
  credits_left    := GREATEST(v_granted - v_used, 0);
  RETURN NEXT;
END;
$$;

-- ---- 7. reserve ------------------------------------------------------------
-- Atomically spends p_credits if and only if the event holds them. Returns
-- FALSE when it does not — the caller must then offer the pack, never proceed.

CREATE OR REPLACE FUNCTION public.moodboard_reserve_render_credits(
  p_event_id UUID,
  p_credits  INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted INTEGER;
  v_used    INTEGER;
BEGIN
  IF p_event_id IS NULL OR p_credits IS NULL OR p_credits < 0 THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(p_event_id) THEN
    RETURN FALSE;
  END IF;
  IF p_credits = 0 THEN
    RETURN TRUE;                       -- a cache hit costs nothing
  END IF;

  SELECT COALESCE(SUM(g.credits), 0) INTO v_granted
    FROM public.event_render_credit_grants g
   WHERE g.event_id = p_event_id;

  -- Create-then-lock: the usage row is the lock. INSERT ... ON CONFLICT DO
  -- NOTHING is safe to race; the FOR UPDATE below then serialises spenders.
  INSERT INTO public.event_render_credit_usage (event_id) VALUES (p_event_id)
  ON CONFLICT (event_id) DO NOTHING;

  SELECT u.credits_used INTO v_used
    FROM public.event_render_credit_usage u
   WHERE u.event_id = p_event_id
     FOR UPDATE;

  IF v_used IS NULL THEN
    RETURN FALSE;                      -- event vanished mid-flight
  END IF;

  IF v_used + p_credits > v_granted THEN
    RETURN FALSE;                      -- not enough credits; nothing is spent
  END IF;

  UPDATE public.event_render_credit_usage
     SET credits_used = v_used + p_credits,
         updated_at   = NOW()
   WHERE event_id = p_event_id;

  RETURN TRUE;
END;
$$;

-- ---- 8. release ------------------------------------------------------------
-- Unwinds a reservation when the render does not produce an image. Clamped at
-- zero so a double-release can never mint credits.

CREATE OR REPLACE FUNCTION public.moodboard_release_render_credits(
  p_event_id UUID,
  p_credits  INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL OR p_credits IS NULL OR p_credits <= 0 THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(p_event_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.event_render_credit_usage
     SET credits_used = GREATEST(credits_used - p_credits, 0),
         updated_at   = NOW()
   WHERE event_id = p_event_id;

  RETURN FOUND;
END;
$$;

-- ---- 9. grants — REVOKE FIRST, because CREATE FUNCTION already granted -----
--
-- 🛑 `CREATE FUNCTION` GRANTS EXECUTE TO PUBLIC BY DEFAULT, AND `anon`
-- INHERITS IT. Writing only the GRANT lines below would have left every
-- function here callable with the publishable key that ships in the page
-- source — and that is not a theoretical hole for these four:
-- `moodboard_render_caller_may_act` reads a NULL auth.uid() as "the server is
-- asking", which is exactly what an anonymous caller has. Anyone with curl
-- could have burned a couple's credits.
--
-- Caught by tests/db/anon-rpc-surface.db.test.ts. The REVOKE is what closes it;
-- the GRANT list alone never did.
REVOKE ALL ON FUNCTION public.moodboard_render_caller_may_act(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_render_balance(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_reserve_render_credits(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_release_render_credits(UUID, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.moodboard_render_caller_may_act(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_render_balance(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_reserve_render_credits(UUID, INTEGER)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_release_render_credits(UUID, INTEGER)
  TO authenticated, service_role;

-- ---- 10. table grants — the same default, one level up ---------------------
--
-- Supabase grants ALL on every new `public` table to `anon` and `authenticated`
-- and publishes it as a REST endpoint. RLS is ROW-level and can never hide a
-- COLUMN, so the default would have handed the public internet INSERT on a
-- credit ledger — refused today only because these tables have no write policy,
-- i.e. by a second mechanism rather than by the grant. Take the capability away
-- instead of relying on the policy to keep saying no.
--
-- A logged-out visitor has no business anywhere near an event's credit ledger.
--
-- ⚠ AND THE POLICIES ABOVE SAY `TO authenticated` FOR THE SAME REASON. A
-- policy with no TO clause is written for PUBLIC, which includes `anon` — so
-- revoking anon's grant would leave a rule in the catalog that anonymous
-- visitors can never reach and that nothing would ever fire again. Caught by
-- tests/db/anon-table-grants-closed.db.test.ts; the two halves have to move
-- together.
REVOKE ALL ON TABLE public.event_render_credit_grants FROM anon;
REVOKE ALL ON TABLE public.event_render_credit_usage  FROM anon;
-- Members READ their own ledger (that is how the balance is visible at all);
-- nobody writes it from a session — reserve/release/fulfilment are
-- service-role / SECURITY DEFINER.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON TABLE public.event_render_credit_grants FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON TABLE public.event_render_credit_usage  FROM authenticated;

-- The config is Pattern H: world-readable on purpose (a couple must be able to
-- see what a render costs before signing in), never world-writable.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON TABLE public.moodboard_render_config FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   SELECT * FROM public.platform_retail_catalog_v2
--    WHERE service_code = 'MOODBOARD_RENDER_PACK';        -- 1 row, 1000.00
--   SELECT * FROM public.moodboard_render_config;         -- 1 row, 1 / 5 / 50
--   SELECT * FROM public.moodboard_render_balance('<event>');
--     -- 0 / 0 / 0 for an event that never bought a pack
--   SELECT public.moodboard_reserve_render_credits('<event>', 1);  -- f (broke)
--   INSERT INTO public.event_render_credit_grants (event_id, credits, source)
--        VALUES ('<event>', 50, 'admin');
--   SELECT public.moodboard_reserve_render_credits('<event>', 5);  -- t
--   SELECT public.moodboard_release_render_credits('<event>', 5);  -- t
-- ============================================================================
