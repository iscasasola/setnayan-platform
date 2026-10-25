-- ============================================================================
-- A LIMITED HELPER'S WRITES FOLLOW THE AREAS THE HOST SET (owner 2026-10-26).
--
-- Owner, verbatim: "Limited helpers can view but not change anything. limited
-- helpers capabilities depend on the settings on their event details".
-- By default a limited helper (an event_moderators seat of kind 'viewer') only
-- looks; an AREA the host set to Edit for them in Event Details › Event access
-- (permissions_json.areas, read by public.moderator_area_level) they may change.
--
-- ── WHAT CONTRADICTED IT ────────────────────────────────────────────────────
-- Migration 20271251336140 §7 put RESTRICTIVE `lh_ro_*` policies —
-- `NOT is_limited_helper(event_id)` — on every table whose permissive write
-- policy admits ANY coordinator without an area check (20 tables, measured on
-- prod 2026-10-26). Restrictive policies AND with everything, so on those
-- tables a helper was refused even in an area the host had set to Edit. The 19
-- area-gated tables (guests, event_tables, …) already honour the setting.
--
-- ── WHAT CHANGES ────────────────────────────────────────────────────────────
-- Only the tables that belong to an area the host can set to Edit
-- (lib/delegate-areas.ts `areaChoices`: Guest list · Seat plan · The Day ·
-- Suppliers) get the area added to their refusal:
--     NOT is_limited_helper(event_id)
--       OR moderator_area_level(event_id, '<area>') = 'edit'
--   guest list → guest_checkins, guest_souvenir_claims
--   the day    → event_song_picks (the couple's songs — "The Day … the songs")
--   suppliers  → event_appointments, event_vendor_working_notes,
--                vendor_lock_proposals
-- Every other lh_ro table (Live Studio, Panood, Papic missions, photo
-- messages, the wall display, guest columns, message blocks, vendor reviews,
-- Pakanta drafts) belongs to no area a host can set to Edit, so it keeps the
-- plain refusal — a helper never writes there, exactly as before.
--
-- The same two functions are what the server-action gate asks
-- (lib/limited-helper-gate.ts), so the action and the policy give one answer.
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY, then a self-check that
-- refuses to commit unless every table carries the area-aware text.
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('guest_checkins',             'guest_list'),
      ('guest_souvenir_claims',      'guest_list'),
      ('event_song_picks',           'schedule'),
      ('event_appointments',         'vendors'),
      ('event_vendor_working_notes', 'vendors'),
      ('vendor_lock_proposals',      'vendors')
    ) AS v(t, area)
  LOOP
    IF to_regclass('public.' || r.t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_ins_' || left(r.t, 40), r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_upd_' || left(r.t, 40), r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_del_' || left(r.t, 40), r.t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      'WITH CHECK (NOT public.is_limited_helper(event_id) OR public.moderator_area_level(event_id, %L) = ''edit'')',
      'lh_ro_ins_' || left(r.t, 40), r.t, r.area);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
      'USING (NOT public.is_limited_helper(event_id) OR public.moderator_area_level(event_id, %L) = ''edit'')',
      'lh_ro_upd_' || left(r.t, 40), r.t, r.area);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated '
      'USING (NOT public.is_limited_helper(event_id) OR public.moderator_area_level(event_id, %L) = ''edit'')',
      'lh_ro_del_' || left(r.t, 40), r.t, r.area);
  END LOOP;
END;
$$;

-- Self-check: every listed table that exists now carries all three area-aware
-- refusals, and still names is_limited_helper (the db test's scan keys on it).
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(v.t || '/' || c.cmd, ', ')
    INTO missing
    FROM (VALUES
      ('guest_checkins'), ('guest_souvenir_claims'), ('event_song_picks'),
      ('event_appointments'), ('event_vendor_working_notes'), ('vendor_lock_proposals')
    ) AS v(t)
    CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) AS c(cmd)
   WHERE to_regclass('public.' || v.t) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = v.t
          AND p.permissive = 'RESTRICTIVE' AND p.cmd = c.cmd
          AND coalesce(p.qual, p.with_check) ILIKE '%is_limited_helper%'
          AND coalesce(p.qual, p.with_check) ILIKE '%moderator_area_level%'
     );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'limited-helper area refusal missing on: %', missing;
  END IF;
END;
$$;
