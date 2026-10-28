-- samahan_reads
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
--
-- GROUP UNREAD — a per-member read marker for a group's chat (owner 2026-10-28,
-- DECISION_LOG "APPROVED — RSVP ANSWERS ON THE GUEST LIST + GROUP UNREAD"; drawing
-- Groups frame). People › Groups shows an unread group as a bold last line + a
-- count badge, and the pinned row's door "N unread" filters to them. Opening a
-- group marks it read — ONE small write, never a live connection.
--
-- The shape is chat_thread_reads' (20260728000000): one row per (group, member),
-- the member's own row only (Pattern A — self). The WITH CHECK also demands
-- membership, so nobody writes a marker on a group they are not in.
--
-- WHY NOT a column on community_members: that table's UPDATE policy is the
-- organizer's (roles), and a member's read state is not a roster fact. A
-- separate table keeps "who is in the group" and "what I have read" apart.
--
-- No marker yet (a member who has never opened the group since this shipped)
-- counts from when they JOINED — never from the epoch, which would light every
-- old group with its whole history on day one.

BEGIN;

CREATE TABLE IF NOT EXISTS public.samahan_reads (
  community_id  UUID NOT NULL REFERENCES public.communities(community_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

COMMENT ON TABLE public.samahan_reads IS
  'Group unread (owner 2026-10-28): one read marker per (group, member). The member''s own row only; written by mark_samahan_read() when they open the group. Unread = messages from others newer than last_read_at (or than joined_at when no marker yet), counted by samahan_unread_counts().';

CREATE INDEX IF NOT EXISTS samahan_reads_user_idx ON public.samahan_reads (user_id);

ALTER TABLE public.samahan_reads ENABLE ROW LEVEL SECURITY;

-- Default-ACL hygiene: close everything, grant exactly what the policy scopes.
-- No DELETE: a marker goes with the membership (CASCADE) or the account.
REVOKE ALL ON public.samahan_reads FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.samahan_reads TO authenticated;

-- Pattern A (self): a member reads and writes only their own marker, and only on
-- a group they belong to.
DROP POLICY IF EXISTS samahan_reads_self ON public.samahan_reads;
CREATE POLICY samahan_reads_self ON public.samahan_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND community_id IN (SELECT public.current_community_ids())
  );

-- Opening a group: the marker moves to the server's NOW (never the browser's
-- clock). SECURITY INVOKER — the policy above is the gate.
CREATE OR REPLACE FUNCTION public.mark_samahan_read(p_community_id UUID)
RETURNS VOID
LANGUAGE SQL SECURITY INVOKER VOLATILE SET search_path = public
AS $$
  INSERT INTO public.samahan_reads (community_id, user_id, last_read_at)
  VALUES (p_community_id, auth.uid(), NOW())
  ON CONFLICT (community_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
$$;

-- Every group the caller is in, with how many messages from OTHER members are
-- newer than their marker (or their join). ONE call for every row on People ›
-- Groups. SECURITY INVOKER: samahan_messages' member-read policy still applies,
-- and taken-down messages (deleted_at) never count.
CREATE OR REPLACE FUNCTION public.samahan_unread_counts()
RETURNS TABLE (community_id UUID, unread INTEGER)
LANGUAGE SQL SECURITY INVOKER STABLE SET search_path = public
AS $$
  SELECT cm.community_id,
         (SELECT COUNT(*)::int
            FROM public.samahan_messages m
           WHERE m.community_id = cm.community_id
             AND m.deleted_at IS NULL
             AND m.user_id <> auth.uid()
             AND m.created_at > COALESCE(
                   (SELECT r.last_read_at FROM public.samahan_reads r
                     WHERE r.community_id = cm.community_id AND r.user_id = auth.uid()),
                   cm.joined_at)) AS unread
    FROM public.community_members cm
   WHERE cm.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.mark_samahan_read(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.samahan_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_samahan_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.samahan_unread_counts() TO authenticated;

COMMIT;
