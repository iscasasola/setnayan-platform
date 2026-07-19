-- inquiry_concentration_detection — Phase E slice 2 (SHADOW mode: flag admin only).
-- ============================================================================
-- The competitor-sabotage signature: many LINKED accounts (one identity_cluster —
-- provably the same entity by shared device/address/payment) inquiring to ONE
-- vendor. Owner-approved 2026-07-12 to run in SHADOW mode: on a hit we only raise
-- an admin integrity_flags entry for HUMAN review — we NEVER silently withhold an
-- inquiry (quarantine stays an explicit later decision; withholding a real
-- couple's inquiry is the heaviest, highest-false-positive-risk action).
--
-- High-confidence by construction (presumption-of-a-real-couple): the signal is
-- CROSS-account (a cluster of ≥N linked accounts), never a single new couple. A
-- rare false link (e.g. an event planner using one laptop for several couples) is
-- harmless — shadow mode means an admin just dismisses it.
-- ============================================================================

-- 1. Allow the new integrity_flags kind (a WATCH row — no auto-enforcement).
ALTER TABLE public.integrity_flags DROP CONSTRAINT IF EXISTS integrity_flags_kind_check;
ALTER TABLE public.integrity_flags
  ADD CONSTRAINT integrity_flags_kind_check
  CHECK (kind IN ('review_fraud', 'ghost_listing', 'inquiry_concentration'));

-- The shape CHECK gated subject_review_id by kind; inquiry_concentration carries
-- no review, like ghost_listing.
ALTER TABLE public.integrity_flags DROP CONSTRAINT IF EXISTS integrity_flags_kind_shape;
ALTER TABLE public.integrity_flags
  ADD CONSTRAINT integrity_flags_kind_shape CHECK (
    (kind = 'review_fraud'          AND subject_review_id IS NOT NULL) OR
    (kind = 'ghost_listing'         AND subject_review_id IS NULL) OR
    (kind = 'inquiry_concentration' AND subject_review_id IS NULL)
  );

-- 2. detect_inquiry_concentration — find (vendor, cluster) pairs where one linked
--    cluster hit one vendor via ≥ p_min_accounts distinct accounts in the window,
--    and raise a deduped admin flag for each. Returns the number of NEW flags.
CREATE OR REPLACE FUNCTION public.detect_inquiry_concentration(
  p_window        INTERVAL DEFAULT INTERVAL '14 days',
  p_min_accounts  INT      DEFAULT 3
) RETURNS INT AS $$
DECLARE
  v_inserted INT;
BEGIN
  WITH recent AS (
    -- Each recent inquiry → the inquiring couple → their identity cluster.
    SELECT ct.vendor_profile_id,
           em.user_id AS couple_user_id,
           ic.cluster_id
    FROM public.chat_threads ct
    JOIN public.event_members em
      ON em.event_id = ct.event_id AND em.member_type = 'couple'
    JOIN public.identity_clusters ic
      ON ic.user_id = em.user_id
    WHERE ct.created_at > now() - p_window
  ),
  concentration AS (
    SELECT vendor_profile_id,
           cluster_id,
           COUNT(DISTINCT couple_user_id) AS distinct_accounts
    FROM recent
    GROUP BY vendor_profile_id, cluster_id
    HAVING COUNT(DISTINCT couple_user_id) >= GREATEST(p_min_accounts, 2)
  ),
  inserted AS (
    INSERT INTO public.integrity_flags
      (kind, subject_vendor_id, subject_review_id, score, reason, detail)
    SELECT
      'inquiry_concentration',
      c.vendor_profile_id,
      NULL,
      LEAST(100, 45 + c.distinct_accounts * 15)::smallint,
      'sock_puppet_concentration',
      jsonb_build_object(
        -- Opaque, non-PII cluster handle (never the raw user id).
        'cluster_label', left(md5(c.cluster_id::text), 12),
        'distinct_accounts', c.distinct_accounts,
        'window_days', GREATEST(1, (extract(epoch FROM p_window) / 86400)::int),
        'note', 'Targeted vendor is the VICTIM of a linked-account cluster — do NOT penalize this vendor.'
      )
    FROM concentration c
    WHERE NOT EXISTS (
      -- Dedup: one OPEN flag per (vendor, cluster) — refresh-safe re-runs.
      SELECT 1 FROM public.integrity_flags f
      WHERE f.kind = 'inquiry_concentration'
        AND f.subject_vendor_id = c.vendor_profile_id
        AND f.status = 'open'
        AND f.detail->>'cluster_label' = left(md5(c.cluster_id::text), 12)
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  RETURN COALESCE(v_inserted, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.detect_inquiry_concentration(INTERVAL, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_inquiry_concentration(INTERVAL, INT) TO service_role;

COMMENT ON FUNCTION public.detect_inquiry_concentration(INTERVAL, INT) IS
  'Phase E slice 2 (shadow mode). Raises an integrity_flags(kind=inquiry_concentration) WATCH row for each (vendor, identity_cluster) where one linked cluster inquired to one vendor via >= p_min_accounts distinct accounts in the window. Human-review only — never quarantines. Deduped on (vendor, opaque cluster_label) while open. Run AFTER refresh_identity_clusters().';
