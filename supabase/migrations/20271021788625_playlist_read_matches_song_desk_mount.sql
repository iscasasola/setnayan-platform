-- ============================================================================
-- THE DESK MOUNTS ON ONE VOCABULARY AND READS ON ANOTHER. Align them.
--
-- Owner, 2026-07-30: "fix the song desk."
--
-- ── THE MISMATCH, IN THE TWO LISTS THEMSELVES ──────────────────────────────
--
-- The song desk MOUNTS when the vendor holds the `song_desk` specialization,
-- which is granted on the canonical taxonomy tiles in `MUSIC_CANONICALS`
-- (lib/songs.ts, reused by lib/vendor-specialization-gate.ts precisely so the two
-- "who is a music act" answers cannot drift):
--
--     live_band · dj · choir · orchestra · wedding_singer
--
-- The playlist READ gated on a hardcoded list of LEGACY `vendor_category` enum
-- values (this policy, born 20260622000000):
--
--     band_dj · host_emcee · choir · string_quartet
--
-- Those are different vocabularies for different columns — `services[]` holds
-- tiles, `event_vendors.category` holds the enum — and mapping the enum through
-- `vendor-category-taxonomy.ts` shows the two lists do NOT cover each other:
--
--     band_dj        → live_band + dj    ✅ both are music tiles
--     choir          → choir             ✅
--     string_quartet → choir             ✅
--     host_emcee     → host_mc           ✗  gets `stage_script`, never `song_desk`
--     (nothing)      → orchestra         ✗  NO legacy category maps here
--     (nothing)      → wedding_singer    ✗  NO legacy category maps here
--
-- ⇒ **A booked orchestra or wedding singer holds `song_desk`, mounts the desk,
-- and reads ZERO playlist rows.** Which — until PR 1c taught this surface to tell
-- a denied read from an empty one — rendered as "they haven't set out the night
-- moment by moment yet". Same family as the crew/grantee defects PR 1c closed:
-- the thing that decides whether you SEE the surface and the thing that decides
-- whether you can READ it were never the same thing.
--
-- ── WHY THE FIX IS TO DROP THE LIST, NOT TO EXTEND IT ──────────────────────
--
-- Extending it means keeping a taxonomy in SQL, where it drifts from the
-- TypeScript copy every render path uses. This policy is the proof: it drifted,
-- silently, for the entire life of the feature, and the drift only surfaced
-- because someone mapped both lists by hand today.
--
-- The sibling table already made this exact call. `event_song_picks_booked_vendor_read`
-- carries a comment saying it is *deliberately* NOT narrowed to music vendors,
-- because "narrowing means hardcoding taxonomy keys into SQL where they drift
-- from MUSIC_CANONICALS". So the same data — the couple's song choices — is
-- already readable by any booked vendor one table over. Keeping a stricter,
-- drifting gate on the per-moment copy bought nothing except this bug.
--
-- ⚠⚠ THE EXPOSURE CONSEQUENCE, STATED PLAINLY BECAUSE IT IS THE OWNER'S CALL:
-- after this, ANY booked vendor on the event (the florist, the caterer) can read
-- the couple's playlist — not just music acts. That is already true of
-- `event_song_picks`, the data is the couple's song choices rather than anything
-- sensitive, and both remain gated on a CONTRACTED-or-better booking plus the
-- host/grantee legs. If the owner wants music-only, the honest way is a
-- `category_key`-based gate once that column is actually populated (it is NULL on
-- every prod row today and "nothing reads it yet"), NOT another hand-kept enum
-- list in SQL.
--
-- The audience legs PR 1c added (team members, day-of grantees) are preserved
-- verbatim — they were the fix for a different half of the same problem.
--
-- ⚠ Trips the exposure freeze (a predicate change, and this one genuinely
-- WIDENS). Baseline regenerated in the same PR; read those lines, not the counts.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS event_playlist_picks_music_vendor_read ON public.event_playlist_picks;
CREATE POLICY event_playlist_picks_music_vendor_read
  ON public.event_playlist_picks FOR SELECT
  TO authenticated
  USING (
    -- The booked org: profile owner UNION team members. ONE definition of
    -- "booked", shared with event_song_picks and event_song_requests.
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    -- …plus crew the act granted day-of access to (PR 1c). Kept as the helper
    -- here rather than the vendor-bound EXISTS: with the category gate gone
    -- there is no music-act binding left to protect, so the simpler predicate is
    -- also the honest one.
    OR event_id IN (SELECT public.current_vendor_dayof_grant_event_ids())
  );

COMMENT ON POLICY event_playlist_picks_music_vendor_read ON public.event_playlist_picks IS
  'A booked vendor (owner or team member) + day-of grantees read the couple''s '
  'per-moment playlist. The policy name says "music_vendor" for continuity but the '
  'category gate was REMOVED 2026-07-30: it hardcoded legacy vendor_category enum '
  'values (band_dj/host_emcee/choir/string_quartet) while the song desk MOUNTS on '
  'canonical MUSIC_CANONICALS tiles, so a booked orchestra or wedding_singer — no '
  'legacy category maps to either — mounted the desk and read zero rows. Same '
  'deliberate call as event_song_picks_booked_vendor_read: narrowing means keeping '
  'a taxonomy in SQL, where it drifts. Widens the read to any booked vendor.';

-- ── Post-conditions ────────────────────────────────────────────────────────
DO $$
DECLARE v_qual TEXT;
BEGIN
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname='public' AND tablename='event_playlist_picks'
    AND policyname='event_playlist_picks_music_vendor_read';
  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'the playlist read policy is missing';
  END IF;
  IF v_qual LIKE '%band_dj%' THEN
    RAISE EXCEPTION 'the hardcoded legacy category list is still in the predicate';
  END IF;
  IF v_qual NOT LIKE '%current_vendor_booked_event_ids%' THEN
    RAISE EXCEPTION 'the booked-org leg is missing — the act itself would read zero';
  END IF;
  IF v_qual NOT LIKE '%current_vendor_dayof_grant_event_ids%' THEN
    RAISE EXCEPTION 'the day-of grantee leg from PR 1c was dropped';
  END IF;
END $$;

COMMIT;
