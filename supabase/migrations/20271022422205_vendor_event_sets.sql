-- ============================================================================
-- SETS — a band thinks in sets, not in a flat list.  (Song Desk PR 5, the last)
--
-- Owner, verbatim 2026-07-27: "this is where we can set songlist for different
-- sets. so the band can set 1/2/3/4/5/6 sets, and name the x number of songs per
-- set." And: "they can place songs per set. they can choose."
--
-- ── WHAT THE OWNER'S ANSWERS ALREADY REMOVED FROM THIS PR ──────────────────
--
-- Both of PR 5's blocking questions were answered on 2026-07-30, and each answer
-- DELETED work rather than adding it:
--
--   • "allow requests (anytime)" = ALWAYS-ON, not a mode. So there is no "only
--     during the sets I choose" window, and therefore **no request-window
--     relationship on a set at all**. Sets are purely the band's setlist.
--   • an ACCEPTED request is NOT filed into a set — "accept means we'll play it",
--     full stop. So there is no `from_request_id` on the join table and no
--     set-picker in the accept flow. The prototype's "from a request" chip is a
--     DISPLAY affordance on the accepted list, not membership in a set.
--
-- ── 🚨 THE ONE CONSTRAINT THAT MAKES SETS WORTH BUILDING ────────────────────
--
-- A set keys to `playlist_slot_type` — the SAME vocabulary the host's picks use —
-- never a second one. The contract's warning is the whole design rationale: if the
-- band's sets say "After Party" while the host's picks say `open_floor`, the two
-- lists can never be compared, "which destroys the entire point". As of migration
-- 20271022150821 that vocabulary is ELEVEN values, and `grand_entrance` matters
-- here specifically: a PH band's Set 1 usually IS the entrance.
--
-- `name` is the band's own label ("Slow burn", "Last call") and is free text —
-- that is theirs. `slot_type` is the machine-comparable anchor and is NOT NULL.
--
-- ⚠ THE SIMPLIFICATION, STATED: one slot per set. A real "Set 3 · Party" may
-- straddle the tail of dinner and all of the open floor, and this models it as
-- one moment. Chosen because comparability is the point and a set with no anchor
-- cannot be compared to anything; if the owner wants a set to span moments, that
-- is a `vendor_event_set_slots` join later, not a nullable column now (a nullable
-- anchor would let the comparison silently go missing, which is the failure this
-- constraint exists to prevent).
--
-- ── 1–6, ENFORCED IN THE DATABASE ──────────────────────────────────────────
--
-- "1/2/3/4/5/6 sets" is a real bound, so `position BETWEEN 1 AND 6` is a CHECK
-- and `UNIQUE (event_id, vendor_profile_id, position)` stops two Set 3s. Not
-- app-only: the app is one of several possible writers and this is the kind of
-- rule that decays into "mostly six".
--
-- ── SONGS COME FROM THE REPERTOIRE, AND ARE PLACED BY HAND ──────────────────
--
-- Owner: "no auto-fill, no recommender". The join carries (set, song, position)
-- and nothing else — no confidence, no source, no suggestion flag, because there
-- is no suggester. `song_id` FKs the master catalogue so a set song is the same
-- identity the host's picks and the repertoire use (the crossing PR 3 made exact).
--
-- ⚠ "must be in the band's repertoire" is enforced in the ACTION, not here. A
-- composite FK to `vendor_songs` would look tidier but would CASCADE-delete a
-- placed set song the moment a band tidied their repertoire mid-event — losing the
-- setlist they are playing from. Keeping the FK on `songs` means removing a song
-- from the repertoire leaves the set intact, which is the behaviour a musician
-- expects.
--
-- ── AUDIENCE: THE BAND'S OWN, DELIBERATELY NOT THE HOST'S ──────────────────
--
-- Read + write for the vendor org (owner ∪ team members) and day-of grantees —
-- the same audience as every other song-desk surface, via the same two shared
-- helpers, because two audiences for two halves of one screen is the class of bug
-- this stream spent 2026-07-30 closing.
--
-- ⏭ The HOST cannot read these. A set is a working document — a band drafting
-- "Set 4 · Last call" should not have the couple watching every keystroke, and
-- nothing in the owner's brief asks for it. Showing the couple a finished setlist
-- is a plausible NEXT feature and an owner call, not something to assume by
-- widening a policy today.
--
-- ── RA 10173 ───────────────────────────────────────────────────────────────
--
-- Deliberately NO `created_by_user_id` on either table: a set belongs to the
-- BUSINESS, not to whichever crew member typed it, and adding a subject column
-- would demand an erasure/export decision for data that is not about a person.
-- Both guardrails stay silent because there is genuinely nothing personal here.
-- ============================================================================

BEGIN;

-- ── The sets themselves ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_event_sets (
  set_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- "1/2/3/4/5/6 sets" — a real bound, kept in the database.
  position           SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 6),
  -- The band's own label. Theirs to write; never parsed, never matched on.
  name               TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- 🚨 The machine-comparable anchor, in the HOST'S vocabulary. See the header.
  slot_type          public.playlist_slot_type NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_event_sets_one_per_position UNIQUE (event_id, vendor_profile_id, position)
);

CREATE INDEX IF NOT EXISTS vendor_event_sets_event_vendor_idx
  ON public.vendor_event_sets (event_id, vendor_profile_id, position);

-- ── The songs in them ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_event_set_songs (
  set_song_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id       UUID NOT NULL REFERENCES public.vendor_event_sets(set_id) ON DELETE CASCADE,
  -- The master catalogue, NOT vendor_songs — see the header: a band tidying their
  -- repertoire mid-event must not lose the setlist they are playing from.
  song_id      BIGINT NOT NULL REFERENCES public.songs(song_id) ON DELETE CASCADE,
  -- Gap-100 spacing, the same idiom as event_playlist_picks.sort_order, so an
  -- insert between two songs needs no bulk renumber. Deliberately NOT unique:
  -- a reorder writes new positions and a transient collision must not fail.
  position     INTEGER NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One song once per set. Twice in a set is always a mistake; twice in the NIGHT
  -- (two different sets) is legitimate and stays allowed.
  CONSTRAINT vendor_event_set_songs_once UNIQUE (set_id, song_id)
);

CREATE INDEX IF NOT EXISTS vendor_event_set_songs_set_idx
  ON public.vendor_event_set_songs (set_id, position);

-- ── RLS at CREATE TABLE time, and the REVOKE every relation in public needs ─
-- ALTER DEFAULT PRIVILEGES grants arwdDxtm to anon AND authenticated — the root
-- cause of the 368-table exposure. Revoke first, grant back narrowly.
ALTER TABLE public.vendor_event_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_event_set_songs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vendor_event_sets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.vendor_event_set_songs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_event_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_event_set_songs TO authenticated;

-- The act's own working document: the org plus the crew they granted day-of access
-- to. `current_vendor_profile_ids()` is the SAME helper `vendor_dayof_configs`
-- uses — profile owner UNION team members at admin rank or above — chosen for
-- consistency with the rest of the day-of config surface rather than inventing a
-- third audience here.
--
-- ⚠ Note the rank: a team member BELOW admin cannot manage sets. That matches
-- every other per-booking vendor config today. If a band wants a junior member
-- editing setlists, the fix is that helper's rank floor (one place), not a
-- special case in this policy.
DROP POLICY IF EXISTS vendor_event_sets_act_manage ON public.vendor_event_sets;
CREATE POLICY vendor_event_sets_act_manage
  ON public.vendor_event_sets FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR event_id IN (SELECT public.current_vendor_dayof_grant_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR event_id IN (SELECT public.current_vendor_dayof_grant_event_ids())
    OR public.is_admin()
  );

-- The join inherits its parent's audience by EXISTS rather than repeating the
-- predicate: one definition of "may touch this set", so the two can never drift.
DROP POLICY IF EXISTS vendor_event_set_songs_act_manage ON public.vendor_event_set_songs;
CREATE POLICY vendor_event_set_songs_act_manage
  ON public.vendor_event_set_songs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_event_sets s
      WHERE s.set_id = vendor_event_set_songs.set_id
        AND (
          s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
          OR s.event_id IN (SELECT public.current_vendor_dayof_grant_event_ids())
          OR public.is_admin()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_event_sets s
      WHERE s.set_id = vendor_event_set_songs.set_id
        AND (
          s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
          OR s.event_id IN (SELECT public.current_vendor_dayof_grant_event_ids())
          OR public.is_admin()
        )
    )
  );

COMMENT ON TABLE public.vendor_event_sets IS
  'The band''s 1–6 named sets for one booking (owner 2026-07-27: "the band can set '
  '1/2/3/4/5/6 sets, and name the x number of songs per set"). `name` is the band''s '
  'own label; `slot_type` is the ANCHOR and uses the HOST''S vocabulary '
  '(playlist_slot_type, 11 values) so a set can be compared to the couple''s picks — '
  'a second vocabulary would destroy the point. NOT the host''s to read: a set is a '
  'working document. No request-window column: requests are always-on (2026-07-30), '
  'so there is no "only during the sets I choose" mode.';

COMMENT ON TABLE public.vendor_event_set_songs IS
  'Songs the band PLACED BY HAND in a set (owner: "no auto-fill, no recommender") — '
  'so the row carries position and nothing else: no confidence, no source, no '
  'suggestion flag, because there is no suggester. FK is `songs`, NOT `vendor_songs`: '
  'a band tidying their repertoire mid-event must not lose the setlist they are '
  'playing from. UNIQUE (set_id, song_id) — twice in one set is a mistake, twice in '
  'the night is legitimate.';

CREATE OR REPLACE FUNCTION public.tg_vendor_event_sets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_event_sets_set_updated_at ON public.vendor_event_sets;
CREATE TRIGGER vendor_event_sets_set_updated_at
  BEFORE UPDATE ON public.vendor_event_sets
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_event_sets_set_updated_at();

-- ── Post-conditions ────────────────────────────────────────────────────────
DO $$
DECLARE v_priv TEXT;
BEGIN
  FOR v_priv IN SELECT unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) LOOP
    IF has_table_privilege('anon', 'public.vendor_event_sets', v_priv) THEN
      RAISE EXCEPTION 'anon holds % on vendor_event_sets', v_priv;
    END IF;
    IF has_table_privilege('anon', 'public.vendor_event_set_songs', v_priv) THEN
      RAISE EXCEPTION 'anon holds % on vendor_event_set_songs', v_priv;
    END IF;
  END LOOP;

  -- The anchor must be the HOST's enum, not a text column that could drift.
  IF (SELECT udt_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='vendor_event_sets' AND column_name='slot_type')
     IS DISTINCT FROM 'playlist_slot_type' THEN
    RAISE EXCEPTION 'vendor_event_sets.slot_type must BE playlist_slot_type — a second vocabulary breaks the comparison';
  END IF;

  -- And it must not be nullable: an unanchored set cannot be compared to anything.
  IF (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='vendor_event_sets' AND column_name='slot_type') <> 'NO' THEN
    RAISE EXCEPTION 'slot_type must be NOT NULL';
  END IF;
END $$;

COMMIT;
