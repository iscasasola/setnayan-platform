-- ============================================================================
-- 20261210000000_hard_single_lock_guard.sql
--
-- HARD-SINGLE DOUBLE-LOCK GUARD — the last app-level cross-actor invariant
-- from the 2026-06-04 conflict audit, now enforced in the DB.
--
-- finalizeVendor enforces "exactly one CONFIRMED vendor per hard-single plan
-- group per event" (ceremony_venue · reception_venue · officiant ·
-- coordinator · host_mc · led_background) with an app-level read-then-write:
-- it reads locked siblings, then writes status='contracted'. Two hosts of the
-- SAME event (a couple member + a moderator) finalizing two different vendors
-- in one hard-single group concurrently can both pass the sibling check and
-- both lock. Blast radius is low (white soft-holds, no money, self-correcting)
-- but it's the only confirmed-status write not serialized by the DB.
--
-- Approach A (owner-approved 2026-06-13): a GENERATED STORED column that maps
-- the 7 hard-single categories to their 6 groups, plus a partial-unique index
-- on (event_id, hard_single_group) over the live CONFIRMED set. This is
-- PATH-INDEPENDENT — it catches the second confirmed write no matter which
-- code path makes it (the generic finalize lock write, the
-- acquire_service_time_slot slot path, a deposit_paid flip, or an admin
-- approval) — auto-backfills every existing row, and needs no changes at the
-- many event_vendors INSERT sites. The category→group map is the SAME 7
-- literals finalizeVendor's planGroupForCategory resolves (the full PLAN_GROUPS
-- map stays in TS — only these 7 hard-single rows are mirrored here); an
-- unmapped future category yields NULL and is simply un-guarded — never worse
-- than today's no-guard state. The companion app change converts the
-- resulting 23505 into the existing hard_single_conflict modal so the UX is
-- unchanged.
--
-- Canonical: HARD_SINGLE_PICK_GROUPS in apps/web/lib/wedding-plan-groups.ts;
-- conflict-architecture memory + DECISION_LOG 2026-06-13.
-- ============================================================================

BEGIN;

-- Defensive pre-dedupe so the unique index can always build: if any event
-- somehow already holds 2+ CONFIRMED non-archived rows in one hard-single
-- group, keep the earliest-locked and demote the rest to 'considering' (the
-- same semantics as finalizeVendor's Switch flow — the research stays on the
-- card, it just stops double-occupying the slot). Verified 0 such rows on
-- prod at authoring time, so this is expected to be a no-op; it guards against
-- a row landing between authoring and apply.
WITH mapped AS (
  SELECT event_id, vendor_id, created_at,
    CASE category
      WHEN 'religious_venue'    THEN 'ceremony_venue'
      WHEN 'church_fees'        THEN 'ceremony_venue'
      WHEN 'venue'              THEN 'reception_venue'
      WHEN 'officiant'          THEN 'officiant'
      WHEN 'planner_coordinator' THEN 'coordinator'
      WHEN 'host_emcee'         THEN 'host_mc'
      WHEN 'led_screens'        THEN 'led_background'
    END AS grp
  FROM public.event_vendors
  WHERE archived_at IS NULL
    AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
    AND category IN ('religious_venue','church_fees','venue','officiant',
                     'planner_coordinator','host_emcee','led_screens')
),
ranked AS (
  SELECT event_id, vendor_id,
         row_number() OVER (
           PARTITION BY event_id, grp
           ORDER BY created_at, vendor_id
         ) AS rn
  FROM mapped
)
UPDATE public.event_vendors ev
SET status = 'considering', updated_at = NOW()
FROM ranked
WHERE ev.event_id = ranked.event_id
  AND ev.vendor_id = ranked.vendor_id
  AND ranked.rn > 1;

-- The generated mapping column. category is the vendor_category enum; the
-- WHEN literals are coerced to it. STORED so the partial index can key on it.
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS hard_single_group TEXT
  GENERATED ALWAYS AS (
    CASE category
      WHEN 'religious_venue'    THEN 'ceremony_venue'
      WHEN 'church_fees'        THEN 'ceremony_venue'
      WHEN 'venue'              THEN 'reception_venue'
      WHEN 'officiant'          THEN 'officiant'
      WHEN 'planner_coordinator' THEN 'coordinator'
      WHEN 'host_emcee'         THEN 'host_mc'
      WHEN 'led_screens'        THEN 'led_background'
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.event_vendors.hard_single_group IS
  'Generated mirror of the 7 hard-single categories → 6 HARD_SINGLE_PICK_GROUPS (apps/web/lib/wedding-plan-groups.ts). Drives event_vendors_hard_single_lock_uniq. NULL for non-hard-single categories (un-guarded by design). Keep in sync if a category joins/leaves a hard-single group.';

-- One CONFIRMED, non-archived vendor per (event, hard_single_group). The
-- predicate matches finalizeVendor's sibling check (CONFIRMED set, archived
-- excluded); the partial scope lets an event keep many 'considering' picks in
-- the same group, and one confirmed row per OTHER group.
CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_hard_single_lock_uniq
  ON public.event_vendors (event_id, hard_single_group)
  WHERE hard_single_group IS NOT NULL
    AND archived_at IS NULL
    AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

COMMIT;
