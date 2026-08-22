-- ═══════════════════════════════════════════════════════════════════════════
-- A REVIEW OUTLIVES THE EVENT IT WAS WRITTEN ABOUT
--
-- Owner, 2026-08-21: "only data from the user gets lost. But statistics and
-- data for the vendor stays, including the reviews, statistics, etc that the
-- vendor needs for their website." And: "vendors get to keep it."
--
-- Measured in production the same day: 153 foreign keys to `events` CASCADE and
-- only 11 survive. `vendor_reviews.event_id` was NOT NULL and CASCADE, so a
-- review could not outlive its event — the product did the OPPOSITE of the
-- ruling, on the very record the owner named FIRST.
--
-- 🔑 THIS IS NOT NEW MACHINERY. THE TABLE ALREADY KNOWS HOW TO DO THIS.
-- `vendor_reviews.couple_user_id` is already nullable + ON DELETE SET NULL, so
-- a review already survives the deletion of the PERSON who wrote it. Only the
-- EVENT was wired to take the review down with it. This gives the event the
-- same treatment the person already has — it does not invent a pattern.
--
-- Latent, not live: prod holds 0 reviews today, which is exactly what makes now
-- the cheap moment. Nobody is migrated, nothing is backfilled.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · The review may exist without its event ──────────────────────────────
ALTER TABLE public.vendor_reviews
  ALTER COLUMN event_id DROP NOT NULL;

-- ── 2 · Deleting the event orphans the review instead of destroying it ──────
-- Idempotent: drop by name, recreate. The constraint name is the one Postgres
-- generated and the one prod carries (verified by `pg_constraint` 2026-08-21).
ALTER TABLE public.vendor_reviews
  DROP CONSTRAINT IF EXISTS vendor_reviews_event_id_fkey;

ALTER TABLE public.vendor_reviews
  ADD CONSTRAINT vendor_reviews_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

-- ⚠ UNIQUE (vendor_profile_id, event_id) IS DELIBERATELY LEFT ALONE.
-- Postgres treats NULLs as DISTINCT in a unique constraint, so several orphaned
-- reviews for one supplier coexist — which is correct, because a supplier can
-- be reviewed by several couples who each later delete their celebration. The
-- constraint keeps doing its real job ("one review per supplier per event") for
-- every event that still exists.

-- ── 3 · Once orphaned, the review FREEZES ───────────────────────────────────
-- The couple's UPDATE policy keys on `couple_user_id`, NOT on the event, so
-- without this a couple could delete their celebration and then keep rewriting
-- the supplier's business record afterwards — the exact opposite of "vendors
-- get to keep it", and an obvious abuse (delete the event, then gut the words).
--
-- 🔑 A NARROWING, NOT A NEW CAPABILITY. Everything a couple could do to a LIVE
-- event's review, they still can. The clause only refuses the rows whose event
-- they have already destroyed.
--
-- The other four policies were measured and are ALREADY correct for orphans,
-- by construction rather than by luck:
--   · public_read  USING (true)                    → the orphan stays visible,
--     which is the whole point: the supplier keeps it on their page.
--   · couple_delete USING (event_id IN (…))        → `NULL IN (…)` is NULL, so
--     the couple CANNOT delete an orphaned review. Correct, and free.
--   · couple_insert WITH CHECK (event_id IN (…))   → an orphan can never be
--     FORGED; it can only be produced by a real deletion.
--   · vendor_reply  keys on vendor_profile_id      → unaffected; the supplier
--     can still reply to a review whose event is gone.
DROP POLICY IF EXISTS vendor_reviews_couple_update ON public.vendor_reviews;

-- 🚨 `TO authenticated` IS LOAD-BEARING AND I LEFT IT OFF THE FIRST TIME.
-- A CREATE POLICY with no TO clause defaults to PUBLIC, which includes `anon`.
-- Dropping and recreating a policy silently discards its role restriction, and
-- `exposure-freeze.db.test.ts` is what caught it — reporting that the policy
-- "gained PUBLIC". Not exploitable in practice (an anonymous caller has no
-- auth.uid(), so `couple_user_id = NULL` matches nothing), but the GRANT and the
-- POLICY are the only real controls here and neither may lean on a predicate
-- happening to be unsatisfiable. Recreate the role restriction explicitly.
CREATE POLICY vendor_reviews_couple_update
  ON public.vendor_reviews
  FOR UPDATE
  TO authenticated
  USING (couple_user_id = auth.uid() AND event_id IS NOT NULL)
  WITH CHECK (
    couple_user_id = auth.uid()
    AND event_id IS NOT NULL
    AND vendor_reply IS NULL
    AND vendor_reply_at IS NULL
  );

-- ── 4 · Say it where a reader will actually look ────────────────────────────
COMMENT ON COLUMN public.vendor_reviews.event_id IS
  'The celebration this review was written about, or NULL once that celebration '
  'has been deleted. NULL does NOT mean "no event" — it means "the couple '
  'removed it, and the supplier keeps the review" (owner 2026-08-21, "vendors '
  'get to keep it"). An orphaned review stays publicly readable, can still be '
  'replied to by the supplier, and can no longer be edited or deleted by the '
  'couple. Anything joining through this column must treat NULL as a real, '
  'expected value and must not drop the row.';
