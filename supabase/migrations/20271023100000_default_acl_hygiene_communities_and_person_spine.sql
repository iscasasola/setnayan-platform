-- ============================================================================
-- Default-ACL hygiene — the Samahan trio + the person spine
--
-- WHY: every table created in `public` inherits a default ACL granting
-- arwdDxtm to BOTH `anon` and `authenticated`. The Supabase anon key is public
-- by design, so any browser can act as `anon`. Six tables shipped without the
-- REVOKE that every migration is supposed to carry, leaving RLS as the ONLY
-- thing between an anonymous request and them. This is the same root cause as
-- the 368-table exposure.
--
-- VERIFIED against live production before writing (not inferred from the
-- migration files, which have recorded things as applied that never landed):
--
--   communities              anon + authenticated  DELETE,INSERT,REFERENCES,
--   community_members        anon + authenticated  SELECT,TRIGGER,TRUNCATE,
--   community_invite_tokens  anon + authenticated  UPDATE
--   people                   anon + authenticated
--   person_connections       anon + authenticated
--   person_stewardships      anon + authenticated
--
-- All six. Including TRUNCATE, to anonymous.
--
-- WHAT THIS DOES NOT DO — deliberately:
--   · NO policy USING / WITH CHECK edits. The person_connections policy has a
--     real forgery hole (a single FOR ALL rule lets either side both create AND
--     confirm a relationship), but fixing it edits predicates, which is a
--     counsel-gated change and belongs in its own PR. Grants and predicates are
--     separate concerns and mixing them widens this PR's blast radius for
--     nothing.
--   · NO DELETE or TRUNCATE granted back. `communities.archived` is a
--     soft-retire flag — the product deletes by archiving, so the privilege is
--     not needed by any shipped path.
--   · NO REFERENCES or TRIGGER. Neither is used by application code, and both
--     let a caller attach objects to a table it does not own.
--
-- BEHAVIOUR: none. Every one of these tables is either empty or already
-- RLS-guarded, so nothing that works today stops working. This narrows what is
-- POSSIBLE, not what happens.
--
-- The exposure baseline fingerprints table privileges (`tpriv` lines), so this
-- removes lines from it. Regenerated in the same commit — a baseline that
-- disagrees with the schema is the failure this whole system exists to prevent.
-- ============================================================================

-- ── Samahan trio (from 20270808218211, which shipped without these) ──────────

REVOKE ALL ON TABLE public.communities             FROM anon;
REVOKE ALL ON TABLE public.community_members       FROM anon;
REVOKE ALL ON TABLE public.community_invite_tokens FROM anon;

REVOKE ALL ON TABLE public.communities             FROM authenticated;
REVOKE ALL ON TABLE public.community_members       FROM authenticated;
REVOKE ALL ON TABLE public.community_invite_tokens FROM authenticated;

-- Scoped back: the three verbs the shipped paths actually use. Creating a
-- samahan, joining via an invite token, and renaming/archiving one.
GRANT SELECT, INSERT, UPDATE ON TABLE public.communities             TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.community_members       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.community_invite_tokens TO authenticated;

-- ── Person spine (counsel-gated, 0 rows, flag NEXT_PUBLIC_PEOPLE_CONNECTIONS
--    is OFF — so this is provably inert today, which is the best time to fix a
--    grant) ────────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.people              FROM anon;
REVOKE ALL ON TABLE public.person_connections  FROM anon;
REVOKE ALL ON TABLE public.person_stewardships FROM anon;

REVOKE ALL ON TABLE public.people              FROM authenticated;
REVOKE ALL ON TABLE public.person_connections  FROM authenticated;
REVOKE ALL ON TABLE public.person_stewardships FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.people              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.person_connections  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.person_stewardships TO authenticated;

-- NOTE `person_transfer_audit` is deliberately absent: it appears in NO
-- migration and in no production snapshot. An earlier plan listed it as
-- probable; it does not exist. Do not add a REVOKE for a table that isn't there
-- — it would fail the migration and teach nobody anything.
