-- checkin_desk_access
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🛂 WHO RUNS THE CHECK-IN DESK (owner 16 Nov 2026, "Yes, as drawn": *"checkin desk for all suppliers and
-- coordinators and guests? a coordinator/host control?"* — DECISION_LOG, specs 9f6ff16e; prototype
-- prototypes/event_pages_guests_doors_2026-11-16/…_fable.html § "Check-in desk (three parts)").
--
-- The desk becomes one desk with three parts (Guests · Suppliers · Team). A ⚙ on it opens "Who runs the desk": hosts
-- always (every part); the coordinator, helpers and ONE supplier at the door each get the parts the hosts choose.
--
-- ── WHY A COLUMN AT ALL (the house rule: a migration only if truly needed) ───────────────────────────────────────────
-- Every other fact the desk shows already has a home and is only READ: arrivals are `guest_checkins`, a supplier's
-- status is the shipped day-requests presets (`event_day_requests.preset_key`), their promised arrival is
-- `supplier_own_times.arrive_clock`, who worked the desk is `guest_checkins.checked_in_by_user_id`. The hosts' CHOICE
-- of who may open which part exists nowhere — no column, setting or grant encodes "a helper may see Guests but not
-- Suppliers". This is that one new fact.
--
-- Shape (lib/checkin-desk.ts `parseDeskAccess` / `serializeDeskAccess` is the only reader and writer):
--   { "coordinator": ["guests","suppliers","team"], "helpers": ["guests"], "door": {"user_id": "<uuid>", "parts": [...]} | null }
-- NULL (the default) = never set = owner answer 3's start: coordinator all three, helpers Guests, a supplier Off.
--
-- ── WHO MAY READ AND WRITE IT: THE SERVICE ROLE ONLY ─────────────────────────────────────────────────────────────────
-- `public.events` re-grants columns one by one (20271007100000); this column gets NO user grant, on purpose (the
-- `papic_phone_uploads_held` pattern, 20271345220516). It is read by the desk page only after the viewer is proven door
-- crew of THIS event, and written by `saveDeskAccess` only after the caller is proven a HOST of it. A grant would let
-- any member update it past that check (the events UPDATE policy is not host-only for every seat). It is listed in
-- `scripts/lint-events-column-grants.mjs` NO_GRANT_NEEDED with that reason.
--
-- ADD-ONLY: one nullable column; nothing existing is altered or dropped. No RLS change (no new table).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS checkin_desk_access JSONB NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_checkin_desk_access_is_object') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_checkin_desk_access_is_object
      CHECK (checkin_desk_access IS NULL OR jsonb_typeof(checkin_desk_access) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.events.checkin_desk_access IS
  'Who runs the Check-in desk (owner 2026-11-16): which desk parts (guests · suppliers · team) the coordinator, helpers '
  'and one supplier at the door may open. Hosts always open every part. NULL = defaults (coordinator all, helpers '
  'guests, supplier off). Service-role only — read after the door-crew check, written after the host check.';

-- ── PROOF — it proves itself on apply ───────────────────────────────────────
DO $$
BEGIN
  IF has_column_privilege('anon', 'public.events', 'checkin_desk_access', 'SELECT') THEN
    RAISE EXCEPTION 'checkin_desk_access: anon can read it — no guest reader needs it';
  END IF;
  IF has_column_privilege('authenticated', 'public.events', 'checkin_desk_access', 'UPDATE') THEN
    RAISE EXCEPTION 'checkin_desk_access: authenticated can write it — only saveDeskAccess, after the host check, may';
  END IF;
END $$;
