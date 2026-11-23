-- ═══════════════════════════════════════════════════════════════════════════
-- Hub tools, second five (DECISION_LOG 2026-11-23 "THE TEN MOST-SHARED UNBUILT HUB TOOLS"):
--   1 · vendor_hub_tool_entries — the rows behind the Checklist, Per-person and Counter templates
--   2 · vendor_event_dietary_list(event) — the Dietary & allergies sheet, read from the RSVPs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RULE 0. `event_shot_list_items` is the shot list's own table (couple-read, photo trades) and its guards pin its
-- shape; `vendor_event_sets` is the Set list (reused as-is, no change here). Nothing holds a supplier's tech rider,
-- personalisation names or a counted quantity. A tool is a RECORD (lib/hub-tools.ts: key · name · template), so ONE
-- table keyed by `tool_key` serves every tool drawn with these templates; a new tool needs no migration.
--
-- WHO MAY DO WHAT (the shot list's pattern, 20271234188149 § 4b)
--   • the booked supplier (profile owner or team member) — reads and writes their OWN rows, only on an event they are
--     booked on;
--   • admin — reads;
--   • anyone else, the couple included — nothing. These are the supplier's working notes; no couple surface reads them.
--
-- ⚠ DEFAULT ACL: every new relation in `public` ships OPEN to anon AND authenticated on this project. The REVOKE ALL in
-- § 1c is load-bearing.

-- ── 1a · The table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_hub_tool_entries (
  entry_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,

  -- The tool record's key (`hub_tools.key` / lib/hub-tools.ts HUB_TOOL_LIBRARY). Not an FK: a tool switched off in the
  -- library keeps its data ("Turn off keeps data", 2026-10-28), and the Tool maker may add keys the seed never had.
  tool_key           TEXT NOT NULL CHECK (tool_key ~ '^[a-z][a-z0-9_]{0,59}$'),

  -- The row's words: an item ("2× wireless mic"), a person ("Maria Reyes") or the thing counted ("Giveaways").
  label              TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 140),
  -- The second line: what to engrave, a size, a note. Never health data — the one health field is the RSVP's dietary
  -- answer, read through § 2, never typed here.
  note               TEXT CHECK (note IS NULL OR char_length(note) <= 280),

  -- Display order within one supplier's tool. Gaps are fine.
  position           INTEGER NOT NULL DEFAULT 0,

  -- NULL = not ticked. A timestamp, not a boolean, so "done" never exists without a moment.
  done_at            TIMESTAMPTZ,

  -- The Counter template's number (NULL on every other template's rows).
  qty                INTEGER CHECK (qty IS NULL OR qty BETWEEN 0 AND 100000),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The only read: this event, this supplier, these tools, in order.
CREATE INDEX IF NOT EXISTS vendor_hub_tool_entries_event_vendor_idx
  ON public.vendor_hub_tool_entries (event_id, vendor_profile_id, tool_key, position);
-- FK covering index for the vendor_profiles cascade.
CREATE INDEX IF NOT EXISTS vendor_hub_tool_entries_vendor_idx
  ON public.vendor_hub_tool_entries (vendor_profile_id);

ALTER TABLE public.vendor_hub_tool_entries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vendor_hub_tool_entries IS
  'A booked supplier''s rows in one hub tool for one event (Tech rider items, Personalisation names, Quantity vs guests counts — any tool drawn with the Checklist, Per-person or Counter template). Keyed by tool_key from lib/hub-tools.ts. Written by hubToolEntry in app/vendor-dashboard/on-the-day/actions.ts; read by lib/hub-tool-entries.server.ts for the on-the-day screen.';
COMMENT ON COLUMN public.vendor_hub_tool_entries.done_at IS 'NULL = not ticked. Set when the supplier ticks the row; cleared when they untick it.';
COMMENT ON COLUMN public.vendor_hub_tool_entries.qty IS 'The Counter template''s count; NULL on Checklist and Per-person rows.';

-- ── 1b · updated_at trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_vendor_hub_tool_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vendor_hub_tool_entries_touch ON public.vendor_hub_tool_entries;
CREATE TRIGGER vendor_hub_tool_entries_touch
  BEFORE UPDATE ON public.vendor_hub_tool_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_vendor_hub_tool_entries();

REVOKE ALL ON FUNCTION public.touch_vendor_hub_tool_entries() FROM PUBLIC, anon, authenticated;

-- ── 1c · Privileges — REVOKE FIRST, then grant back the minimum ────────────

REVOKE ALL ON public.vendor_hub_tool_entries FROM PUBLIC;
REVOKE ALL ON public.vendor_hub_tool_entries FROM anon;
REVOKE ALL ON public.vendor_hub_tool_entries FROM authenticated;

-- INSERT and UPDATE are COLUMN lists: RLS cannot constrain a value, so only the grant keeps ids and timestamps
-- server-owned and keeps an UPDATE from re-pointing a row at another event, supplier or tool (insert-only columns).
GRANT SELECT, DELETE ON public.vendor_hub_tool_entries TO authenticated;
GRANT INSERT (event_id, vendor_profile_id, tool_key, label, note, position, done_at, qty)
  ON public.vendor_hub_tool_entries TO authenticated;
GRANT UPDATE (label, note, position, done_at, qty)
  ON public.vendor_hub_tool_entries TO authenticated;
GRANT ALL ON public.vendor_hub_tool_entries TO service_role;

-- ── 1d · RLS — canonical helpers only ──────────────────────────────────────

DROP POLICY IF EXISTS vendor_hub_tool_entries_admin_read ON public.vendor_hub_tool_entries;
CREATE POLICY vendor_hub_tool_entries_admin_read
  ON public.vendor_hub_tool_entries FOR SELECT TO authenticated
  USING (public.is_admin());

-- The booked supplier manages their OWN rows, only on an event they are booked on. USING and WITH CHECK are identical,
-- so an UPDATE can move a row neither onto another supplier nor onto an event they are not on.
DROP POLICY IF EXISTS vendor_hub_tool_entries_vendor_all ON public.vendor_hub_tool_entries;
CREATE POLICY vendor_hub_tool_entries_vendor_all
  ON public.vendor_hub_tool_entries FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND (
      vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  )
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND (
      vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  );

-- ── 2 · The Dietary & allergies sheet ──────────────────────────────────────
-- DECISION_LOG 2026-10-28 "DIETARY NEEDS STAY; EVERY OTHER HEALTH FIELD IS BANNED": the RSVP dietary answers are
-- "shown to the booked caterer only, food needs only". So, per guest, ONLY:
--   · who (the guest's name) · their meal pick · their dietary note · their table when guests may see seats.
-- Only guests who are COMING (rsvp 'attending') and wrote a note or picked a meal ("No preference" is not a pick), on the SAME counted set as the
-- brief's dietary counts (get_vendor_event_brief § 4): not deleted, not self-added-unlisted, not passed away, not
-- represented, not "not counted" for every one of this supplier's booked services.
-- Gate: the caller's org is BOOKED (contracted and up) on this event under a FOOD category — catering, cake, mobile
-- bar. The brief's count gate also admits venue and coordinator; names are narrower than counts, so they do not get
-- names. Anyone else: `not_food_supplier` (the screen says who the list is for), never an empty list.

CREATE OR REPLACE FUNCTION public.vendor_event_dietary_list(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids  UUID[];
  v_categories   TEXT[];
  v_booked_ids   UUID[];
  v_not_counted  UUID[];
  v_seats        BOOLEAN;
  v_rows         JSONB;
BEGIN
  -- 🔒 ALLERGIES ARE HEALTH DATA (controller 23 Nov 2026, DECISION_LOG): only the people who run the day read them —
  -- the shop's owner, and active team members whose role (`vendor_team_members.duty`, owner 19 Nov six roles) is
  -- Shop Manager, Branch Manager, Account Manager or Event Crew. Marketing and Helper are refused, exactly like a shop
  -- not booked here (42501), so the screen says it cannot show this rather than drawing an empty list.
  -- Reuses the six-roles helper `current_vendor_duty_ids` (active seats only), never a second rule. `duty` is NOT NULL
  -- since 20271351755368's backfill, so there is no legacy seat without one.
  -- ⏭ NOT BUILT HERE: branch scoping (a Branch Manager to their branch's events) and client scoping (an Account Manager
  -- or Event Crew to the events they are on) wait for the roles-scoping PR; today these four read every booked event of
  -- their shop.
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION SELECT public.current_vendor_duty_ids('shop_manager')
    UNION SELECT public.current_vendor_duty_ids('branch_manager')
    UNION SELECT public.current_vendor_duty_ids('account_manager')
    UNION SELECT public.current_vendor_duty_ids('event_crew')
  ) INTO v_profile_ids;

  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT), ARRAY_AGG(ev.vendor_id)
  INTO v_categories, v_booked_ids
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  IF v_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  IF NOT (v_categories && ARRAY['catering', 'cake_maker', 'mobile_bar']) THEN
    RETURN jsonb_build_object('allowed', FALSE, 'guests', '[]'::jsonb);
  END IF;

  v_not_counted := public.guests_not_counted_for_services(p_event_id, v_booked_ids);
  v_seats := COALESCE(public.guests_may_see_seats(p_event_id), FALSE);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'guest_id', g.guest_id,
           'name', COALESCE(NULLIF(btrim(g.display_name), ''), btrim(concat_ws(' ', g.first_name, g.last_name))),
           'meal', NULLIF(g.meal_preference::TEXT, 'no_preference'),
           'dietary', NULLIF(btrim(g.dietary_restrictions), ''),
           'table', CASE WHEN v_seats THEN t.table_label END
         ) ORDER BY (NULLIF(btrim(g.dietary_restrictions), '') IS NULL), t.table_label NULLS LAST, g.first_name, g.last_name), '[]'::jsonb)
  INTO v_rows
  FROM public.guests g
  LEFT JOIN public.event_seat_assignments a ON a.event_id = g.event_id AND a.guest_id = g.guest_id
  LEFT JOIN public.event_tables t ON t.table_id = a.table_id
  WHERE g.event_id = p_event_id
    AND g.deleted_at IS NULL
    AND g.entry_source <> 'self_added_unlisted'
    AND NOT g.passed_away
    AND g.represented_by_guest_id IS NULL
    AND g.guest_id <> ALL (v_not_counted)
    AND g.rsvp_status = 'attending'
    AND (NULLIF(btrim(g.dietary_restrictions), '') IS NOT NULL OR COALESCE(g.meal_preference::TEXT, 'no_preference') <> 'no_preference');

  RETURN jsonb_build_object('allowed', TRUE, 'guests', v_rows);
END $$;

REVOKE ALL ON FUNCTION public.vendor_event_dietary_list(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_event_dietary_list(UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_event_dietary_list(UUID) IS
  'The Dietary & allergies hub tool: attending guests'' meal pick + RSVP dietary note (+ table once guests may see seats), for a supplier booked on the event under a food category (catering · cake · mobile bar) only — DECISION_LOG 2026-10-28 "shown to the booked caterer only". Others get allowed=false. Read only by the shop owner and active Shop/Branch/Account Managers and Event Crew (health data, controller 23 Nov 2026); Marketing and Helper get 42501. Read by lib/hub-tool-entries.server.ts.';
