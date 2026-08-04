-- ============================================================================
-- THE SONG DESK READ AUDIENCE — the people who actually work the night could
-- not read any of it, and the desk said so as if it were the couple's fault.
--
-- Found by the gap + security audit on 2026-07-30, immediately after PR #3885
-- shipped the band's view of the host's playlist. Three findings, all LATENT
-- rather than live — verified against prod, not assumed: the only two booked
-- music rows are host-manual (`marketplace_vendor_id IS NULL`), plus 0 live
-- day-of grants, 0 requests, 0 playlist picks, 0 `vendor_dayof_configs` rows. So
-- no vendor can reach the desk in prod yet, which makes this the cheapest
-- possible moment to fix it.
--
-- ── ① A VENDOR TEAM MEMBER READ ZERO PLAYLIST ROWS ─────────────────────────
--
-- `event_playlist_picks_music_vendor_read` (20260622000000) hand-rolled its own
-- audience:
--
--     JOIN vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
--     WHERE vp.user_id = auth.uid()          -- the profile OWNER, and nobody else
--
-- while `current_vendor_booked_event_ids()` — the ONE definition of "booked",
-- used by `event_song_picks` and (until PR 1b) `event_song_requests` — resolves
-- the whole org: profile owner UNION `vendor_team_members`. Two definitions of
-- the same word, and the older one is narrower.
--
-- ── ② A DAY-OF GRANTEE READ ZERO FROM BOTH SONG TABLES ─────────────────────
--
-- Worse, and older than PR #3885. `live/[eventId]/page.tsx` resolves a grantee's
-- vendor profile through the ADMIN client, on the stated grounds that "the grant
-- is the authorization" — but `SongDesk` reads with the request-scoped client
-- under the grantee's own RLS. A grantee is in neither the owner leg nor the
-- team-member leg, and `current_vendor_booked_event_ids()` does not include
-- grantees either. So the ENTIRE song desk has rendered as "the couple haven't
-- picked any songs yet" for every day-of grantee since PR #3803.
--
-- ── WHY THESE ARE FIXED IN SQL AND NOT BY PASSING A CLIENT AROUND ──────────
--
-- The obvious code fix — hand the surface the admin client the page already
-- resolved — would put a service_role client into `SpecializationSurfaceProps`,
-- where every future specialization surface inherits it and the registry's
-- "scope every read yourself" warning becomes the only thing standing between a
-- careless query and the whole table. The grant is genuine authorisation, so it
-- belongs in the policy where it is enforced for everyone, not in a prop.
--
-- `current_vendor_dayof_grant_event_ids()` already exists (20270810694086):
-- SECURITY DEFINER, STABLE, `revoked_at IS NULL`, granted to `authenticated`.
-- ① and ② are therefore both audience edits, no new helper, no new table.
--
-- ⚠ NOTE ON THE GRANTEE PREDICATE: for the playlist it is written out as an
-- EXISTS against `vendor_event_access_grants` rather than reusing that helper,
-- because the helper returns event_ids only — it drops the vendor binding. The
-- EXISTS keeps `g.vendor_profile_id = ev.marketplace_vendor_id`, so crew granted
-- access by the FLORIST cannot read the BAND's playlist on the same event. For
-- `event_song_picks` the helper is enough: that policy is deliberately not
-- narrowed to music vendors at all (see its own comment), so there is no vendor
-- binding to preserve.
--
-- ── WHAT IS DELIBERATELY *NOT* CHANGED ─────────────────────────────────────
--
-- The category list (`band_dj` / `host_emcee` / `choir` / `string_quartet`)
-- stays exactly as it is. The audit's first hypothesis was that it had drifted
-- from `MUSIC_CANONICALS` in lib/songs.ts (`live_band` / `choir` / `orchestra` /
-- `wedding_singer` / `dj`) — it has NOT. Those are two different vocabularies for
-- two different columns: this list is the legacy `vendor_category` ENUM, which is
-- what `event_vendors.category` actually holds and what real prod bookings carry;
-- `MUSIC_CANONICALS` keys live in `vendor_profiles.services[]` and in the
-- dual-written `event_vendors.category_key` column that nothing reads yet.
-- "Fixing" this list to the canonical keys would break every booking.
--
-- `current_vendor_booked_event_ids()` is also NOT widened to include grantees,
-- though that would have fixed ② in one line. It is shared by
-- `event_schedule_blocks`, `event_song_picks` and others, so widening it is a
-- blast-radius decision rather than a bug fix. Each policy opts in explicitly.
--
-- ── ③ BOTH SONG TABLES STILL SHIPPED OPEN ──────────────────────────────────
--
-- Neither `event_playlist_picks` (20260622000000) nor `event_song_picks`
-- (20260731000000) ever emitted the REVOKE that every relation in `public` needs
-- — ALTER DEFAULT PRIVILEGES grants `arwdDxtm` to anon AND authenticated, the
-- root cause of the 368-table exposure. The baseline reads
-- `tpriv public.event_playlist_picks|anon SIUD` and the same for
-- `event_song_picks`, with every column at `anon=SIU`.
--
-- Not exploitable today — every policy on both tables is `TO authenticated`, so
-- an anon caller holds the GRANT but no policy admits a single row. It is the
-- shape that becomes a hole the day someone adds a permissive policy, exactly as
-- `vendor_dayof_configs` was before 20271014100000 closed it. Same treatment,
-- same reasoning, and this migration is already here.
--
-- `authenticated` keeps all four verbs on both tables: the host policies are
-- `FOR ALL` (a couple adds AND removes songs), so unlike `vendor_dayof_configs`
-- there is no DELETE privilege here that backs no policy.
--
-- ⚠ THE FREEZE WILL FAIL ON THIS UNTIL THE BASELINE IS REGENERATED. The grant
-- revokes are narrowings the guard accepts silently, but the two POLICY
-- PREDICATE edits are not: it fingerprints predicates and refuses to
-- mechanically prove one narrows, so a human reads the diff. Regenerated in this
-- same PR, and this one genuinely WIDENS the read audience — deliberately, to
-- crew who already hold day-of console access — which is precisely the kind of
-- change that file exists to put in front of a reviewer.
-- ============================================================================

BEGIN;

-- ── ① + ② · the playlist: the act's whole org, plus the crew they granted ──
DROP POLICY IF EXISTS event_playlist_picks_music_vendor_read ON public.event_playlist_picks;
CREATE POLICY event_playlist_picks_music_vendor_read
  ON public.event_playlist_picks FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT ev.event_id
      FROM public.event_vendors ev
      WHERE ev.category IN ('band_dj', 'host_emcee', 'choir', 'string_quartet')
        AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND (
          -- The act itself — owner OR team member, the same org resolution
          -- `current_vendor_booked_event_ids()` uses.
          ev.marketplace_vendor_id IN (
            SELECT vp.vendor_profile_id
            FROM public.vendor_profiles vp
            WHERE vp.user_id = auth.uid()
            UNION
            SELECT tm.vendor_profile_id
            FROM public.vendor_team_members tm
            WHERE tm.user_id = auth.uid()
          )
          -- …or crew this same act granted day-of access to, for this same
          -- event. The vendor binding is the point: a florist's grantee gets
          -- nothing here.
          OR EXISTS (
            SELECT 1
            FROM public.vendor_event_access_grants g
            WHERE g.grantee_user_id = auth.uid()
              AND g.revoked_at IS NULL
              AND g.event_id = ev.event_id
              AND g.vendor_profile_id = ev.marketplace_vendor_id
          )
        )
    )
  );

COMMENT ON POLICY event_playlist_picks_music_vendor_read ON public.event_playlist_picks IS
  'The booked music act reads the couple''s per-moment playlist. Audience widened '
  '2026-07-30: the profile OWNER (as before), plus vendor_team_members (the org '
  'resolution current_vendor_booked_event_ids() already used, so crew stop reading '
  'zero), plus day-of access grantees bound to the SAME event AND the SAME vendor. '
  'Category + status gate unchanged — the list is the legacy vendor_category enum '
  'that event_vendors.category holds, NOT the MUSIC_CANONICALS taxonomy keys.';

-- ── ② · the flat song picks: grantees join the booked org ──────────────────
-- The helper is sufficient here (no vendor binding to preserve — this policy is
-- deliberately not narrowed to music vendors, so that narrowing stays absent).
DROP POLICY IF EXISTS event_song_picks_booked_vendor_read ON public.event_song_picks;
CREATE POLICY event_song_picks_booked_vendor_read
  ON public.event_song_picks FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    OR event_id IN (SELECT public.current_vendor_dayof_grant_event_ids())
  );

COMMENT ON POLICY event_song_picks_booked_vendor_read ON public.event_song_picks IS
  'The booked vendor reads the couple''s song picks so the song desk can cross them '
  'against the repertoire. Deliberately NOT narrowed to music vendors: narrowing '
  'means hardcoding taxonomy keys into SQL where they drift from MUSIC_CANONICALS. '
  'Day-of grantees added 2026-07-30 — the page authorises a grantee via the admin '
  'client, so without this leg the desk rendered "no songs picked" at them, which '
  'was false.';

-- ── ③ · both tables lose the default ACL they never had revoked ────────────
-- The 20271014100000 shape: strip anon entirely, leave authenticated the verbs
-- its policies actually back. Nothing that works today loses anything.
REVOKE ALL ON TABLE public.event_playlist_picks FROM anon;
REVOKE ALL ON TABLE public.event_song_picks FROM anon;

-- ── Post-conditions · a half-applied change fails the migration ────────────
DO $$
DECLARE
  v_qual TEXT;
  v_priv TEXT;
BEGIN
  -- anon must hold nothing on either table.
  FOR v_priv IN SELECT unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) LOOP
    IF has_table_privilege('anon', 'public.event_playlist_picks', v_priv) THEN
      RAISE EXCEPTION 'anon still holds % on event_playlist_picks', v_priv;
    END IF;
    IF has_table_privilege('anon', 'public.event_song_picks', v_priv) THEN
      RAISE EXCEPTION 'anon still holds % on event_song_picks', v_priv;
    END IF;
  END LOOP;

  -- …and authenticated must NOT have lost the verbs the host policies back.
  FOR v_priv IN SELECT unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) LOOP
    IF NOT has_table_privilege('authenticated', 'public.event_playlist_picks', v_priv) THEN
      RAISE EXCEPTION
        'authenticated lost % on event_playlist_picks — the couple''s FOR ALL policy needs it', v_priv;
    END IF;
  END LOOP;

  -- The playlist policy must name all three audiences.
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'event_playlist_picks'
    AND policyname = 'event_playlist_picks_music_vendor_read';
  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'event_playlist_picks_music_vendor_read is missing';
  END IF;
  IF v_qual NOT LIKE '%vendor_team_members%' THEN
    RAISE EXCEPTION 'the playlist read still excludes vendor_team_members — crew would read zero';
  END IF;
  IF v_qual NOT LIKE '%vendor_event_access_grants%' THEN
    RAISE EXCEPTION 'the playlist read still excludes day-of grantees — crew would read zero';
  END IF;
  IF v_qual NOT LIKE '%band_dj%' THEN
    RAISE EXCEPTION 'the category gate was dropped — this policy must stay music-only';
  END IF;

  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'event_song_picks'
    AND policyname = 'event_song_picks_booked_vendor_read';
  IF coalesce(v_qual, '') NOT LIKE '%current_vendor_dayof_grant_event_ids%' THEN
    RAISE EXCEPTION 'event_song_picks still excludes day-of grantees';
  END IF;
  IF coalesce(v_qual, '') NOT LIKE '%current_vendor_booked_event_ids%' THEN
    RAISE EXCEPTION 'event_song_picks lost the booked-vendor leg it is supposed to keep';
  END IF;
END $$;

COMMIT;
