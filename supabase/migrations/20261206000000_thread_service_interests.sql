-- ============================================================================
-- 20261206000000_thread_service_interests.sql
-- Multi-service inquiry mapping — structured per-service interest context on a
-- single couple↔vendor chat thread.
--
-- Owner-locked 2026-06-12 (DECISION_LOG.md "🔗 Link-gated build cascade +
-- multi-service inquiry mapping"). Owner ruleset: an inquiry can be
-- single-service, linked-services, OR carry extra "mark for inquiry too"
-- services the couple adds — ALL converging into the ONE
-- `chat_threads UNIQUE(event_id, vendor_profile_id)` thread, with the
-- burn-on-answer unlock staying 1× per (vendor,event). This table records WHICH
-- services a given thread is inquiring about + WHERE each interest came from, so
-- both sides can render an "Inquiring about: Catering · Cake · Mobile Bar" chip
-- row and the vendor can offer extra services back (vendor_offered).
--
-- It is metadata on the existing single thread + single unlock — it does NOT
-- spawn extra threads and does NOT touch the token/accept flow (a re-accept of
-- an already-unlocked (vendor,event) is free + un-gated, so cross-sell can never
-- double-charge — verified in chat-actions.ts acceptInquiry).
--
-- vendor_service_id is NULLABLE: a category-level interest may predate a
-- concrete vendor_services row (or the service may be deleted later — ON DELETE
-- SET NULL preserves the interest as a category_key string). category_key
-- follows the cross-vocabulary convention noted in DECISION_LOG 2026-06-12
-- "Vendor Services picker cutover" (canonical/tile/legacy string, TEXT no FK —
-- same shape as vendor_service_links.linked_canonical_service).
--
-- RLS — mirrors the chat_messages member-read/insert conventions
-- (20260513130000_iteration_0019_communications.sql). The interest row carries
-- only thread_id, so every policy maps through chat_threads (which BOTH parties
-- can already SELECT via chat_threads_member_read). No new RLS pattern, no
-- SECURITY DEFINER reader needed: a plain query satisfies both couple
-- (current_couple_event_ids on the thread's event) and vendor
-- (current_vendor_profile_ids on the thread's vendor) cleanly.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. thread_service_interests — one row per (thread, service-or-category)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.thread_service_interests (
  interest_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          UUID NOT NULL
                     REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  -- Nullable: a category-level interest may predate a concrete service row, or
  -- the service may later be deleted (ON DELETE SET NULL keeps the interest as
  -- a category_key string rather than vanishing).
  vendor_service_id  UUID
                     REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL,
  -- Canonical/tile/legacy category string — for display + for when
  -- vendor_service_id is null. TEXT, no FK (taxonomy keys aren't a single
  -- unique column we can FK into; same convention as
  -- vendor_service_links.linked_canonical_service).
  category_key       TEXT,
  source             TEXT NOT NULL
                     CHECK (source IN ('initial','linked','couple_added','vendor_offered')),
  status             TEXT NOT NULL DEFAULT 'asked'
                     CHECK (status IN ('asked','quoted','declined','withdrawn')),
  added_by_role      TEXT NOT NULL CHECK (added_by_role IN ('couple','vendor')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One interest row per concrete service per thread. NULL vendor_service_id
  -- rows are NOT de-duplicated by this constraint (Postgres treats NULLs as
  -- distinct) — category-only interests guard against dupes in the app layer.
  UNIQUE (thread_id, vendor_service_id)
);

CREATE INDEX IF NOT EXISTS thread_service_interests_thread_idx
  ON public.thread_service_interests (thread_id);

ALTER TABLE public.thread_service_interests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS — map through chat_threads (both parties can read their own threads)
-- ----------------------------------------------------------------------------

-- READ — either party in the parent thread. The subquery resolves the set of
-- thread_ids the caller belongs to (couple via current_couple_event_ids on the
-- thread's event, vendor via current_vendor_profile_ids on the thread's
-- vendor) — identical predicate to chat_threads_member_read.
DROP POLICY IF EXISTS thread_service_interests_member_read ON public.thread_service_interests;
CREATE POLICY thread_service_interests_member_read
  ON public.thread_service_interests FOR SELECT
  TO authenticated
  USING (
    thread_id IN (
      SELECT t.thread_id FROM public.chat_threads t
      WHERE t.event_id IN (SELECT public.current_couple_event_ids())
         OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- INSERT — couple party may insert added_by_role='couple' with
-- source in ('initial','linked','couple_added'); vendor party may insert
-- added_by_role='vendor' with source='vendor_offered'. The role↔source↔thread
-- ownership is enforced together so a couple can't forge a vendor_offered row
-- (or vice-versa) on a thread that isn't theirs.
DROP POLICY IF EXISTS thread_service_interests_member_insert ON public.thread_service_interests;
CREATE POLICY thread_service_interests_member_insert
  ON public.thread_service_interests FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      added_by_role = 'couple'
      AND source IN ('initial','linked','couple_added')
      AND thread_id IN (
        SELECT t.thread_id FROM public.chat_threads t
        WHERE t.event_id IN (SELECT public.current_couple_event_ids())
      )
    )
    OR (
      added_by_role = 'vendor'
      AND source = 'vendor_offered'
      AND thread_id IN (
        SELECT t.thread_id FROM public.chat_threads t
        WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      )
    )
  );

-- UPDATE — either party may move the status of interests on their own threads
-- (couple withdraws; vendor quotes/declines). Both USING + WITH CHECK gate on
-- thread membership so neither side can re-home a row onto a thread they're not
-- in. The role/source columns aren't re-validated here (only status moves in
-- practice); thread ownership is the security boundary.
DROP POLICY IF EXISTS thread_service_interests_member_update ON public.thread_service_interests;
CREATE POLICY thread_service_interests_member_update
  ON public.thread_service_interests FOR UPDATE
  TO authenticated
  USING (
    thread_id IN (
      SELECT t.thread_id FROM public.chat_threads t
      WHERE t.event_id IN (SELECT public.current_couple_event_ids())
         OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  )
  WITH CHECK (
    thread_id IN (
      SELECT t.thread_id FROM public.chat_threads t
      WHERE t.event_id IN (SELECT public.current_couple_event_ids())
         OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

COMMIT;
