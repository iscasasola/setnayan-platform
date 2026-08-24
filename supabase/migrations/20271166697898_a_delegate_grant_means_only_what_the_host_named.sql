-- A DELEGATE'S GRANT MEANS ONLY WHAT THE HOST NAMED — and the guest list is
-- the one the owner ruled on by name.
--
-- Owner, 2026-08-24, asked who may see an event's guest list: "no. only the
-- owner of the event and coordinator (by request)." The host already sees it.
-- This makes the second half true, in the only place that can enforce it.
--
-- ── WHAT WAS ACTUALLY WRONG (measured in prod before writing a line) ───────
--
-- 1 · THE READ POLICY ON `guests` NEVER ASKED WHICH AREAS WERE GRANTED.
--     `guests_moderator_write` is gated on
--     `moderator_area_level(event_id,'guest_list') = 'edit'`. Its READ twin,
--     `guests_moderator_read`, admitted ANY accepted moderator of the event.
--     So a host who declined the guest list line-by-line at
--     /dashboard/<event>/access-requests closed the SCREEN and not the DOOR:
--     `public.guests` is served over PostgREST to a public anon key, so the
--     rows stayed readable to anyone holding that session. The database is the
--     control; the component never was.
--
-- 2 · THE RESOLVER HANDED OUT AREAS NOBODY GRANTED. `moderator_area_level`
--     falls back to the legacy `edit_all` / `checkout` flags for any area its
--     `areas` map does not name. That fallback exists for rows written BEFORE
--     `areas` did — the couple's own host rows, which carry no `areas` key at
--     all — and it must keep working for them. But it also fired on rows that
--     DO carry an `areas` map, where an unnamed area is not a gap: it is the
--     host not having granted it. Measured on the one external planner live in
--     production, granted `{"areas":{"seat_plan":"view"}}` and nothing else:
--
--         guest_list view · seat_plan view · schedule view
--         vendors    view · invitations view · mood_board view
--
--     Five areas the host never named, four of them from this fallback. The
--     line-by-line answer the access-request screen exists to collect was
--     being undone by the resolver that reads it.
--
-- ⚖ WHAT IS DELIBERATELY NOT CHANGED:
--   · Legacy rows with NO `areas` key keep the fallback exactly as it was
--     (2026-06-13 decision: "permissions_json.areas override → legacy
--     edit_all/checkout fallback"). That is what the couple's own moderator
--     rows rely on, and stripping it would lock a groom out of his wedding.
--   · The couple's own paths (`couple_writes_guest`,
--     `event_member_can_read_guest`) are untouched — a host's access has never
--     run through `moderator_area_level`.
--   · Every other moderator read policy (seat plan, schedule, suppliers, floor
--     plan) is LEFT AS IT IS. The owner ruled on the guest list; widening this
--     to five more surfaces would be deciding four things he did not say. The
--     fallback fix above already narrows what those areas RESOLVE to.
--     `households` is not in this list because it no longer exists in prod
--     (checked: `to_regclass('public.households')` is NULL) — the 2026-11-29
--     migration's map still names it, which is why it is worth saying here.

-- ── 1. The resolver: an `areas` map that does not name an area is a NO ──────
CREATE OR REPLACE FUNCTION public.moderator_area_level(p_event_id uuid, p_area text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN m.permissions_json -> 'areas' ? p_area
      THEN NULLIF(m.permissions_json -> 'areas' ->> p_area, '')
    -- 🔑 THE NEW LINE, AND THE WHOLE POINT. A row that carries an `areas` map
    -- has been answered area by area. An area missing from it was not granted,
    -- and must not be inherited from a legacy flag the host never set.
    WHEN m.permissions_json ? 'areas'
      THEN NULL
    WHEN p_area = 'budget'
      THEN CASE WHEN COALESCE((m.permissions_json ->> 'checkout')::boolean, FALSE)
                THEN 'view' ELSE NULL END
    WHEN p_area = 'mood_board' THEN 'view'
    WHEN p_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
      THEN CASE WHEN COALESCE((m.permissions_json ->> 'edit_all')::boolean, FALSE)
                THEN 'edit' ELSE 'view' END
    ELSE NULL
  END
  FROM public.event_moderators m
  WHERE m.event_id = p_event_id
    AND m.user_id = auth.uid()
    AND m.accepted_at IS NOT NULL
    AND m.removed_at IS NULL
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.moderator_area_level(uuid, text) IS
  'What a delegate may do in one area. An explicit areas[] value wins. A row '
  'that carries an areas map and does not name the area gets NULL — the host '
  'answered line by line and this is the unnamed line. Only rows with NO areas '
  'map at all fall back to the legacy edit_all/checkout flags. Mirrored in TS '
  'by lib/delegate-areas.ts resolveAreaLevel; the two must agree.';

-- ── 2. The guest list is read on the grant, not on being a delegate ─────────
DROP POLICY IF EXISTS guests_moderator_read ON public.guests;
CREATE POLICY guests_moderator_read ON public.guests
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'guest_list') IS NOT NULL);

COMMENT ON POLICY guests_moderator_read ON public.guests IS
  'A delegate reads the guest list only where the host granted guest_list — '
  'owner 2026-08-24: "only the owner of the event and coordinator (by '
  'request)". The couple reads through couple_writes_guest / '
  'event_member_can_read_guest and never through this policy. Mirrors its own '
  'write twin, which has always asked the same question.';

-- ── 3. THE SECOND DOOR ON THE SAME TABLE — and closing one is not closing it ─
--
-- 🚨 NARROWING `guests_moderator_read` ALONE WOULD HAVE CHANGED NOTHING, and
-- it would have LOOKED like a fix. `guests` carries a second read policy,
-- `event_member_can_read_guest`, admitting
-- `current_couple_or_coordinator_event_ids()` — every `event_members` row of
-- type 'couple' OR 'coordinator'. Since migration 20271161203067 ("an accepted
-- delegate is a member") a trigger mints a 'coordinator' member row for EVERY
-- accepted delegate. Measured in prod: 1 coordinator member, and it is the
-- external planner. Policies are OR-ed, so she would have kept reading the
-- whole guest list through this one with the other slammed shut.
--
-- The couple half is untouched and must stay untouched. Only the coordinator
-- half now asks the question the owner answered.
--
-- ⚖ THE FUNCTION IS NOT CHANGED — 8 other policies use it (vendor reviews,
-- lock proposals, appointments, song picks, handovers, orders) and the owner
-- ruled on the GUEST LIST, not on those. The narrowing is written into this
-- one policy, where its reason can be read.
-- ⚠ WRITTEN WITH THE DEFINER HELPERS, NOT WITH INLINE SUBQUERIES ON
-- `event_members`. A policy on `guests` that reads `event_members` directly is
-- subject to that table's own RLS — the exact recursion migration
-- 20260513040000 exists to undo. `current_couple_event_ids()` and
-- `current_couple_or_coordinator_event_ids()` are both SECURITY DEFINER and are
-- what every sibling policy already uses.
DROP POLICY IF EXISTS event_member_can_read_guest ON public.guests;
CREATE POLICY event_member_can_read_guest ON public.guests
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      -- The host, exactly as before. Their access has never depended on a grant.
      event_id IN (SELECT public.current_couple_event_ids())
      -- A coordinator member, only on the line the host granted.
      OR (
        event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
        AND public.moderator_area_level(event_id, 'guest_list') IS NOT NULL
      )
    )
  );

COMMENT ON POLICY event_member_can_read_guest ON public.guests IS
  'The couple read their own guest list unconditionally. A coordinator member '
  'reads it only where the host granted guest_list — owner 2026-08-24. Both '
  'read policies on this table now ask the same question, because policies are '
  'OR-ed and closing one of two doors closes nothing.';
