-- ============================================================================
-- THE SUPPLIER BRIDGES TWO ROOMS ON ONE DAY
--
-- A caterer with a morning christening and an evening reception has two desks
-- at two addresses — and no time to hunt for links mid-service. The binding
-- design (`Vendor_Room_Design_2026-08-26.md` § E) puts one line under the top
-- chrome: *"You're also at Maria's reception tonight · 6:00 PM →."*
--
-- ── WHY THIS IS A FUNCTION AND NOT A QUERY IN THE PAGE ───────────────────────
-- 🔒 THE RULE THE SUPPLIER'S DESK IS BUILT ON: `/{slug}` renders with the
-- SERVICE ROLE, so every policy keeping a supplier out of somebody's guest list
-- is inert there. Authorization may be answered the admin way, scoped by an id
-- the session proved; EVENT CONTENT NEVER IS.
--
-- The bridge is event content — another celebration's name, day and address —
-- so it cannot be read with the admin client that sits in scope on that page.
-- The shipped `fetchVendorRoomEvents` would have been the tempting reuse and is
-- exactly that: it opens `createAdminClient()` internally. Correct for the
-- vendor dashboard, wrong inside a guest-facing page whose loader has a guard
-- asserting it never gains an admin import.
--
-- So the DATABASE answers, from `auth.uid()`, and nothing is trusted from the
-- caller except which event they are standing in.
--
-- ── WHOSE BOOKINGS COUNT — narrower than the brief RPC beside it, ON PURPOSE ─
-- ⛔ `get_vendor_event_brief` resolves the caller's orgs as *profiles they own*
-- UNION *`vendor_team_members` rows*. This function deliberately does NOT union
-- the team table. Today only a profile OWNER can reach a supplier's desk at all
-- (`resolveVendorCapability` → `loadVendorBooking`), so the owner's set is the
-- exact set of people who can be standing in one of these rooms.
--
-- 🔒 AND THE DESIGN SAYS WHY IT MATTERS: *"the line names only celebrations THIS
-- person can enter — the shop's admin sees both; an agent granted only the
-- christening never learns the reception exists."* A bare team-membership union
-- is shorter, looks equivalent, and would tell every teammate about every
-- booking the shop holds. The owner ruled against exactly that shape
-- (per-event grants, 2026-08-26). When the teammate arm of the desk is built,
-- this function must be widened DELIBERATELY, to the events that teammate was
-- granted — never by pasting the brief's UNION in.
--
-- ── WHAT IT DISCLOSES ───────────────────────────────────────────────────────
-- The name, the day and the public address of celebrations THIS caller is
-- already booked on. Every one of those facts is already theirs: the brief hands
-- them the name and date of each, and their own dashboard lists them. This adds
-- no fact — it moves an existing one to where the work is.
--
-- ⚖ `p_day` is supplied by the app because the DATABASE DOES NOT KNOW THE
-- VENUE'S CLOCK — "today" is a wall-clock question and the zone lives in app
-- config. A caller passing some other day learns only about their own bookings
-- on it, which their dashboard already lists, so the parameter is not a hole.
-- What it must never do is decide WHO the caller is; that comes from auth.uid().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_vendor_same_day_bookings(
  p_event_id UUID,
  p_day      DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_ids UUID[];
  v_rows        JSONB;
BEGIN
  -- 1 · The caller's own shops. Owners only — see the header for why the
  --     team-member union is deliberately absent.
  SELECT ARRAY(
    SELECT vp.vendor_profile_id
    FROM public.vendor_profiles vp
    WHERE vp.user_id = auth.uid()
  ) INTO v_profile_ids;

  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RETURN '[]'::JSONB;
  END IF;

  -- 2 · They must be standing in a room they are BOOKED in. Without this a
  --     signed-in shop could ask about any event id and get their own diary
  --     back — harmless in content, but it would make this function answer to
  --     an unproved premise, and the next person to extend it would inherit
  --     that. The status set is the same one `current_vendor_booked_event_ids`
  --     and the brief both use.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids)
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND ev.archived_at IS NULL
  ) THEN
    RETURN '[]'::JSONB;
  END IF;

  -- 3 · Their OTHER bookings running on that same day.
  --
  --     🔑 A DAY, NOT A START DATE. `event_date <= p_day <= COALESCE(end, date)`
  --     so a celebration that spans several days bridges on every one of them.
  --     Anchoring on `event_date` alone would hide the reception from a caterer
  --     working day three of a festival — the same first-day-only mistake the
  --     desk's own opening rule had to be taught out of.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'event_id',     o.event_id,
        'display_name', o.display_name,
        'slug',         o.slug,
        'event_date',   o.event_date
      ) ORDER BY o.display_name
    ),
    '[]'::JSONB
  ) INTO v_rows
  FROM public.events o
  WHERE o.event_id <> p_event_id
    AND o.event_date IS NOT NULL
    AND o.event_date <= p_day
    AND COALESCE(o.event_end_date, o.event_date) >= p_day
    -- A celebration the organiser closed out or put away is not a room to step
    -- into. `is_sample` is excluded for the same reason it is everywhere else:
    -- a demo is not somebody's day.
    AND o.cleared_at IS NULL
    AND o.archived = FALSE
    AND o.is_sample = FALSE
    AND EXISTS (
      SELECT 1 FROM public.event_vendors ev
      WHERE ev.event_id = o.event_id
        AND ev.marketplace_vendor_id = ANY (v_profile_ids)
        AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND ev.archived_at IS NULL
    );

  RETURN v_rows;
END;
$function$;

COMMENT ON FUNCTION public.get_vendor_same_day_bookings(UUID, DATE) IS
  'The supplier''s bridge between two rooms on one day. Returns the caller''s OWN '
  'other bookings running on p_day — name, slug and date only. Resolves the '
  'caller from auth.uid() and admits PROFILES THEY OWN ONLY: the team-member '
  'union used by get_vendor_event_brief is deliberately absent, because a '
  'teammate granted one celebration must not learn the others exist. Widen it '
  'per-grant when the teammate desk is built; never by pasting that union in.';

REVOKE ALL ON FUNCTION public.get_vendor_same_day_bookings(UUID, DATE) FROM PUBLIC;
-- `authenticated` only. `anon` has no `auth.uid()`, so it would always read the
-- empty array — but a function granted to anon is a function somebody later
-- widens without noticing who is holding it.
GRANT EXECUTE ON FUNCTION public.get_vendor_same_day_bookings(UUID, DATE) TO authenticated;
