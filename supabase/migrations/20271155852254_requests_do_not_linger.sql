-- ============================================================================
-- requests_do_not_linger
--
-- ── A PROMISE IN WRITING WITH NOTHING BEHIND IT ────────────────────────────
-- The live public privacy notice has said this since the connection tree
-- shipped (`/privacy`, "Your connection tree (limited pilot)"):
--
--     "Requests do not linger. A request nobody answers, and a connection that
--      is declined, are both deleted after 30 days."
--
-- Nothing deleted them. No `DELETE FROM public.person_connections` exists in any
-- migration, and no sweep exists in the application. Production holds zero
-- connections, so nobody is stranded today — but under RA 10173 we are bound by
-- the period we DECLARE, and that sentence is a declared retention period.
--
-- Same family as the retention-copy trap the repo already guards
-- (`retention-copy-is-true.test.ts`, which fails when copy promises a deletion
-- no job performs). This is that trap, in the one place the guard did not look.
--
-- ── WHY A FUNCTION AND NOT APP CODE ────────────────────────────────────────
-- The deletion is a data-retention rule, so it is written where the data is: one
-- SECURITY DEFINER function, callable only by `service_role`, exercised directly
-- by a db test against real rows. The app's daily job calls it; if that call is
-- ever removed the promise breaks again, and `requests-do-not-linger.test.ts`
-- fails when it is not wired.
--
-- ── WHAT IT DELETES, AND WHAT IT MUST NOT TOUCH ────────────────────────────
--   · `pending`  older than N days by `created_at`  — nobody answered.
--   · `declined` older than N days by `declined_at` — answered, and it is over.
--   · `draft`    older than N days by `created_at`  — never sent to anybody, and
--                the notice calls a draft private to its author; a private note
--                nobody has touched in a month is not a record worth keeping.
-- ⛔ NEVER `confirmed`. A confirmed connection is a relationship both people
-- agreed to; it has no expiry and deleting one would be data loss, not hygiene.
-- ⛔ Never a row a person already soft-deleted — `deleted_at` rows are already
-- gone from every read, and re-deleting them would only inflate the count.
--
-- It is a HARD delete. The notice says "deleted", and a soft-deleted row still
-- holds a relationship claim about two named people.
--
-- IDEMPOTENT: CREATE OR REPLACE + REVOKE/GRANT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_stale_connection_requests(p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - make_interval(days => GREATEST(p_days, 1));
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.person_connections pc
   WHERE pc.deleted_at IS NULL
     AND (
       (pc.status IN ('pending', 'draft') AND pc.created_at < v_cutoff)
       OR (pc.status = 'declined' AND COALESCE(pc.declined_at, pc.updated_at, pc.created_at) < v_cutoff)
     );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_connection_requests(INTEGER) IS
  'Keeps the promise the public privacy notice makes: an unanswered request, an unsent draft, and a declined connection are DELETED after 30 days. Hard delete — the notice says deleted, and a soft-deleted row still holds a relationship claim about two named people. NEVER touches a confirmed connection: that is a relationship both people agreed to and it has no expiry. Called once a day by the app''s traffic-driven job runner (lib/daily-email-jobs.ts); service_role only.';

-- Nobody's browser runs a retention sweep.
REVOKE ALL ON FUNCTION public.expire_stale_connection_requests(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_connection_requests(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.expire_stale_connection_requests(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_connection_requests(INTEGER) TO service_role;

-- ── AND ONE RULING, RECORDED WHERE A READER WILL FIND IT ───────────────────
-- `kin_pilot_mutual_accounts` (20271026100000) refuses any connection unless
-- BOTH people hold accounts. That migration called itself a pilot boundary and
-- said, in its own words, "for a pilot that is the right trade; for the full
-- product it is probably not" — inviting a future session to drop the trigger
-- once the pilot ended.
--
-- ⚖ THE OWNER HAS NOW RULED THE OPPOSITE, 2026-08-21, asked directly whether a
-- person must hold an account to appear on somebody's People list: *"these
-- people must have an account to be listed as people."* It is the product rule,
-- not a temporary boundary. **Do not drop this trigger.**
--
-- Applied migrations are never edited, so the correction goes where a reader
-- actually looks — the object's own comment.
COMMENT ON FUNCTION public.kin_pilot_require_mutual_accounts() IS
  'Refuses any person_connections row unless BOTH endpoints are claimed accounts. Originally written as a temporary pilot boundary whose migration text anticipated dropping it later — SUPERSEDED by the owner ruling of 2026-08-21: "these people must have an account to be listed as people." This is the product rule. Do NOT drop this trigger; somebody without an account is added as an alaga (a profile you hold, with its own consent stamps) or invited to join, never recorded as a connection.';
