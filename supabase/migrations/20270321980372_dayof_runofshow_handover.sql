-- ============================================================================
-- 20270321980372_dayof_runofshow_handover.sql
--
-- Day-Of Run-of-Show & Handover · Wave 4 of the "Soon" vendor benefits.
--
-- TWO operational layers (no money, no gateway, 0% commission untouched):
--
--   PART 1 — LIVE RUN-OF-SHOW. Adds actual-time + run-state columns to the
--   shared day-of timeline (event_schedule_blocks) and a single-winner
--   advance_schedule_block() RPC that marks the running block done and lights
--   the next one live. The host/coordinator (and the booked vendor) drive the
--   "now / next / running ±N min" header off these fields. Vendors NEVER write
--   the timeline directly — they still PROPOSE via event_schedule_suggestions
--   (the existing Suggest flow). advance_schedule_block is the ONLY new write
--   path, gated to host/coordinator ∪ booked vendor and serialized.
--
--   PART 2 — DELIVERY HANDOVER. New booking_handovers table: a vendor posts a
--   gallery link / file / note / sign-off; the couple confirms receipt. The
--   acknowledge_handover() RPC is single-winner (FOR UPDATE + status='delivered'
--   precondition + GET DIAGNOSTICS ROW_COUNT + idempotent), modeled EXACTLY on
--   acknowledge_vendor_deposit (20270320429117) and respond_vendor_proposal
--   (20261209000000). On couple-acknowledge the app layer optionally advances
--   event_vendors.status→'delivered' by REUSING the existing delivered
--   transition + review-request emit (updateVendorStatus) — this migration adds
--   NO duplicate review emit and moves NO money.
--
-- OFF-PLATFORM (owner lock): everything here is OPERATIONAL — run-state +
-- delivery acknowledgement paper trail. R2 is the record for uploaded files;
-- large galleries stay external links (payload holds the URL, not the media).
--
-- RLS AT CREATE TIME with canonical helpers (current_event_ids,
-- current_vendor_booked_event_ids, current_vendor_profile_ids, is_admin).
-- Idempotent + re-run safe.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 · LIVE RUN-OF-SHOW
-- ----------------------------------------------------------------------------

-- 1.1 · run-state enum (upcoming → live → done). Created defensively so the
--       migration re-runs cleanly.
DO $$ BEGIN
  CREATE TYPE public.schedule_run_state AS ENUM ('upcoming', 'live', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1.2 · actual-time + run-state columns on the shared timeline. Nullable
--       timestamps + a defaulted run_state — orthogonal to the planned
--       start_at/end_at (those stay the schedule; these capture what ACTUALLY
--       happened so the header can show "running 12 min late").
ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS run_state       public.schedule_run_state NOT NULL DEFAULT 'upcoming';

COMMENT ON COLUMN public.event_schedule_blocks.actual_start_at IS
  'Day-of run-of-show — wall-clock the block ACTUALLY went live (set by advance_schedule_block). NULL until started. Distinct from the planned start_at; the header derives "running ±N min" from (actual_start_at − start_at).';
COMMENT ON COLUMN public.event_schedule_blocks.actual_end_at IS
  'Day-of run-of-show — wall-clock the block was marked done (set by advance_schedule_block). NULL until done.';
COMMENT ON COLUMN public.event_schedule_blocks.run_state IS
  'Day-of run-of-show — upcoming | live | done. Advanced by advance_schedule_block (host/coordinator or booked vendor). The "now / next" header reads this; realtime via a Supabase channel on this table.';

-- A booked vendor already gets a READ on event_schedule_blocks via
-- event_schedule_blocks_booked_vendor_read (20261130003000). The new columns
-- are covered by that SELECT automatically (RLS is row-, not column-scoped).
-- advance_schedule_block is SECURITY DEFINER and does its OWN auth gate, so
-- vendors never get a direct UPDATE policy on the timeline (no 2-way write).

-- 1.3 · advance_schedule_block — single-winner run-state primitive, ONE call
--       that handles both START and ADVANCE so there's a single write path:
--
--         • START  — target is 'upcoming' AND nothing on the event is 'live':
--                    light the target (run_state='live', actual_start_at=now).
--                    (The header only offers this on the earliest upcoming
--                    block, but the RPC stays robust if any upcoming is passed.)
--         • ADVANCE — target is 'live': mark it done (run_state='done',
--                    actual_end_at=now) AND light the next 'upcoming' block (by
--                    sort_order, then start_at) live.
--
--       Serialized with SELECT … FOR UPDATE + run_state preconditions in every
--       UPDATE WHERE so concurrent taps are single-winner; an already-done block
--       (and a re-tap that lost the race) returns a benign no-op.
--
--       AUTH (DEFINER, granted to authenticated → gate explicitly): the caller
--       must be a host/couple/coordinator on the event (current_event_ids) OR a
--       booked vendor on it (current_vendor_booked_event_ids) OR admin.
CREATE OR REPLACE FUNCTION public.advance_schedule_block(
  p_block_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_run_state  public.schedule_run_state;
  v_sort_order INT;
  v_start_at   TIMESTAMPTZ;
  v_rows       INTEGER;
  v_live_count INTEGER;
  v_next_id    UUID;
BEGIN
  -- FOR UPDATE serializes concurrent advancers (double-tap / two devices): the
  -- second waits, re-reads the now-changed row, and is caught by the idempotent
  -- branches below.
  SELECT event_id, run_state, sort_order, start_at
    INTO v_event_id, v_run_state, v_sort_order, v_start_at
    FROM public.event_schedule_blocks
   WHERE block_id = p_block_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'block_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership — host/coordinator (event membership) ∪ booked vendor ∪ admin.
  IF v_event_id NOT IN (SELECT public.current_event_ids())
     AND v_event_id NOT IN (SELECT public.current_vendor_booked_event_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_on_this_event' USING ERRCODE = '42501';
  END IF;

  -- IDEMPOTENCY: an already-done block is a benign no-op (single-winner already
  -- won) — return gracefully so a retry/double-tap still shows "done".
  IF v_run_state = 'done' THEN
    RETURN jsonb_build_object('status', 'already', 'block_id', p_block_id);
  END IF;

  -- ── START branch ─────────────────────────────────────────────────────────
  -- Target is 'upcoming'. Only START it (don't mark done) when NOTHING on the
  -- event is currently live — otherwise an 'upcoming' target is a no-op (the
  -- caller should advance the live block first). run_state='upcoming' in the
  -- WHERE is the single-winner gate.
  IF v_run_state = 'upcoming' THEN
    SELECT count(*) INTO v_live_count
      FROM public.event_schedule_blocks
     WHERE event_id = v_event_id AND run_state = 'live';
    IF v_live_count > 0 THEN
      RETURN jsonb_build_object('status', 'noop_live_in_progress', 'block_id', p_block_id);
    END IF;
    UPDATE public.event_schedule_blocks
       SET run_state       = 'live',
           actual_start_at = COALESCE(actual_start_at, NOW()),
           updated_at      = NOW()
     WHERE block_id = p_block_id
       AND run_state = 'upcoming';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN jsonb_build_object('status', 'already', 'block_id', p_block_id);
    END IF;
    RETURN jsonb_build_object('status', 'started', 'block_id', p_block_id);
  END IF;

  -- ── ADVANCE branch (target is 'live') ────────────────────────────────────
  -- Mark this block done. run_state='live' in the WHERE is the single-winner
  -- gate (defense in depth alongside FOR UPDATE) — atomic even if the lock is
  -- ever removed.
  UPDATE public.event_schedule_blocks
     SET run_state     = 'done',
         actual_end_at = NOW(),
         updated_at    = NOW()
   WHERE block_id = p_block_id
     AND run_state = 'live';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race between the FOR UPDATE read and the UPDATE (only possible if
    -- the lock is removed) — report already-done.
    RETURN jsonb_build_object('status', 'already', 'block_id', p_block_id);
  END IF;

  -- Light the NEXT block live (by sort_order, then start_at). Only an
  -- 'upcoming' block strictly after this one is promoted, so re-advancing
  -- earlier in the list never resurrects a finished block.
  SELECT block_id
    INTO v_next_id
    FROM public.event_schedule_blocks
   WHERE event_id = v_event_id
     AND run_state = 'upcoming'
     AND (sort_order, start_at, block_id) > (v_sort_order, v_start_at, p_block_id)
   ORDER BY sort_order ASC, start_at ASC, block_id ASC
   LIMIT 1
   FOR UPDATE;

  IF v_next_id IS NOT NULL THEN
    UPDATE public.event_schedule_blocks
       SET run_state       = 'live',
           actual_start_at = COALESCE(actual_start_at, NOW()),
           updated_at      = NOW()
     WHERE block_id = v_next_id
       AND run_state = 'upcoming';
  END IF;

  RETURN jsonb_build_object(
    'status',   'ok',
    'block_id', p_block_id,
    'next_id',  v_next_id);
END;
$$;

REVOKE ALL ON FUNCTION public.advance_schedule_block(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_schedule_block(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_schedule_block(UUID) TO authenticated;

COMMENT ON FUNCTION public.advance_schedule_block(UUID) IS
  'Day-of run-of-show advance: marks the given timeline block done + lights the next live. Single-winner (SELECT FOR UPDATE + run_state<>done precondition UPDATE + ROW_COUNT), idempotent (already-done → no-op). Auth: host/coordinator (current_event_ids) ∪ booked vendor (current_vendor_booked_event_ids) ∪ admin. The ONLY new write path into event_schedule_blocks for vendors — they otherwise only PROPOSE via event_schedule_suggestions (no 2-way write).';

-- ----------------------------------------------------------------------------
-- PART 2 · DELIVERY HANDOVER
-- ----------------------------------------------------------------------------

-- 2.1 · booking_handovers — vendor posts a deliverable (gallery link / file /
--       note / sign-off); couple confirms receipt. event_vendor_id is the
--       booked event_vendors row (its vendor_id PK) — not FK'd, same additive,
--       decoupled pattern as event_vendor_policy_acknowledgements.event_vendor_id.
CREATE TABLE IF NOT EXISTS public.booking_handovers (
  handover_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The booked event_vendors row (event_vendors.vendor_id PK).
  event_vendor_id        UUID NOT NULL,
  -- The event the booking belongs to — the couple-RLS anchor.
  event_id               UUID NOT NULL
                         REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Denormalized marketplace vendor (event_vendors.marketplace_vendor_id) so the
  -- vendor-write RLS + admin dispute join resolve by vendor_profile_id directly.
  vendor_profile_id      UUID,
  -- What the vendor delivered:
  --   gallery_link → payload is an external URL (Drive/Pixieset/etc.)
  --   file         → payload is an R2/Storage object public URL
  --   note         → payload is free text
  --   signoff      → payload is an optional closing note ("all delivered")
  kind                   TEXT NOT NULL CHECK (kind IN ('gallery_link', 'file', 'note', 'signoff')),
  -- Optional short label/title for the couple's list.
  label                  TEXT CHECK (label IS NULL OR char_length(label) <= 200),
  -- The deliverable: R2 object URL, external link, or text (see kind).
  payload                TEXT CHECK (payload IS NULL OR char_length(payload) <= 4000),
  delivered_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set by the couple via acknowledge_handover — confirmed receipt.
  couple_acknowledged_at TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'delivered'
                         CHECK (status IN ('delivered', 'acknowledged', 'disputed')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_handovers_event_vendor_idx
  ON public.booking_handovers (event_vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_handovers_event_idx
  ON public.booking_handovers (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_handovers_vendor_profile_idx
  ON public.booking_handovers (vendor_profile_id, created_at DESC);

-- RLS AT CREATE TIME.
ALTER TABLE public.booking_handovers ENABLE ROW LEVEL SECURITY;

-- Vendor: INSERT a handover only on events they're BOOKED on, for their OWN
-- profile, status starting at 'delivered'. Mirrors the schedule_suggestions
-- vendor-insert gate (current_vendor_booked_event_ids ∩ current_vendor_profile_ids).
DROP POLICY IF EXISTS booking_handovers_vendor_insert ON public.booking_handovers;
CREATE POLICY booking_handovers_vendor_insert
  ON public.booking_handovers FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND status = 'delivered'
  );

-- Vendor: READ their own org's handovers.
DROP POLICY IF EXISTS booking_handovers_vendor_read ON public.booking_handovers;
CREATE POLICY booking_handovers_vendor_read
  ON public.booking_handovers FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Couple/host/coordinator + admin: READ every handover on their events.
DROP POLICY IF EXISTS booking_handovers_couple_read ON public.booking_handovers;
CREATE POLICY booking_handovers_couple_read
  ON public.booking_handovers FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- Couple/host/coordinator: the ACK (status flip) goes through
-- acknowledge_handover (SECURITY DEFINER, single-winner), not a direct table
-- UPDATE — so there is deliberately NO couple FOR-UPDATE policy here. The DEFINER
-- RPC does its own current_event_ids gate. (No vendor UPDATE/DELETE either — a
-- handover is corrected by posting a new row, keeping the trail append-only.)

COMMENT ON TABLE public.booking_handovers IS
  'Delivery handover (Wave 4 day-of vendor benefits): a vendor posts a deliverable (gallery_link / file / note / signoff) on a booked event; the couple confirms receipt via acknowledge_handover. Operational only — no money. R2 URL for uploaded files; galleries stay external links. RLS: vendor insert+read own (current_vendor_booked_event_ids ∩ current_vendor_profile_ids); couple read via current_event_ids; admin via is_admin; ack is the DEFINER RPC, not a direct UPDATE.';

-- 2.2 · acknowledge_handover — COUPLE single-winner confirm-receipt RPC.
--       Modeled EXACTLY on acknowledge_vendor_deposit (20270320429117):
--         SELECT … FOR UPDATE  → serializes concurrent acks
--         precondition guard   → status='delivered'
--         UPDATE … WHERE status='delivered' + ROW_COUNT → atomic single-winner
--         idempotent re-call    → already-acknowledged returns status=already
CREATE OR REPLACE FUNCTION public.acknowledge_handover(
  p_handover_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id        UUID;
  v_event_vendor_id UUID;
  v_status          TEXT;
  v_rows            INTEGER;
BEGIN
  -- FOR UPDATE serializes concurrent acknowledgers (double-click / two tabs):
  -- the second waits, re-reads the now-acked row, and is caught by the
  -- idempotent branch below.
  SELECT event_id, event_vendor_id, status
    INTO v_event_id, v_event_vendor_id, v_status
    FROM public.booking_handovers
   WHERE handover_id = p_handover_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'handover_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership — DEFINER + granted to authenticated, so gate explicitly. Only a
  -- host/couple/coordinator on the event (or admin) may confirm receipt.
  IF v_event_id NOT IN (SELECT public.current_event_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  -- IDEMPOTENCY: a re-call on an already-acknowledged row returns gracefully
  -- (the single-winner already won) instead of raising. A 'disputed' row is a
  -- terminal off-path state — surfaced, not silently flipped.
  IF v_status = 'acknowledged' THEN
    RETURN jsonb_build_object(
      'status', 'already', 'handover_id', p_handover_id,
      'event_vendor_id', v_event_vendor_id);
  END IF;
  IF v_status <> 'delivered' THEN
    RETURN jsonb_build_object('status', 'not_ackable', 'current', v_status);
  END IF;

  -- status='delivered' in the WHERE is the single-winner gate (defense in depth
  -- alongside FOR UPDATE) — the transition is atomically single-winner even if
  -- the lock above is ever removed.
  UPDATE public.booking_handovers
     SET status                 = 'acknowledged',
         couple_acknowledged_at = NOW()
   WHERE handover_id = p_handover_id
     AND status = 'delivered';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent winner between the FOR UPDATE read and the
    -- UPDATE (only possible if the lock is removed) — re-read & report.
    SELECT status INTO v_status
      FROM public.booking_handovers WHERE handover_id = p_handover_id;
    RETURN jsonb_build_object(
      'status', 'already', 'handover_id', p_handover_id,
      'event_vendor_id', v_event_vendor_id, 'current', v_status);
  END IF;

  -- Return the booked event_vendor so the app layer can OPTIONALLY advance
  -- event_vendors.status→'delivered' by REUSING updateVendorStatus (which owns
  -- the review-request emit) — this RPC adds NO duplicate emit and moves no money.
  RETURN jsonb_build_object(
    'status', 'ok', 'handover_id', p_handover_id,
    'event_vendor_id', v_event_vendor_id);
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_handover(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acknowledge_handover(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_handover(UUID) TO authenticated;

COMMENT ON FUNCTION public.acknowledge_handover(UUID) IS
  'Couple confirms receipt of a vendor delivery handover. Serialized via SELECT FOR UPDATE + status=delivered precondition UPDATE so concurrent acks are single-winner; idempotent re-call returns status=already. Couple-gated via current_event_ids (or admin). Returns event_vendor_id so the app can OPTIONALLY advance event_vendors.status→delivered by reusing updateVendorStatus (the existing review-request emit) — this RPC duplicates no emit and moves no money.';

-- ----------------------------------------------------------------------------
-- PART 3 · REALTIME — add event_schedule_blocks to the supabase_realtime
-- publication so the shared run-of-show header gets live run_state pushes
-- (cron-free; the header subscribes via a Supabase channel, no poller).
-- Idempotent: guarded by a pg_publication_tables membership check.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_schedule_blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_schedule_blocks;
  END IF;
END $$;

COMMIT;
