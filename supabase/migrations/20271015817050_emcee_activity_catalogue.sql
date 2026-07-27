-- ═══════════════════════════════════════════════════════════════════════════
-- THE EMCEE'S ACTIVITY CATALOGUE — the host/MC's reusable segments, and the
-- couple's picks from them.
--
-- Owner, 2026-07-27: "emcees will list all his activities that the hosts can
-- pick from", and (on what survives a wedding) "stays per wedding. but his
-- questionaire can be saved as his template. to use for succeeding customers."
-- The same split applies here and is the whole design: the CATALOGUE is the
-- emcee's craft and travels with him; the PICKS belong to one event and die
-- with it. Nothing personal to a couple ever rides along to the next wedding.
--
-- ── WHY NOT vendor_package_items ───────────────────────────────────────────
--
-- That table is the project's own worked example of "the catalogue picker you
-- were about to build already exists" (CLAUDE.md Rule 0 §3), so it was the
-- first thing checked. It is the wrong vessel, for three reasons that are
-- properties of that table rather than preferences:
--
--   1. It is a MONEY object. `replacement_value_centavos` is a refund into the
--      consumable pool when the host unchecks a line. Un-picking "the shoe
--      game" must not move money.
--   2. It carries no TIME. An activity's whole use is that it knows how long
--      it takes, so a picked one can become a schedule block.
--   3. It FREEZES. `editScopeForPackage(activeBookingCount)` drops a package to
--      metadata-only once any booking exists — correct for a priced package,
--      fatal for a repertoire that must keep improving across customers.
--
-- ── WHAT THIS *IS* — the second instance of a shipped pattern ──────────────
--
-- Structurally identical to the band's repertoire, which already ships and
-- already feeds a day-of specialization:
--
--     vendor_songs      ↔ vendor_activities      (the vendor's reusable list)
--     event_song_picks  ↔ event_activity_picks   (the couple's picks)
--
-- Same RLS idioms (`current_vendor_ids()` to author, `current_event_ids()` to
-- pick), same shape of read on the day-of desk. Nothing here is a new pattern;
-- it is an existing one applied to a second trade.
--
-- ── THE LANE THE SONG DESK NEEDED LATER, BUILT IN NOW ──────────────────────
--
-- `event_song_picks` shipped host-scoped only, and a booked vendor could not
-- read the couple's picks at all — which is why the song desk needed a further
-- migration before it could exist. The booked-vendor SELECT lane on
-- `event_activity_picks` is included here from the start so the emcee's desk
-- does not repeat that round trip.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · vendor_activities — the emcee's own reusable segments ──────────────

CREATE TABLE IF NOT EXISTS public.vendor_activities (
  activity_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- What the couple sees on the menu, and what lands on the timeline.
  label             TEXT NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  -- The emcee's own words about what it is — shown while picking, never on
  -- the guest-facing timeline.
  blurb             TEXT CHECK (blurb IS NULL OR length(btrim(blurb)) <= 400),
  -- The reason this table exists rather than reusing a priced line item: a
  -- picked activity becomes a schedule block, and a block needs a length.
  duration_minutes  INTEGER NOT NULL DEFAULT 15
                    CHECK (duration_minutes BETWEEN 1 AND 480),
  -- Which part of the day it belongs to. Mirrors event_schedule_blocks.block_type
  -- as TEXT (no FK — it is an app-level enum there too), so a picked activity
  -- can be inserted as a block without a translation table.
  block_type        TEXT NOT NULL DEFAULT 'program',
  -- FALSE = the emcee keeps it in his catalogue but stops offering it. A soft
  -- retire: existing picks on past events keep resolving.
  is_offered        BOOLEAN NOT NULL DEFAULT TRUE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One emcee's menu, in his order — the only read the picker does.
CREATE INDEX IF NOT EXISTS vendor_activities_vendor_idx
  ON public.vendor_activities (vendor_profile_id, display_order);

ALTER TABLE public.vendor_activities ENABLE ROW LEVEL SECURITY;

-- Public read, exactly like vendor_songs: a couple comparing emcees needs to
-- see what each one actually does. The catalogue is marketing, not private.
DROP POLICY IF EXISTS vendor_activities_public_select ON public.vendor_activities;
CREATE POLICY vendor_activities_public_select
  ON public.vendor_activities FOR SELECT
  TO anon, authenticated
  USING (true);

-- The emcee manages his own — canonical current_vendor_ids() idiom.
DROP POLICY IF EXISTS vendor_activities_owner_write ON public.vendor_activities;
CREATE POLICY vendor_activities_owner_write
  ON public.vendor_activities FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.vendor_activities IS
  'A host/MC''s reusable programme segments — the catalogue a couple picks from. Travels with the vendor across weddings (owner 2026-07-27); the picks in event_activity_picks do not. Sibling of vendor_songs.';

-- ── 2 · event_activity_picks — what THIS couple chose ─────────────────────

CREATE TABLE IF NOT EXISTS public.event_activity_picks (
  event_id    UUID NOT NULL
              REFERENCES public.events(event_id) ON DELETE CASCADE,
  activity_id UUID NOT NULL
              REFERENCES public.vendor_activities(activity_id) ON DELETE CASCADE,
  -- Set when a pick has been turned into a real schedule block, so the bridge
  -- is idempotent and the couple can see what has already landed on the day.
  -- NULL = picked but not yet placed on the timeline.
  scheduled_block_id UUID
              REFERENCES public.event_schedule_blocks(block_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, activity_id)
);

CREATE INDEX IF NOT EXISTS event_activity_picks_activity_idx
  ON public.event_activity_picks (activity_id);

ALTER TABLE public.event_activity_picks ENABLE ROW LEVEL SECURITY;

-- The couple reads + writes their own picks (current_event_ids idiom, exactly
-- as event_song_picks does).
DROP POLICY IF EXISTS event_activity_picks_host_select ON public.event_activity_picks;
CREATE POLICY event_activity_picks_host_select
  ON public.event_activity_picks FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_activity_picks_host_write ON public.event_activity_picks;
CREATE POLICY event_activity_picks_host_write
  ON public.event_activity_picks FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- THE LANE THE SONG DESK HAD TO ADD LATER. Without this the emcee cannot see
-- what the couple picked from HIS OWN menu — the desk would be blind to its
-- own catalogue. Scoped twice over: the vendor must be booked on the event
-- (`current_vendor_booked_event_ids()`, the same helper the schedule read
-- uses) AND the activity must be one of theirs. A booked vendor still cannot
-- read another vendor's picks on the same event.
DROP POLICY IF EXISTS event_activity_picks_booked_vendor_select ON public.event_activity_picks;
CREATE POLICY event_activity_picks_booked_vendor_select
  ON public.event_activity_picks FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND activity_id IN (
      SELECT a.activity_id
      FROM public.vendor_activities a
      WHERE a.vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  );

COMMENT ON TABLE public.event_activity_picks IS
  'Which of an emcee''s catalogue activities THIS couple chose. Per-event and non-portable by design (owner 2026-07-27: picks stay per wedding, the catalogue travels). scheduled_block_id links a pick to the timeline block it became.';

-- ── 3 · Close the default-open grant ──────────────────────────────────────
--
-- Every new table in `public` ships OPEN: the database's default ACL grants
-- arwdDxtm to anon + authenticated, and RLS alone does not undo a table-level
-- GRANT. This is the documented root cause of the 368-table exposure, so the
-- REVOKE is mandatory in every migration, not a precaution. Reads and writes
-- then flow only through the policies above.

REVOKE ALL ON public.vendor_activities FROM anon, authenticated;
REVOKE ALL ON public.event_activity_picks FROM anon, authenticated;

GRANT SELECT ON public.vendor_activities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vendor_activities TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_activity_picks TO authenticated;

COMMIT;
