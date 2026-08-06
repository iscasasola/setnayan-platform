-- The couple could not see their own band's set list. Owner: "make it On.
-- couple or host of event should see the song list for their event."
--
-- The set list has shipped for a while — tables, editor, and a pure builder with
-- its own tests — but each table carried EXACTLY ONE policy, `*_act_manage`, FOR
-- ALL, whose audience is the vendor, a day-of grantee, or an admin. There is no
-- couple leg. That single missing predicate is the entire reason the feature did
-- not exist for the person the wedding belongs to.
--
-- Purely additive: nothing is revoked, the write path is untouched, and no grant
-- changes — SELECT is already granted to `authenticated` on both tables and only
-- RLS was refusing.
--
-- 🔑 `current_couple_event_ids()`, NOT `current_couple_or_coordinator_event_ids()`.
-- Both would read plausibly, but the two sibling reads on the very same page —
-- `event_playlist_picks_couple_read` and `event_vendors_couple_read` — are
-- couple-only. A coordinator admitted here would see the band's sets on a page
-- where they can read neither the couple's own picks nor the act's name. In this
-- codebase "host" MEANS the couple (`buildHostPlaylist`, `hostPicksBySlot`), so
-- the owner's "couple or host" is one person, not a delegate.
--
-- 🔑 NO `OR public.is_admin()`. The existing `*_act_manage` policy is FOR ALL and
-- already contains it; permissive policies OR together, so admins already read.
-- Repeating it would be dead predicate that later readers must re-verify.

CREATE POLICY vendor_event_sets_couple_read
  ON public.vendor_event_sets
  FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- The child uses the same EXISTS idiom as its sibling policy, so parent and
-- child can never drift into disagreeing about who may read a set.
CREATE POLICY vendor_event_set_songs_couple_read
  ON public.vendor_event_set_songs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.vendor_event_sets s
       WHERE s.set_id = vendor_event_set_songs.set_id
         AND s.event_id IN (SELECT public.current_couple_event_ids())
    )
  );

-- Post-conditions: the policies landed, and nothing leaked to anon.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'vendor_event_sets'
       AND policyname = 'vendor_event_sets_couple_read'
  ) THEN
    RAISE EXCEPTION 'vendor_event_sets_couple_read did not land';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'vendor_event_set_songs'
       AND policyname = 'vendor_event_set_songs_couple_read'
  ) THEN
    RAISE EXCEPTION 'vendor_event_set_songs_couple_read did not land';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('vendor_event_sets', 'vendor_event_set_songs')
       AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'anon gained a privilege on the set-list tables';
  END IF;
END $$;
