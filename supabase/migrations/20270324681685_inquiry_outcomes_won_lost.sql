-- inquiry_outcomes_won_lost · Wave 6 vendor benefit · "Won & Lost Reasons"
-- ============================================================================
-- WHAT THIS ADDS
--   1. inquiry_outcome_reason_codes — ADMIN-MANAGED taxonomy of why a couple
--      picked / passed a vendor. The set lives in this TABLE (never hardcoded in
--      app code, per [[feedback_setnayan_categories_db_not_hardcoded]]). Seeded
--      with a sensible starter set; admins own it thereafter.
--   2. inquiry_outcomes — one self-reported outcome per inquiry (won/lost/
--      no_response) + an optional reason_code (FK to the taxonomy) + free note.
--      OFF-PLATFORM REALITY: "won" is a vendor's self-reported signal, NOT a
--      verified on-platform payment (Setnayan never holds the money). Modeled as
--      a signal exactly like respond_vendor_proposal's accept.
--   3. vendor_inquiry_outcomes_rollup(p_vendor_profile_id) — a vendor's OWN
--      won/lost/no-response breakdown by reason, for the messages-surface card.
--   4. admin_inquiry_outcomes_overview() — platform aggregate, for the
--      /admin/insights Won/Lost report card. is_console_admin()-gated.
--
-- RLS AT CREATE (same migration as the CREATE TABLE):
--   • reason codes  : public/authenticated read active rows; admin FOR ALL.
--   • outcomes      : vendor read/write OWN via current_vendor_profile_ids();
--                     admin read ALL via is_console_admin().
--   • one outcome per inquiry → UNIQUE on
--     (vendor_profile_id, COALESCE(vendor_proposal_id, chat_thread_id)).
--
-- KEEP IDEMPOTENT — CREATE TABLE/INDEX IF NOT EXISTS · CREATE OR REPLACE FUNCTION
-- · DROP POLICY IF EXISTS then CREATE POLICY.
-- ============================================================================

-- ── 1 · Admin-managed reason taxonomy ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inquiry_outcome_reason_codes (
  reason_code TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  applies_to  TEXT NOT NULL DEFAULT 'any'
              CHECK (applies_to IN ('won', 'lost', 'no_response', 'any')),
  sort_order  INT NOT NULL DEFAULT 100,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inquiry_outcome_reason_codes ENABLE ROW LEVEL SECURITY;

-- Anyone signed in (and anon, for SSR) may read the ACTIVE taxonomy — it's a
-- non-sensitive picklist. The capture UI reads it to build its reason chips.
DROP POLICY IF EXISTS reason_codes_read_active ON public.inquiry_outcome_reason_codes;
CREATE POLICY reason_codes_read_active
  ON public.inquiry_outcome_reason_codes FOR SELECT TO authenticated, anon
  USING (is_active = TRUE);

-- Admins own the taxonomy (read all, including inactive, + write).
DROP POLICY IF EXISTS reason_codes_admin_all ON public.inquiry_outcome_reason_codes;
CREATE POLICY reason_codes_admin_all
  ON public.inquiry_outcome_reason_codes FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.inquiry_outcome_reason_codes IS
  'Admin-managed taxonomy of why a couple picked/passed a vendor (Won & Lost Reasons, Wave 6). The set lives HERE — never hardcode the list in app code.';

-- Sensible starter set. The TABLE is the source of truth from here on; admins
-- add/retire codes via the admin surface (toggle is_active / edit label).
INSERT INTO public.inquiry_outcome_reason_codes (reason_code, label, applies_to, sort_order) VALUES
  -- Lost
  ('lost_price',          'Too expensive / over budget',        'lost', 10),
  ('lost_availability',   'Not available on their date',        'lost', 20),
  ('lost_chose_another',  'Chose another vendor',               'lost', 30),
  ('lost_no_budget',      'They had no budget / event paused',  'lost', 40),
  ('lost_ghosted',        'Stopped responding',                 'lost', 50),
  ('lost_scope_mismatch', 'Service or package didn''t fit',     'lost', 60),
  -- Won
  ('won_best_fit',        'Best fit for what they wanted',      'won', 10),
  ('won_referral',        'Came in on a referral',              'won', 20),
  ('won_responsiveness',  'Won on responsiveness / service',    'won', 30),
  ('won_price',           'Best price',                         'won', 40),
  -- No response
  ('no_response_unread',  'Never opened / no reply',            'no_response', 10),
  -- Any
  ('other',               'Other (see note)',                   'any', 900)
ON CONFLICT (reason_code) DO NOTHING;

-- ── 2 · The outcome records ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inquiry_outcomes (
  outcome_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- Either anchor may be set; the UNIQUE below uses COALESCE(proposal, thread).
  chat_thread_id    UUID REFERENCES public.chat_threads(thread_id) ON DELETE SET NULL,
  vendor_proposal_id UUID REFERENCES public.vendor_proposals(proposal_id) ON DELETE SET NULL,
  outcome           TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'no_response')),
  reason_code       TEXT REFERENCES public.inquiry_outcome_reason_codes(reason_code) ON DELETE SET NULL,
  free_text         TEXT CHECK (free_text IS NULL OR length(free_text) <= 1000),
  recorded_by       UUID,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- At least one anchor must identify the inquiry.
  CONSTRAINT inquiry_outcomes_has_anchor
    CHECK (vendor_proposal_id IS NOT NULL OR chat_thread_id IS NOT NULL)
);

-- One outcome per inquiry. A table-level UNIQUE can't hold an expression, so the
-- COALESCE(proposal, thread) collapse lives in a UNIQUE EXPRESSION INDEX — a
-- thread OR a proposal each get exactly one outcome row per vendor.
CREATE UNIQUE INDEX IF NOT EXISTS inquiry_outcomes_one_per_inquiry
  ON public.inquiry_outcomes
  (vendor_profile_id, COALESCE(vendor_proposal_id, chat_thread_id));

CREATE INDEX IF NOT EXISTS inquiry_outcomes_vendor_idx
  ON public.inquiry_outcomes (vendor_profile_id, outcome);
CREATE INDEX IF NOT EXISTS inquiry_outcomes_reason_idx
  ON public.inquiry_outcomes (reason_code);

ALTER TABLE public.inquiry_outcomes ENABLE ROW LEVEL SECURITY;

-- Vendor org reads its OWN outcomes (owner + admin team members, via the
-- canonical helper). Admins read ALL (for the platform report card).
DROP POLICY IF EXISTS inquiry_outcomes_read ON public.inquiry_outcomes;
CREATE POLICY inquiry_outcomes_read
  ON public.inquiry_outcomes FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  );

-- Vendor org writes its OWN outcomes only.
DROP POLICY IF EXISTS inquiry_outcomes_org_insert ON public.inquiry_outcomes;
CREATE POLICY inquiry_outcomes_org_insert
  ON public.inquiry_outcomes FOR INSERT TO authenticated
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS inquiry_outcomes_org_update ON public.inquiry_outcomes;
CREATE POLICY inquiry_outcomes_org_update
  ON public.inquiry_outcomes FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS inquiry_outcomes_org_delete ON public.inquiry_outcomes;
CREATE POLICY inquiry_outcomes_org_delete
  ON public.inquiry_outcomes FOR DELETE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

COMMENT ON TABLE public.inquiry_outcomes IS
  'Self-reported Won/Lost/No-response outcome per inquiry (Wave 6). "Won" is a vendor SIGNAL, not a verified on-platform payment — Setnayan settles off-platform.';

-- ── 3 · Vendor roll-up — own won/lost/no-response by reason ─────────────────
-- Ownership-gated (mirrors vendor_peso_per_lead). Returns a JSONB shape the
-- messages-surface card renders directly: totals + per-reason breakdown.
CREATE OR REPLACE FUNCTION public.vendor_inquiry_outcomes_rollup(
  p_vendor_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Ownership gate — SECURITY DEFINER bypasses RLS, so without this any signed
  -- in user could read another vendor's outcomes.
  IF p_vendor_profile_id NOT IN (SELECT public.current_vendor_profile_ids()) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'won',         COUNT(*) FILTER (WHERE outcome = 'won'),
        'lost',        COUNT(*) FILTER (WHERE outcome = 'lost'),
        'no_response', COUNT(*) FILTER (WHERE outcome = 'no_response'),
        'total',       COUNT(*)
      )
      FROM public.inquiry_outcomes
      WHERE vendor_profile_id = p_vendor_profile_id
    ),
    'by_reason', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.outcome, r.n DESC)
      FROM (
        SELECT
          io.outcome,
          io.reason_code,
          COALESCE(rc.label, '(no reason given)') AS label,
          COUNT(*) AS n
        FROM public.inquiry_outcomes io
        LEFT JOIN public.inquiry_outcome_reason_codes rc
          ON rc.reason_code = io.reason_code
        WHERE io.vendor_profile_id = p_vendor_profile_id
        GROUP BY io.outcome, io.reason_code, rc.label
      ) r
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_inquiry_outcomes_rollup(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_inquiry_outcomes_rollup(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_inquiry_outcomes_rollup(UUID) TO authenticated;

-- ── 4 · Admin platform aggregate — for /admin/insights ──────────────────────
CREATE OR REPLACE FUNCTION public.admin_inquiry_outcomes_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'won',          COUNT(*) FILTER (WHERE outcome = 'won'),
        'lost',         COUNT(*) FILTER (WHERE outcome = 'lost'),
        'no_response',  COUNT(*) FILTER (WHERE outcome = 'no_response'),
        'total',        COUNT(*),
        'reporting_vendors', COUNT(DISTINCT vendor_profile_id)
      )
      FROM public.inquiry_outcomes
    ),
    'by_reason', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.outcome, r.n DESC)
      FROM (
        SELECT
          io.outcome,
          io.reason_code,
          COALESCE(rc.label, '(no reason given)') AS label,
          COUNT(*) AS n
        FROM public.inquiry_outcomes io
        LEFT JOIN public.inquiry_outcome_reason_codes rc
          ON rc.reason_code = io.reason_code
        GROUP BY io.outcome, io.reason_code, rc.label
      ) r
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_inquiry_outcomes_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_inquiry_outcomes_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_inquiry_outcomes_overview() TO authenticated;
