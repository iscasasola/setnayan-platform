-- many_venues_per_event_suppliers_pick_chapters
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🏛 MANY VENUES PER EVENT; SUPPLIERS PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE (owner 2026-11-01, DECISION_LOG
-- row of that name; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3 "Suppliers", §12 Step 4). Owner, with a
-- screenshot of Suppliers › Find: *"venues are independent from each other. This means we can have multiple venues
-- (unlike before when it is not allowed). The other suppliers choose to what chapter they will cater. Can pick 1 or
-- multiple. Coordinators are all around."*
--
-- ── 1 · MORE THAN ONE VENUE ──────────────────────────────────────────────────────────────────────────────────────────
-- The one-venue limit lived in ONE place: the One per event switch on the category (`service_categories.one_per_event`,
-- 20271296971721), ON for `ceremony_venue` and `reception`. The database lock indexes key on
-- `event_vendors.hard_single_group`, which the trigger writes from that switch; the app reads the same switch
-- (`apps/web/lib/one-per-event.ts`). Turning it OFF for the two venue categories is the whole change — the follow
-- trigger (`service_categories_one_per_event_follow`) re-keys the affected bookings to NULL in the same statement, so a
-- second venue books like any other supplier. Officiant, coordinator and host / MC keep their switch.
-- ⚠ The switch stays an Admin › Categories control: an admin could turn it back on. That would re-impose the limit the
-- owner retired, so it is surfaced, not locked here.
--
-- ── 2 · WHERE: A SUPPLIER'S CHAPTERS ────────────────────────────────────────────────────────────────────────────────
-- 🔑 EXTEND, DO NOT REBUILD (plan §7). A chapter is a TOP-LEVEL `event_schedule_blocks` row, and a supplier on a block
-- is already written down: `responsible_vendor_ids` (20270825042743), the `event_vendors.vendor_id`s tagged on it.
-- The approved prototype keeps a supplier's Where ON THE CHAPTER (`c.sups`). So a supplier's Where IS the set of
-- chapters whose `responsible_vendor_ids` holds them — ONE fact, read the same by the Team row, the Schedule's
-- per-supplier lens (lib/schedule-ros.ts) and the call time (lib/booked-call-times.server.ts). No link table: a second
-- table would be a second, competing answer to "which chapters is this supplier on".
--
-- `set_supplier_where(vendor_id, block_ids, covered_group)` is the ONE door that writes it. SECURITY DEFINER with an
-- explicit gate: only a HOST of the supplier's event (`current_couple_event_ids()`) may call it; every read and write
-- inside is scoped to that one event. Definer because the same statement TELLS the supplier (below) — the couple cannot
-- read another shop's owner or write their notification. It refuses, in words:
--   · a coordinator — *"Coordinators are all around"*: on every chapter, no Where to set;
--   · a block that is not a chapter of this supplier's event;
--   · NO chapter for a BOOKED supplier while the event has chapters (plan: "required, at least 1, once booked");
--   · anyone who is not a host of the event.
-- 🔔 A CHANGE AFTER BOOKING TELLS THE SUPPLIER (plan §12 Step 4): when the booking is booked and the set changed, ONE
-- in-app notice (`supplier_where_changed`, 20271301389353) goes to the shop's owner — written HERE, by the database, so
-- no path that changes Where can skip it (the precedent: `mood_board_changed`, `access_more_asked`). Never email; never
-- to the person who made the change; a supplier the couple added by hand has no shop and nobody to tell. The notice says
-- the price does not change by itself — nothing here touches a price.
-- Before booking it may be empty: Where is best set on the quote, since it changes the price, and allowed any time.
-- The price is never touched here.
--
-- ── 3 · IN-HOUSE SUPPLIERS (a venue's cake, catering, stations) ─────────────────────────────────────────────────────
-- A supplier that comes WITH a venue is not a booking of its own: it is the venue's booking "also covering" a plan group
-- (`event_vendors.covers_plan_groups`, shown "Seda Vertis North · with Reception"). It STARTS on the venue's chapters
-- and the host may change it (owner 2026-11-01). `covered_where` holds only the CHANGED ones: { plan_group: [block_id] }.
-- A group with no key follows the venue's own chapters — resolved at READ, never copied, so moving the venue moves it.
-- Dangling ids (a deleted chapter) are dropped at read, like `responsible_vendor_ids`'.
--
-- RLS: no new table. The column rides `event_vendors`' policies (couple read/write); the function gates on the host.
-- Held by apps/web/tests/db/many-venues-and-where.db.test.ts.

-- ⚠ ORDER (hotfix 2026-11-01): the ALTER TABLE on event_vendors runs FIRST. The first deploy failed in production with
-- SQLSTATE 55006 "cannot ALTER TABLE event_vendors because it has pending trigger events": the service_categories UPDATE
-- below fires deferred triggers that queue events on event_vendors, and an ALTER after them in the same transaction is
-- refused. Never applied anywhere (the push rolled back), so this file is safe to reorder.
-- ── 3 · an in-house supplier's changed chapters ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS covered_where JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_vendors_covered_where_is_object'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_covered_where_is_object CHECK (jsonb_typeof(covered_where) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendors.covered_where IS
  'Where an IN-HOUSE supplier this booking also covers (covers_plan_groups) goes, when the host changed it: { plan_group: [chapter block_id] }. No key = follows this booking''s own chapters (event_schedule_blocks.responsible_vendor_ids on top-level blocks). Written only by set_supplier_where (owner 2026-11-01).';

-- ── 1 · the venue categories are no longer one per event ─────────────────────────────────────────────────────────────
UPDATE public.service_categories
   SET one_per_event = false
 WHERE tier = 2
   AND id IN ('ceremony_venue', 'reception')
   AND one_per_event;

-- ── 2 · the one door that writes Where ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_supplier_where(
  p_vendor_id UUID,
  p_block_ids UUID[],
  p_covered_group TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_owner    UUID;
  v_host     TEXT;
  v_told     BOOLEAN := false;
  v_ev       public.event_vendors%ROWTYPE;
  v_ids      UUID[];
  v_chapters UUID[];
  v_before   UUID[];
  v_after    UUID[];
  v_booked   BOOLEAN;
  v_n        INT;
  v_names    TEXT[];
BEGIN
  SELECT * INTO v_ev FROM public.event_vendors WHERE vendor_id = p_vendor_id FOR UPDATE;
  -- Only a host of this supplier's event. A stranger cannot tell "not yours" from "not there".
  IF NOT FOUND OR v_uid IS NULL OR NOT (v_ev.event_id IN (SELECT public.current_couple_event_ids())) THEN
    RAISE EXCEPTION 'supplier_not_found: this supplier is not on an event you can edit' USING ERRCODE = 'P0002';
  END IF;

  -- Coordinators are on every chapter (owner 2026-11-01): there is no Where to set.
  IF v_ev.category = 'planner_coordinator' OR p_covered_group = 'coordinator' THEN
    RAISE EXCEPTION 'coordinators_are_everywhere: a coordinator is on every chapter' USING ERRCODE = '22023';
  END IF;

  -- An in-house group is named by its plan group (`catering`) or its row (`tile:food_truck`). What a booking covers
  -- has two authors (the couple's `covers_plan_groups` on a supplier they added; the shop's own linked services on a
  -- supplier on Setnayan), so the key is checked for shape here and offered only from what the page read.
  IF p_covered_group IS NOT NULL AND p_covered_group !~ '^[a-z0-9_:]{1,64}$' THEN
    RAISE EXCEPTION 'not_covered: % is not an in-house group', p_covered_group USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::uuid[]) INTO v_ids
    FROM unnest(COALESCE(p_block_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL;

  SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_chapters
    FROM public.event_schedule_blocks b
   WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL;

  IF NOT (v_ids <@ v_chapters) THEN
    RAISE EXCEPTION 'not_a_chapter: every Where must be a chapter of this event' USING ERRCODE = '22023';
  END IF;

  v_booked := v_ev.archived_at IS NULL
          AND v_ev.status::text IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  -- Required once booked: at least one chapter, whenever the event has any (plan §3 "Suppliers").
  IF v_booked AND cardinality(v_ids) = 0 AND cardinality(v_chapters) > 0 THEN
    RAISE EXCEPTION 'a_booked_supplier_needs_a_chapter: keep at least 1 chapter for a booked supplier' USING ERRCODE = '23514';
  END IF;

  IF p_covered_group IS NULL THEN
    SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_before
      FROM public.event_schedule_blocks b
     WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL
       AND p_vendor_id = ANY (b.responsible_vendor_ids);

    UPDATE public.event_schedule_blocks b
       SET responsible_vendor_ids = array_append(b.responsible_vendor_ids, p_vendor_id)
     WHERE b.block_id = ANY (v_ids)
       AND NOT (p_vendor_id = ANY (b.responsible_vendor_ids));

    UPDATE public.event_schedule_blocks b
       SET responsible_vendor_ids = array_remove(b.responsible_vendor_ids, p_vendor_id)
     WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL
       AND NOT (b.block_id = ANY (v_ids))
       AND p_vendor_id = ANY (b.responsible_vendor_ids);

    SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_after
      FROM public.event_schedule_blocks b
     WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL
       AND p_vendor_id = ANY (b.responsible_vendor_ids);
  ELSE
    SELECT COALESCE(array_agg(x::uuid ORDER BY x::uuid), NULL) INTO v_before
      FROM jsonb_array_elements_text(v_ev.covered_where -> p_covered_group) AS x;

    UPDATE public.event_vendors
       SET covered_where = jsonb_set(COALESCE(covered_where, '{}'::jsonb), ARRAY[p_covered_group], to_jsonb(v_ids), true)
     WHERE vendor_id = p_vendor_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_after := CASE WHEN v_n = 1 THEN v_ids ELSE v_before END;
  END IF;

  IF v_after IS DISTINCT FROM v_ids THEN
    RAISE EXCEPTION 'not_saved: this account cannot change where this supplier goes' USING ERRCODE = '42501';
  END IF;

  -- The chapters it is on now, by name and in time order — the words of the notice.
  SELECT COALESCE(array_agg(b.label ORDER BY b.start_at, b.sort_order), '{}'::text[]) INTO v_names
    FROM public.event_schedule_blocks b WHERE b.block_id = ANY (v_ids);

  -- 🔔 Booked, and the set changed (order never matters) → tell the shop's owner, in the app.
  IF v_booked
     AND v_ev.marketplace_vendor_id IS NOT NULL
     AND NOT (COALESCE(v_before, '{}'::uuid[]) @> v_ids AND v_ids @> COALESCE(v_before, '{}'::uuid[])) THEN
    SELECT vp.user_id INTO v_owner FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_ev.marketplace_vendor_id;
    IF v_owner IS NOT NULL AND v_owner <> v_uid THEN
      SELECT NULLIF(btrim(e.display_name), '') INTO v_host FROM public.events e WHERE e.event_id = v_ev.event_id;
      INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
      VALUES (
        v_owner,
        'supplier_where_changed'::public.notification_type,
        left(format('%s changed where you go', COALESCE(v_host, 'The host')), 160),
        format(
          '%syou are now on %s. Your price doesn’t change by itself — if it should, tell them in your chat.',
          CASE WHEN p_covered_group IS NULL THEN '' ELSE initcap(replace(regexp_replace(p_covered_group, '^(label|tile):', ''), '_', ' ')) || ': ' END,
          CASE WHEN cardinality(v_names) = 0 THEN 'no chapter yet' ELSE array_to_string(v_names, ', ') END
        ),
        '/vendor-dashboard/clients/' || v_ev.event_id::text,
        v_ev.event_id
      );
      v_told := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'event_id', v_ev.event_id,
    'after_names', to_jsonb(v_names),
    'booked', v_booked,
    'shop', v_ev.marketplace_vendor_id,
    'covered_group', p_covered_group,
    'told', v_told,
    'before', to_jsonb(v_before),
    'after', to_jsonb(v_after)
  );
END;
$$;

COMMENT ON FUNCTION public.set_supplier_where(UUID, UUID[], TEXT) IS
  'The ONE door that writes a supplier''s Where (owner 2026-11-01): their chapters = top-level event_schedule_blocks whose responsible_vendor_ids hold them; an in-house group''s changed chapters = event_vendors.covered_where. Hosts only (current_couple_event_ids). Refuses a coordinator (on every chapter), a non-chapter, and an empty Where for a booked supplier while the event has chapters. A change to a BOOKED supplier writes ONE in-app notice (supplier_where_changed) to the shop owner — never email, never the actor; the price is never touched.';

REVOKE ALL ON FUNCTION public.set_supplier_where(UUID, UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_supplier_where(UUID, UUID[], TEXT) TO authenticated;
