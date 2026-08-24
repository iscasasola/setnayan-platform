-- ═══════════════════════════════════════════════════════════════════════════
-- A COUPLE'S PUBLIC RECOMMENDATION OUTLIVES THE CELEBRATION
--
-- Owner, 2026-08-24: keep it, same as reviews.
--
-- `vendor_recommendations` is the SECOND public endorsement a couple's delete
-- silently removed, and it is structurally identical to `vendor_reviews` — which
-- the owner named FIRST when he ruled *"vendors get to keep it"* on 2026-08-21.
-- It is public-read (`USING (true)`) and feeds the marketplace's "recommended by
-- N couples" trust signal.
--
-- 🔑 NOT NEW MACHINERY. `recommended_by_user_id` is ALREADY nullable + ON DELETE
-- SET NULL, so the endorsement already outlives the PERSON who wrote it. Only
-- the EVENT was wired to take it down.
--
-- ── THE PART THAT IS NOT A COPY ─────────────────────────────────────────────
-- 🚨 THE PUBLIC COUNT DE-DUPLICATES BY `event_id`, because both partners on one
-- celebration can each recommend and that is ONE couple. A `Set` collapses every
-- NULL to a single member — so nulling `event_id` and doing nothing else would
-- make THREE different couples read as "recommended by 1 couple". Not zero,
-- which looks like an absence; a believable wrong number instead.
--
-- ⛔ THE OBVIOUS FIX — STAMP THE OLD EVENT ID INTO A NEW COLUMN — WAS BUILT,
-- MEASURED, AND THROWN AWAY. `exposure-freeze.db.test.ts` caught it: prod
-- carries `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO anon,
-- authenticated`, so a new column on this table is born with anon and
-- authenticated holding INSERT/SELECT/**UPDATE** on it — a dedupe key for a
-- public trust number, writable by anyone signed in. And a column-level REVOKE
-- is INERT against the table-level grant those roles already hold (the same trap
-- recorded on `event_vendors`), so closing it properly would mean re-cutting the
-- grants on a public table for one bookkeeping field.
--
-- ⚖ SO THE DUPLICATE IS REMOVED INSTEAD OF BEING LABELLED. At deletion time the
-- per-celebration duplicates collapse to ONE row, and after that each surviving
-- orphan simply IS one couple — the count needs no key at all.
--
-- 🔑 AND IT LOSES NOTHING A READER CAN SEE. The only surface that renders an
-- endorsement's WORDS is the couple's own editorial block, which is event-scoped
-- and dies with the event regardless. After the delete the sole surviving reader
-- is the COUNT — so a second row for the same couple contributes nothing except
-- the wrong number. The row kept is the one that actually says something
-- (endorsement first, then earliest), so the words that survive are the ones
-- somebody wrote.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · The endorsement may exist without its celebration ───────────────────
ALTER TABLE public.vendor_recommendations
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.vendor_recommendations
  DROP CONSTRAINT IF EXISTS vendor_recommendations_event_id_fkey;

ALTER TABLE public.vendor_recommendations
  ADD CONSTRAINT vendor_recommendations_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

-- ⚠ UNIQUE (vendor_profile_id, event_id, recommended_by_user_id) IS LEFT ALONE.
-- Postgres treats NULLs as DISTINCT, so several orphaned endorsements for one
-- supplier coexist — correct, because several couples can each recommend and
-- each later delete. The constraint keeps doing its real job while events exist.

-- ── 2 · One celebration leaves ONE endorsement ──────────────────────────────
CREATE OR REPLACE FUNCTION public.collapse_recommendations_on_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  /*
    Runs BEFORE the FK nulls `event_id` — which is the only moment the rows can
    still be grouped by the celebration they came from.

    Keeps the row that SAYS something (a written endorsement outranks a bare
    thumbs-up), then the earliest. Deterministic, so a re-run cannot pick a
    different survivor.
  */
  DELETE FROM public.vendor_recommendations vr
   WHERE vr.event_id = OLD.event_id
     AND vr.recommendation_id <> (
       SELECT keep.recommendation_id
         FROM public.vendor_recommendations keep
        WHERE keep.event_id = vr.event_id
          AND keep.vendor_profile_id = vr.vendor_profile_id
        ORDER BY
          (keep.endorsement IS NOT NULL AND length(btrim(keep.endorsement)) > 0) DESC,
          keep.created_at ASC,
          keep.recommendation_id ASC
        LIMIT 1
     );
  RETURN OLD;
END;
$function$;

-- 🔑 A SECURITY DEFINER FUNCTION IS EXECUTABLE BY PUBLIC BY DEFAULT, and a
-- trigger function needs no EXECUTE grant at all.
REVOKE ALL ON FUNCTION public.collapse_recommendations_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.collapse_recommendations_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.collapse_recommendations_on_event_delete() FROM authenticated;

DROP TRIGGER IF EXISTS events_collapse_recommendations_on_delete ON public.events;
CREATE TRIGGER events_collapse_recommendations_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.collapse_recommendations_on_event_delete();

-- ── 3 · Once orphaned, the endorsement FREEZES ──────────────────────────────
-- Same reasoning slice 1 applied to reviews, and the same abuse it refuses: the
-- couple's UPDATE/DELETE policies key on `recommended_by_user_id`, NOT on the
-- event, so without this a person could delete their celebration and then keep
-- rewriting — or withdraw — a supplier's public endorsement afterwards.
--
-- 🔑 A NARROWING, NOT A NEW CAPABILITY. Everything a couple can do to a LIVE
-- event's recommendation, they still can. `exposure-freeze` flags both as
-- "widened" because a predicate change cannot be MECHANICALLY proven to narrow —
-- read them: each is the old predicate AND one more conjunct.
-- ⚠ `TO authenticated` IS RESTATED EXPLICITLY. A CREATE POLICY with no TO clause
-- defaults to PUBLIC, anon included.
DROP POLICY IF EXISTS vendor_recommendations_couple_update ON public.vendor_recommendations;
CREATE POLICY vendor_recommendations_couple_update
  ON public.vendor_recommendations
  FOR UPDATE TO authenticated
  USING (recommended_by_user_id = auth.uid() AND event_id IS NOT NULL)
  WITH CHECK (recommended_by_user_id = auth.uid() AND event_id IS NOT NULL);

DROP POLICY IF EXISTS vendor_recommendations_couple_delete ON public.vendor_recommendations;
CREATE POLICY vendor_recommendations_couple_delete
  ON public.vendor_recommendations
  FOR DELETE TO authenticated
  USING (recommended_by_user_id = auth.uid() AND event_id IS NOT NULL);
