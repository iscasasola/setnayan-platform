-- ============================================================================
-- 20270214000000_pabati_video_guestbook.sql
--
-- PABATI foundation (schema + backend) — the guest video-greeting collector.
-- "Pabati" (Tagalog "pagbati" / a greeting) lets up to 300 guests-or-the-couple
-- record a short (≤5s) video greeting that lands in a shared, couple-reviewed
-- gallery on the event's Setnayan landing page.
--
-- This migration is the CONFLICT-FREE GROUNDWORK ONLY — no collector UI, no
-- landing-page surface, no recap/day-of wiring. Those land in a later
-- "surfaces" PR. The catalog deliberately stays PABATI='not_built' (v2-catalog)
-- until that surface exists, so a couple cannot buy a dead feature.
--
-- Mirrors the canonical Papic pattern (20260718000000_papic_guest_seats_*):
--   • IF NOT EXISTS table with RLS enabled at CREATE TABLE time,
--   • couple (event_members member_type='couple') + is_admin() RLS policies,
--   • NO anon/public table policy — guest writes go through a SECURITY DEFINER
--     advisory-locked quota RPC (the authoritative server-side gate), exactly
--     like papic_record_guest_capture.
--
-- Corpus hard locks honored here:
--   • 5-SECOND CLIP CAP — server-side, not configurable. The RPC stamps
--     LEAST(p_duration_ms, 5000) so a clip can NEVER store as longer than 5s,
--     regardless of what the client sends. (The client + the route enforce it
--     too — defense in depth.)
--   • MAX 300 CLIPS PER EVENT — the advisory-locked count gate in the RPC.
--     Two simultaneous submissions can't both slip past 300.
--   • The NSFW screen (on by default, cannot disable) is enforced app-side via
--     moderation_state (default 'unscreened') — same column + value-set the
--     Papic nsfw-screen engine uses.
--
-- Gate is BUNDLE-AWARE + ADMIN-APPROVED. pabati_event_owns_pabati() reuses the
-- live public.bundles_granting_sku() helper (migration 20270103010000) so a
-- Media-Pack buyer (which fans out to PABATI) owns the feature, AND it requires
-- the order/bundle to be ADMIN-APPROVED (status paid/fulfilled) — matching
-- lib/entitlements.ts checkOrderActive (this is a FEATURE GATE, not a buy
-- surface, so a still-pending 'submitted' order does NOT confer access).
--
-- SAFETY — purely additive: one new table + two new functions. No drops, no
-- column changes, no behavior change for any event that doesn't own PABATI.
-- Idempotent (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP
-- POLICY IF EXISTS + CREATE). Safe to apply live with no backfill.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. pabati_clips — one row per guest (or couple/coordinator) video greeting.
--
--    guest_id is NULLABLE: a future un-identified public prompt ("leave a
--    greeting" with no guest link) still records a clip, so the FK is
--    ON DELETE SET NULL rather than CASCADE — deleting a guest must not erase
--    the greeting they left.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pabati_clips (
  id               BIGSERIAL PRIMARY KEY,
  clip_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id         UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
    -- Nullable — a public, un-identified prompt may record a greeting with no
    -- guest link. SET NULL (not CASCADE) so a deleted guest's greeting survives.
  r2_object_key    TEXT,
    -- Canonical R2 ref, e.g. 'r2://setnayan-media/pabati/<event_id>/pabati-<ts>.mp4'.
    -- Nullable so a clip still counts against the 300-cap even if R2 is
    -- unconfigured in a given environment (the count is the cap gate; the bytes
    -- are a best-effort archive).
  duration_ms      INTEGER,
    -- Stamped LEAST(client_ms, 5000) by the RPC — can never exceed the 5s cap.
  guest_label      TEXT,
    -- Optional display name for an un-identified greeting ("From the Reyes
    -- family"). For a guest-linked clip the guest record is the source of truth.
  moderation_state TEXT NOT NULL DEFAULT 'unscreened',
    -- Same value-set the Papic NSFW engine drives: 'unscreened' → 'clean' |
    -- 'nsfw_blocked'. On by default; the screen runs app-side. Guest-facing
    -- surfaces (shipped in the later surfaces PR) exclude *_blocked rows.
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hidden_at        TIMESTAMPTZ,
    -- Couple soft-hide from their moderation surface (a future surface).
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pabati_clips_event_id_idx
  ON public.pabati_clips(event_id);
CREATE INDEX IF NOT EXISTS pabati_clips_captured_at_idx
  ON public.pabati_clips(captured_at);

ALTER TABLE public.pabati_clips ENABLE ROW LEVEL SECURITY;

-- RLS — couple (member_type='couple') reads their event's greetings so the
-- couple-facing card/gallery (later surface) can show them; admin full. Guests
-- DO NOT write here directly — inserts go through the SECURITY DEFINER
-- pabati_record_clip() fn (the guest prompt is a public, RLS-less surface). No
-- public/anon policy: the guest path is the fn, not a table grant. Shape copied
-- verbatim from papic_guest_captures_couple_read / _admin_all.
DROP POLICY IF EXISTS pabati_clips_couple_read ON public.pabati_clips;
CREATE POLICY pabati_clips_couple_read ON public.pabati_clips
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = pabati_clips.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  );

DROP POLICY IF EXISTS pabati_clips_admin_all ON public.pabati_clips;
CREATE POLICY pabati_clips_admin_all ON public.pabati_clips
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. pabati_event_owns_pabati — bundle-aware, ADMIN-APPROVED ownership gate.
--
--    TRUE iff the event has an APPROVED (paid/fulfilled) order that confers
--    PABATI — either a direct PABATI order OR a bundle (MEDIA_PACK) that
--    includes it. Reuses the live public.bundles_granting_sku() helper
--    (migration 20270103010000), which is the DB mirror of BUNDLE_CHILD_SKUS in
--    lib/entitlements.ts — so the gate, the app-side eventSkuActive('PABATI'),
--    and the bundle fan-out all agree.
--
--    WHY 'paid'/'fulfilled' (not the "not relinquished" set the Papic
--    provisioning gate uses) — this is a FEATURE gate: the collector unlocks
--    only AFTER the Setnayan team verifies the payment (owner 2026-06-18 admin-
--    approval handshake). A still-pending 'submitted' order must NOT confer
--    access. This matches lib/entitlements.ts checkOrderActive exactly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pabati_event_owns_pabati(
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.event_id = p_event_id
      -- ADMIN-APPROVED only (feature gate). orders.status is the order_status
      -- ENUM; cast to text before the IN so a null status doesn't raise.
      AND COALESCE(o.status::text, '') IN ('paid', 'fulfilled')
      AND (
        -- Direct à-la-carte PABATI order.
        o.service_key = 'PABATI'
        -- OR a bundle the event bought that includes PABATI (e.g. MEDIA_PACK).
        OR o.service_key = ANY (public.bundles_granting_sku('PABATI'))
      )
  );
$$;

COMMENT ON FUNCTION public.pabati_event_owns_pabati(UUID) IS
  'Bundle-aware, admin-approved (paid/fulfilled) ownership gate for the PABATI video-guestbook SKU. Mirrors lib/entitlements.ts eventSkuActive(''PABATI''). Reuses bundles_granting_sku() (20270103010000).';

-- ---------------------------------------------------------------------------
-- 3. pabati_record_clip — quota-enforcing, 5s-capped clip insert.
--
--    Called by the clip route handler (POST /api/pabati/clip) AFTER it has
--    identified the submitter (guest session OR authenticated couple/
--    coordinator). Verifies the event owns PABATI, advisory-locks per EVENT,
--    counts existing clips, REJECTS once the 300-clip per-event cap is reached,
--    inserts with LEAST(duration_ms, 5000), and returns {status, total, used,
--    remaining}.
--
--    300 = corpus hard lock "max 300 clips/event". The advisory lock is keyed
--    on the EVENT (not the guest) because the cap is per-EVENT — two guests
--    submitting at once must serialize through the same count check.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pabati_record_clip(
  p_event_id      UUID,
  p_guest_id      UUID DEFAULT NULL,
  p_r2_object_key TEXT DEFAULT NULL,
  p_duration_ms   INTEGER DEFAULT NULL,
  p_guest_label   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap CONSTANT INTEGER := 300;
  v_owns BOOLEAN;
  v_used INTEGER;
  v_duration INTEGER;
BEGIN
  v_owns := public.pabati_event_owns_pabati(p_event_id);
  IF NOT v_owns THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  -- Advisory lock keyed on the EVENT so two simultaneous submissions serialize
  -- through the count check. hashtextextended(..., 42) → bigint lock key scoped
  -- to this transaction (42 = a stable per-feature seed; distinct from the
  -- Papic guest-capture lock which keys on the guest).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text, 42));

  SELECT COUNT(*)::INTEGER INTO v_used
  FROM public.pabati_clips
  WHERE event_id = p_event_id;

  IF v_used >= v_cap THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      'total', v_cap,
      'used', v_used,
      'remaining', 0
    );
  END IF;

  -- 5-SECOND HARD CAP — server-side, not configurable. A NULL duration stores
  -- NULL (unknown); any value is clamped to ≤5000ms so a clip can never persist
  -- as longer than the cap regardless of the client.
  v_duration := CASE
    WHEN p_duration_ms IS NULL THEN NULL
    ELSE LEAST(p_duration_ms, 5000)
  END;

  INSERT INTO public.pabati_clips (event_id, guest_id, r2_object_key, duration_ms, guest_label)
  VALUES (p_event_id, p_guest_id, p_r2_object_key, v_duration, p_guest_label);

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', v_cap,
    'used', v_used + 1,
    'remaining', GREATEST(0, v_cap - (v_used + 1))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants — the route handler calls these RPCs through anon (guest session)
--    + authenticated (couple/coordinator). SECURITY DEFINER means the body runs
--    as the owner; EXECUTE just lets the role invoke it.
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.pabati_event_owns_pabati(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pabati_record_clip(UUID, UUID, TEXT, INTEGER, TEXT) TO authenticated, anon;

COMMIT;
