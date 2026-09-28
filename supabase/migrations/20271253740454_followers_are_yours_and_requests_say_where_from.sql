-- followers are yours and requests say where from
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- THE PEOPLE REDESIGN — the database half (owner 2026-09-28, people-redesign.html).
--
-- Owner, verbatim: "just like how facebook, instagram and youtube offers. there
-- are followers but there are people connected to them" — and, answering the
-- prototype's open question: the Followers list is visible ONLY to the account
-- owner; strangers keep only the public count.
--
-- 1 · YOU SEE THE EDGES THAT POINT AT YOU. `user_follows` has so far been
--     readable only by the FOLLOWER (`follower_owns_follow`). A followers list
--     needs the other end: a row where followed_user_id = me. SELECT only — the
--     follower still owns the row, and only they may write or delete it. The
--     graph stays private: nobody reads an edge that does not touch them.
--
-- 2 · NAMES, ONLY FOR PEOPLE WITH A LIVE EDGE TO OR FROM YOU. Another account's
--     `users` row is invisible under RLS by design, so a list of followers
--     needs one door that hands back a name, a photo, the public handle and
--     whether their profile is public — and nothing for an id that has no
--     follow edge with the caller. Passing a stranger's id returns no row.
--
-- 3 · "FROM YOUR {EVENT} EVENT" MUST BE TRUE. The request copy the owner wrote
--     — "{name} is trying to add you from your {event} event" — is read off
--     person_connections.created_by_event_id. The insert policy never looked at
--     that column, so any account could stamp any event id on a request. The
--     guard below: whoever sets it must belong to that event (a member row or a
--     live seat). The recipient's side resolves the event's NAME only through
--     `events_host`, so an event they do not host never names itself either.
-- ============================================================================

-- ── 1 · the followed person reads the edges that point at them ─────────────
DROP POLICY IF EXISTS user_follows_followed_reads_own ON public.user_follows;
CREATE POLICY user_follows_followed_reads_own ON public.user_follows
  FOR SELECT TO authenticated
  USING (followed_user_id = auth.uid());

-- ── 2 · names for the people on either end of MY edges ───────────────────
CREATE OR REPLACE FUNCTION public.follow_people_names(p_user_ids uuid[])
RETURNS TABLE (
  user_id        uuid,
  public_id      text,
  display_name   text,
  photo_url      text,
  public_profile boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.user_id,
         u.public_id::text,
         u.display_name::text,
         u.profile_photo_url::text,
         coalesce(u.public_profile_enabled, false)
    FROM public.users u
   WHERE auth.uid() IS NOT NULL
     AND u.user_id = ANY (coalesce(p_user_ids, '{}'::uuid[]))
     AND u.user_id <> auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.user_follows f
        WHERE (f.follower_user_id = auth.uid() AND f.followed_user_id = u.user_id)
           OR (f.followed_user_id = auth.uid() AND f.follower_user_id = u.user_id)
     );
$$;

COMMENT ON FUNCTION public.follow_people_names(uuid[]) IS
  'People redesign (owner 2026-09-28): name, photo, public handle and public-profile flag for accounts that '
  'follow the caller or that the caller follows — and NOTHING for any other id. The one door a Following / '
  'Followers list reads names through; the follow graph itself stays private (user_follows RLS).';

REVOKE ALL ON FUNCTION public.follow_people_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_people_names(uuid[]) TO authenticated;

-- ── 3 · a request "from an event" comes from somebody at that event ─────────
CREATE OR REPLACE FUNCTION public.a_request_from_an_event_is_from_the_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by_event_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.created_by_event_id IS NOT DISTINCT FROM OLD.created_by_event_id THEN
    RETURN NEW;
  END IF;
  -- The service role and the migrations (no session) are the pipeline, not a
  -- person claiming to be at an event.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_members m
              WHERE m.event_id = NEW.created_by_event_id AND m.user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.event_moderators s
                 WHERE s.event_id = NEW.created_by_event_id AND s.user_id = auth.uid()
                   AND s.accepted_at IS NOT NULL AND s.removed_at IS NULL) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a request can only name an event its sender belongs to'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.a_request_from_an_event_is_from_the_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_request_from_an_event_is_from_the_event ON public.person_connections;
CREATE TRIGGER a_request_from_an_event_is_from_the_event
BEFORE INSERT OR UPDATE OF created_by_event_id ON public.person_connections
FOR EACH ROW EXECUTE FUNCTION public.a_request_from_an_event_is_from_the_event();

-- ── 4 · the recipient reads WHICH event a request came from ────────────────
-- Owner 2026-09-28 (DECISION_LOG "A CONNECTION REQUEST FROM AN EVENT ALWAYS
-- NAMES THE EVENT"), verbatim: "Ana is trying to add you from your Indalecio &
-- Claire wedding event" — for ANY celebrant recipient, co-host or not.
-- `events_host` answers only co-hosts, so a bride who is not a co-host read the
-- plain "Ana is trying to add you." This is the narrow door: per request, the
-- event's display name and kind — no other event column — and only when:
--   · the caller is the RECIPIENT (the to_person they have claimed),
--   · the request is still pending and carries created_by_event_id,
--   · the caller is a celebrant of that event (`is_event_celebrant`), or already
--     hosts it (a host could read the same two columns through events_host, so
--     that branch exposes nothing new — it covers a creator whose own guest row
--     carries no account link).
CREATE OR REPLACE FUNCTION public.connection_request_events()
RETURNS TABLE (
  connection_id uuid,
  event_name    text,
  event_type    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pc.connection_id,
         e.display_name::text,
         replace(e.event_type::text, '_', ' ')
    FROM public.person_connections pc
    JOIN public.people p
      ON p.person_id = pc.to_person_id
     AND p.claimed_by_user_id = auth.uid()
     AND p.deleted_at IS NULL
    JOIN public.events e
      ON e.event_id = pc.created_by_event_id
   WHERE auth.uid() IS NOT NULL
     AND pc.deleted_at IS NULL
     AND pc.status = 'pending'
     AND pc.created_by_event_id IS NOT NULL
     AND (
       public.is_event_celebrant(pc.created_by_event_id, auth.uid())
       OR pc.created_by_event_id IN (SELECT public.current_couple_event_ids())
       OR pc.created_by_event_id IN (SELECT public.current_moderator_event_ids())
     );
$$;

COMMENT ON FUNCTION public.connection_request_events() IS
  'Owner 2026-09-28: a connection request from an event always names the event. For each PENDING request '
  'addressed to the caller that carries created_by_event_id, the event''s display name and kind — nothing else — '
  'when the caller is a celebrant of that event (is_event_celebrant) or already hosts it.';

REVOKE ALL ON FUNCTION public.connection_request_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connection_request_events() TO authenticated;
