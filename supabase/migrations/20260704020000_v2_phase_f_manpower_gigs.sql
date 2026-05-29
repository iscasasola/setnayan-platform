-- =============================================================================
-- 20260704020000_v2_phase_f_manpower_gigs.sql
-- V2 ARCHITECTURAL PIVOT · Phase F · MANPOWER ₱15K OFFLINE CASH FLOW
-- =============================================================================
--
-- WHY THIS LANDS (canonical · CLAUDE.md 2026-05-28 third row "V1 → V2 PIVOT"):
--
-- Setnayan handles ZERO of the ₱15,000 manpower cash. Vendor crew is paid
-- 100% directly off-platform by the host (cash · GCash · bank transfer ·
-- whatever the vendor + host agree on). Setnayan never touches the money,
-- which means Setnayan has NO BIR 2307 / EWT / Official Receipt obligation
-- on this leg of the transaction per RR 16-2023 1% Intermediary Tax
-- exemption. The vendor handles their own Form 2307 + OR on the offline
-- ₱15k as the actual income recipient.
--
-- What Setnayan DOES capture: a 2-token handshake fee from the accepting
-- vendor's wallet (earned-first FIFO via consume_vendor_assets()). The
-- token consumption is the canonical ownership stamp — once the handshake
-- fires, the accepting vendor's vendor_profile_id is the definitive "this
-- vendor staffed this gig" record for downstream event-reward attribution
-- (manpower telemetry checkpoints in Phase E).
--
-- This is non-destructive: net-new table · zero touch on V1 surfaces ·
-- safe to apply during pilot (pilot 2026-06-01 unchanged).
--
-- Operationalization: V2_Cutover_Plan_2026-05-28.md Phase F.
-- Decision-log: CLAUDE.md 2026-05-28 third row § (a) Phase F.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PASS 1 — manpower_gigs table
-- =============================================================================
-- One row per gig posted by a host on a specific event. The vendor accepts
-- via acceptManpowerGig() server action, which atomically (a) consumes 2
-- tokens from the vendor's wallet via consume_vendor_assets() and (b) flips
-- status='accepted' + stamps accepted_at. If the wallet has insufficient
-- tokens, consume_vendor_assets RAISES — the action catches the exception
-- and returns a polite "insufficient_tokens" status to the caller; the gig
-- stays 'pending' for another vendor to claim.
--
-- cash_amount_php_centavos default = 1_500_000 (₱15,000). Hosts can adjust
-- per gig from the post-gig drawer (e.g., ₱18,000 for an extra-large crew
-- or ₱8,000 for a smaller team). The amount is informational only — it
-- never flows through Setnayan. The BIR exemption note is a hardcoded
-- explanatory string surfaced on the vendor-side UI for clarity.

CREATE TABLE IF NOT EXISTS public.manpower_gigs (
  gig_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                   UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  posted_by_user_id          UUID NOT NULL REFERENCES public.users(user_id),
  vendor_profile_id          UUID REFERENCES public.vendor_profiles(vendor_profile_id),
  gig_label                  TEXT NOT NULL CHECK (LENGTH(gig_label) BETWEEN 4 AND 200),
  cash_amount_php_centavos   BIGINT NOT NULL DEFAULT 1500000 CHECK (cash_amount_php_centavos >= 0),
  handshake_tokens_consumed  INT NOT NULL DEFAULT 2 CHECK (handshake_tokens_consumed >= 0),
  status                     TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  posted_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accepted_at                TIMESTAMP WITH TIME ZONE,
  completed_at               TIMESTAMP WITH TIME ZONE,
  cancelled_at               TIMESTAMP WITH TIME ZONE,
  cancellation_reason        TEXT,
  notes                      TEXT,
  bir_exempt_note            TEXT NOT NULL DEFAULT
    'Vendor handles 2307 on offline cash per RR 16-2023 1% Intermediary Tax exemption.'
);

COMMENT ON TABLE public.manpower_gigs IS
  'V2 Phase F · ₱15k offline cash flow · 2-token handshake on accept · BIR-exempt for Setnayan · CLAUDE.md 2026-05-28 third row';

COMMENT ON COLUMN public.manpower_gigs.vendor_profile_id IS
  'NULL while pending (no vendor accepted yet) · populated atomically by acceptManpowerGig() once consume_vendor_assets() succeeds. The accepting vendor stamps definitive ownership for Phase E telemetry reward attribution.';

COMMENT ON COLUMN public.manpower_gigs.posted_by_user_id IS
  'Host who posted the gig · audit-only · authoritative gig-write actor at post time.';

COMMENT ON COLUMN public.manpower_gigs.cash_amount_php_centavos IS
  'Informational only — Setnayan never touches this money. Host pays vendor crew directly off-platform.';

COMMENT ON COLUMN public.manpower_gigs.handshake_tokens_consumed IS
  '2 tokens consumed from accepting vendor wallet via consume_vendor_assets (earned-first FIFO). Not refundable on cancel — handshake is fully earned by Setnayan on accept.';

COMMENT ON COLUMN public.manpower_gigs.bir_exempt_note IS
  'Surfaced verbatim on vendor-side UI. Anchors Setnayan as non-intermediary per RR 16-2023.';

-- =============================================================================
-- PASS 2 — Indexes
-- =============================================================================
-- idx_manpower_event — host event-home page reads "gigs for this event"
-- ordered by status. (event_id, status) supports the common WHERE clause.
--
-- idx_manpower_vendor — vendor-dashboard reads "my accepted + completed
-- gigs" + the pending list across events the vendor is on. The DESC on
-- posted_at lets newest-first render without an ORDER BY scan.

CREATE INDEX IF NOT EXISTS idx_manpower_event
  ON public.manpower_gigs (event_id, status);

CREATE INDEX IF NOT EXISTS idx_manpower_vendor
  ON public.manpower_gigs (vendor_profile_id, status, posted_at DESC);


-- =============================================================================
-- PASS 3 — Row-Level Security
-- =============================================================================
-- Three policies covering the canonical access patterns:
--
--   1. Host reads own event gigs   — event_members.member_type='couple'
--      pattern (matches 0017 / 0048 / 0006 RLS conventions).
--   2. Vendor reads own gigs       — vendor_profiles.user_id = auth.uid()
--      pattern (matches 20260703 V2 token RLS pattern).
--   3. Admin reads/writes all      — public.is_admin() override.
--
-- Note: No client-side INSERT policy. All writes (post, accept, complete,
-- cancel) flow through server actions in apps/web/app/.../actions.ts which
-- run with the host or vendor's session and rely on the SELECT policies +
-- application-layer auth gates. Admin-side direct writes use is_admin().

ALTER TABLE public.manpower_gigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manpower_gigs_host_reads_own_event ON public.manpower_gigs;
CREATE POLICY manpower_gigs_host_reads_own_event
  ON public.manpower_gigs FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT event_id
        FROM public.event_members
       WHERE user_id = auth.uid()
         AND member_type = 'couple'
    )
  );

DROP POLICY IF EXISTS manpower_gigs_vendor_reads_own ON public.manpower_gigs;
CREATE POLICY manpower_gigs_vendor_reads_own
  ON public.manpower_gigs FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id
        FROM public.vendor_profiles
       WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS manpower_gigs_admin_all ON public.manpower_gigs;
CREATE POLICY manpower_gigs_admin_all
  ON public.manpower_gigs FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

-- =============================================================================
-- VERIFICATION RECIPE (manual sanity check post-push):
--
--   -- 1. Table exists + has the right columns
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'manpower_gigs'
--    ORDER BY ordinal_position;
--
--   -- 2. Indexes exist
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'manpower_gigs' ORDER BY indexname;
--
--   -- 3. RLS enabled + policies live
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.manpower_gigs'::regclass
--    ORDER BY polname;
--
--   -- 4. Default ₱15,000 surfaces correctly
--   -- (Done from the app layer via the post-gig drawer.)
-- =============================================================================
