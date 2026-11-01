-- one_per_event_is_a_category_switch
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- "ONE PER EVENT" IS A SWITCH ON THE CATEGORY (owner 2026-10-29, Admin › Categories panels approved:
-- "build them, with the One per event switch"; and "remove LED Background. we can book multiple for that
-- as well"). Corpus DECISION_LOG row "ONE PER EVENT IS A CATEGORY SWITCH" (2026-10-29).
--
-- BEFORE. Which suppliers a couple may book only ONE of per event lived in two hard-coded lists that had
-- to be kept in step by hand:
--   · the app — `HARD_SINGLE_PICK_GROUPS` in apps/web/lib/wedding-plan-groups.ts (6 plan groups);
--   · the database — `event_vendors.hard_single_group`, a GENERATED column whose CASE mapped 7
--     `vendor_category` values to those 6 groups (20261210000000_hard_single_lock_guard.sql). Every later
--     lock path (the two partial unique indexes, re-made in 20271009160000 and 20271143289546, and the
--     lock-request RPCs up to 20271293507816) only READS that column — so it is the one place to change.
--
-- AFTER. ONE fact, on the category, edited by an admin with no deploy:
--   · `service_categories.one_per_event` (default false).
--   · A supplier on a couple's list is stored with a COARSE category (`event_vendors.category`); the
--     category it belongs to is the tier-2 category FILED under that coarse value
--     (`service_categories.coarse_category`, ③0-c "one source", 20271290647325). So a booking is one-per-
--     event exactly when an active tier-2 category filed under its coarse category has the switch on.
--   · `event_vendors.hard_single_group` stops being GENERATED (its literal list is the thing that goes) and
--     becomes the id of that category — written by a BEFORE trigger on EVERY insert/update of a booking (so
--     no client can write it — it was un-writable as a generated column and stays that way), and
--     re-written for the affected bookings whenever an admin flips the switch or re-files a category.
--   · The two partial unique indexes and every RPC keep reading the same column, unchanged.
--   · The app reads the same switch (`apps/web/lib/one-per-event.ts`); no hard-coded list is left
--     (`apps/web/lib/one-per-event-has-one-source.test.ts`).
--
-- THE BACKFILL (owner 2026-10-29): ON for the categories behind ceremony venue · reception venue ·
-- officiant · coordinator · host / MC — `ceremony_venue` · `reception` · `officiants` · `coordinator` ·
-- `host_mc`. OFF for LED (`led_wall`): "we can book multiple for that as well". Written only on the run
-- that ADDS the column, so a re-apply never turns back on a switch an admin has since turned off.
--
-- ⚠ TWO EDGES, SURFACED TO THE OWNER (not silently decided):
--   · `officiants` was filed under nothing (coarse_category NULL — the page's amber "not filed" dot), so an
--     officiant booking (`event_vendors.category = 'officiant'`) had no category to belong to and its switch
--     could never bite. It is filed under `officiant` here, ONLY while it is still NULL (an admin's later
--     choice is never overwritten). Officiant shops are then filed as "Officiant" instead of "Other".
--   · `church_fees` has no category filed under it, so a church-fee row is no longer held to one per event
--     (it used to share the ceremony venue's slot). Measured on prod 2026-10-29: ZERO such rows.
--
-- RE-KEYED VALUES. The column used to hold plan-group ids (`reception_venue`, `officiant`,
-- `led_background` …); it now holds the category id (`reception`, `officiants`, …). Nothing reads the value
-- itself — the indexes and the RPCs only compare one booking's value with another's in the same event — and
-- the re-key below cannot create a clash: every booking stays in the same or a finer partition (LED and
-- church fees leave; nothing joins).
--
-- RLS: unchanged. `service_categories` keeps its policies (public read, admin write); a new column carries
-- them. The functions below are SECURITY DEFINER only to read/write across the two tables from a trigger;
-- they are revoked from every client role.

-- ── 1 · the switch, and its backfill (owner 2026-10-29) — the backfill only on the run that adds it ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'one_per_event'
  ) THEN
    ALTER TABLE public.service_categories ADD COLUMN one_per_event BOOLEAN NOT NULL DEFAULT false;

    UPDATE public.service_categories
       SET coarse_category = 'officiant'::public.vendor_category
     WHERE id = 'officiants' AND tier = 2 AND coarse_category IS NULL;

    UPDATE public.service_categories
       SET one_per_event = true
     WHERE tier = 2
       AND id IN ('ceremony_venue', 'reception', 'officiants', 'coordinator', 'host_mc');
  END IF;
END $$;

COMMENT ON COLUMN public.service_categories.one_per_event IS
  'Tier-2 category: a couple may book only ONE supplier of this category per event (owner 2026-10-29). Read by the app (lib/one-per-event.ts) and by the database lock guard (event_vendors.hard_single_group, via the bookings whose coarse category this category is filed under). Edited on Admin › Categories › a category › One per event.';

-- ── 2 · which category a booking belongs to, when it is one per event ───────────────────────────────
CREATE OR REPLACE FUNCTION public.one_per_event_category(p_category public.vendor_category)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT sc.id
    FROM public.service_categories sc
   WHERE sc.tier = 2
     AND sc.status = 'active'
     AND sc.one_per_event
     AND sc.coarse_category = p_category
   ORDER BY sc.id
   LIMIT 1
$$;

COMMENT ON FUNCTION public.one_per_event_category(public.vendor_category) IS
  'The id of the active tier-2 category filed under this coarse category whose One per event switch is on — the key event_vendors.hard_single_group holds. NULL = not one per event.';

REVOKE ALL ON FUNCTION public.one_per_event_category(public.vendor_category) FROM PUBLIC, anon, authenticated;

-- ── 3 · the column stops being generated (the literal list goes); a trigger writes it ───────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_vendors'
       AND column_name = 'hard_single_group' AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE public.event_vendors ALTER COLUMN hard_single_group DROP EXPRESSION;
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendors.hard_single_group IS
  'The category this booking holds the ONE slot of, when that category is One per event (service_categories.one_per_event, owner 2026-10-29); NULL otherwise. Written ONLY by the trigger event_vendors_one_per_event_key (every insert/update) and re-written when an admin flips the switch (service_categories_one_per_event_follow). Drives event_vendors_hard_single_lock_uniq and event_vendors_one_pending_lock_request_per_group_uniq.';

CREATE OR REPLACE FUNCTION public.event_vendors_one_per_event_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Always recomputed — never the value a client sent (the column was un-writable while generated).
  NEW.hard_single_group := public.one_per_event_category(NEW.category);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.event_vendors_one_per_event_key() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_one_per_event_key ON public.event_vendors;
CREATE TRIGGER event_vendors_one_per_event_key
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.event_vendors_one_per_event_key();

-- ── 4 · a flip (or a re-filing) re-keys the bookings it touches ─────────────────────────────────────
-- Turning the switch ON for a category where some event already holds two confirmed bookings collides
-- with event_vendors_hard_single_lock_uniq: the admin's update fails (23505) and nothing changes — the
-- admin page says so. Never a silent half-state.
CREATE OR REPLACE FUNCTION public.service_categories_one_per_event_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cats public.vendor_category[] := ARRAY[]::public.vendor_category[];
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.one_per_event IS NOT DISTINCT FROM OLD.one_per_event
     AND NEW.coarse_category IS NOT DISTINCT FROM OLD.coarse_category
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.tier IS NOT DISTINCT FROM OLD.tier THEN
    RETURN NULL;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.coarse_category IS NOT NULL THEN
    v_cats := v_cats || OLD.coarse_category;
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') AND NEW.coarse_category IS NOT NULL THEN
    v_cats := v_cats || NEW.coarse_category;
  END IF;
  IF array_length(v_cats, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  -- The BEFORE trigger recomputes the key on each touched row; only rows whose key changes are touched.
  UPDATE public.event_vendors ev
     SET hard_single_group = public.one_per_event_category(ev.category)
   WHERE ev.category = ANY (v_cats)
     AND ev.hard_single_group IS DISTINCT FROM public.one_per_event_category(ev.category);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.service_categories_one_per_event_follow() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS service_categories_one_per_event_follow ON public.service_categories;
CREATE TRIGGER service_categories_one_per_event_follow
  AFTER INSERT OR UPDATE OR DELETE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.service_categories_one_per_event_follow();

-- ── 5 · re-key every booking now (LED and church fees leave; the rest take their category's id) ─────
UPDATE public.event_vendors ev
   SET hard_single_group = public.one_per_event_category(ev.category)
 WHERE ev.hard_single_group IS DISTINCT FROM public.one_per_event_category(ev.category);
