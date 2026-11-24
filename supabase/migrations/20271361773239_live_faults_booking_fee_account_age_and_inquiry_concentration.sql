-- live faults: booking fee account age and inquiry concentration
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION + REVOKE/GRANT only. No table, no column,
-- no data is written. Two live faults from app_telemetry_logs (read 23 Nov 2026), each fixed at its source.
--
-- ── 1 · `POST rpc/booking_fee_attribution_for` → 42501 "permission denied for table users" (admin client, 403) ──────
--   Cause: 20271353556136 (owner Q1, the invite timestamp) taught `booking_fee_import_created_account` to compare each
--   couple member's ACCOUNT AGE with the import's invite — a JOIN on `auth.users`. The function is SECURITY INVOKER and
--   its only caller is the service role (fee rule B: `booking_fee_attribution_for`, the lock, the disclosure). In
--   production `service_role` holds no SELECT on `auth.users` (checked read-only 24 Nov: has_table_privilege → false;
--   the owner `postgres` → true), so every attribution that reached this arm FAILED — the supplier's fee notice fell
--   back to "Couldn't read" (`resolveBookingFeeStanding` → 'unreadable'), and a lock asking it raised.
--   Fix: the same function, body VERBATIM from 20271353556136, made SECURITY DEFINER with the pinned search_path — the
--   house shape for a service-role-only function that must read auth (e.g. 20271353556136's own
--   `booking_fee_take_import_slot_from_thread`). It stays locked to service_role (REVOKE from PUBLIC/anon/authenticated
--   below, as before), so nobody new can call it, and `auth.users` is not opened to anyone. It returns one boolean.
--   Guard: apps/web/tests/db/live-faults-run-as-their-callers.db.test.ts (1), as service_role.
--
-- ── 2 · `POST rpc/detect_inquiry_concentration` → 23502 "null value … violates not-null constraint" (admin) ──────────
--   Cause: 20271340374819 (event group chats) made `chat_threads.vendor_profile_id` NULLABLE — a group chat has no
--   supplier. The detector counted EVERY recent thread as "an inquiry to a supplier", so a linked cluster of couples in
--   group chats grouped under vendor NULL and the INSERT wrote `integrity_flags.subject_vendor_id = NULL` (NOT NULL).
--   One bad row aborts the whole statement, so NO concentration flag has been raised since. (Prod, 24 Nov: 27 group
--   threads with no supplier from clustered couples in the 14-day window.)
--   Fix: an inquiry is a thread TO A SUPPLIER — `ct.vendor_profile_id IS NOT NULL`. Body otherwise verbatim from
--   20270728339269, with 20270730363797's `SET search_path = public` folded into the definition.
--   Guard: the same test (2).

BEGIN;

-- ── 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_import_created_account(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.event_members m
        WHERE m.event_id = p_event_id AND m.member_type = 'couple'
     )
     -- Q1: with a per-couple invite, no couple member's account is older than the invite.
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_members m
         JOIN auth.users u ON u.id = m.user_id
        WHERE m.event_id = p_event_id
          AND m.member_type = 'couple'
          AND a.invite_at IS NOT NULL
          AND u.created_at < a.invite_at
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_members m
         JOIN public.event_members mo
           ON mo.user_id = m.user_id
          AND mo.member_type = 'couple'
          AND mo.event_id <> p_event_id
         JOIN public.events oe ON oe.event_id = mo.event_id
         JOIN public.events e ON e.event_id = p_event_id
        WHERE m.event_id = p_event_id
          AND m.member_type = 'couple'
          AND oe.created_at <= e.created_at
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.event_vendors x
        WHERE x.event_id = p_event_id AND x.created_at < a.at
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_threads t
        WHERE t.event_id = p_event_id AND t.created_at < a.at
     )
    FROM (SELECT public.booking_fee_import_at(p_vendor_profile_id, p_event_id) AS at,
                 public.booking_fee_import_invite_at(p_vendor_profile_id, p_event_id) AS invite_at) a;
$$;
COMMENT ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) IS
  'True when this supplier''s import onto the event brought the client onto Setnayan: no couple member''s account is '
  'older than the import''s per-couple invite (owner Q1, when there is one), the event is the first of every couple '
  'member, and the import is the first shop row and precedes every chat on it. Fails toward the fee. SECURITY DEFINER '
  'because the account age is auth.users.created_at, which the service role (its only caller) cannot read; locked to '
  'service_role.';
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) TO service_role;

-- ── 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detect_inquiry_concentration(
  p_window        INTERVAL DEFAULT INTERVAL '14 days',
  p_min_accounts  INT      DEFAULT 3
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- An inquiry is a thread TO A SUPPLIER. A group chat (20271340374819) has none, and counting it grouped every
      -- cluster's group chats under vendor NULL and wrote a NULL subject_vendor_id (23502), failing the whole run.
      AND ct.vendor_profile_id IS NOT NULL
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
$$;

REVOKE ALL ON FUNCTION public.detect_inquiry_concentration(INTERVAL, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_inquiry_concentration(INTERVAL, INT) TO service_role;

COMMENT ON FUNCTION public.detect_inquiry_concentration(INTERVAL, INT) IS
  'Phase E slice 2 (shadow mode). Raises an integrity_flags(kind=inquiry_concentration) WATCH row for each (vendor, identity_cluster) where one linked cluster inquired to one vendor via >= p_min_accounts distinct accounts in the window. Counts only threads TO A SUPPLIER (vendor_profile_id set; a group chat is not an inquiry). Human-review only — never quarantines. Deduped on (vendor, opaque cluster_label) while open. Run AFTER refresh_identity_clusters().';

COMMIT;
