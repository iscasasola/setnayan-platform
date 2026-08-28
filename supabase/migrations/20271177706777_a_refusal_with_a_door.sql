-- ============================================================================
-- 20271177706777_a_refusal_with_a_door.sql
--
-- A COUPLE CAN ASK US TO REMOVE A CELEBRATION THEY HAVE PAID FOR — and every
-- removal now says why.
--
-- ─── WHAT WAS THERE BEFORE ──────────────────────────────────────────────────
-- One sentence and a Cancel button. "Something on this celebration has already
-- been paid for, so it can't be removed here. Put it away instead, or message
-- us and we'll help." Three different situations wear that sentence — money we
-- confirmed, a payment nobody has looked at yet, and a check that failed — and
-- there is nothing to press for any of them. "Message us" is written down and
-- is not a control.
--
-- Owner 2026-08-28, looking at it: *"still failed to identify"*, and
-- *"Request for deletion … they can pick a reason for deleting. or they state
-- their reason."*
--
-- 🔑 THIS IS NOT A NEW MECHANISM. `account_deletion_requests` (20261106000000)
-- already does exactly this shape for closing an ACCOUNT: the person files it
-- themselves with a reason, at most one open at a time, they can take it back,
-- an admin answers. Everything below is that table's pattern pointed at one
-- celebration. Deliberately copied rather than generalised — the two differ in
-- what they are ABOUT (a user vs an event) and merging them would put a
-- celebration's name on a row about a person.
--
-- ─── THE COLUMNS, EXPLAINED HERE AND NOT INSIDE THE TABLE ──────────────────
-- 🪤 THE PROSE IS OUT OF THE COLUMN LIST ON PURPOSE, AND THE FIRST CUT LEARNED
--    IT THE HARD WAY. `lib/security/migration-schema.ts` splits a CREATE TABLE
--    body on top-level commas and takes the first word of each segment as a
--    column name — it does not strip `/* … */`. Two explanatory blocks in the
--    body meant the scanner never saw `reason_code` or `status` at all (it read
--    "rather", "comparable", "and", "already" instead), and
--    `query-column-scan` then reported ten phantom column references in code
--    that was correct. **A comment inside a column list is parsed as schema.**
--
--   reason_code · WHY A CODE **AND** FREE TEXT. Owner: *"they can pick a reason
--     for deleting. or they state their reason."* The code is what can be
--     counted — six answers comparable across everybody who ever leaves. The
--     text is what is useful on the ones that need an answer ("can the shots go
--     to my sister's wedding instead?"). `other` is the code that makes the text
--     load-bearing; the APP requires text for it, not a CHECK, because a
--     half-typed sentence must not come back as a database error on a screen
--     somebody is trying to leave.
--
--   status · `self_removed` IS NOT A REQUEST AND IS DELIBERATELY IN THE SAME
--     TABLE. Most removals are not blocked by anything: the couple types the
--     name and the celebration goes. That still asks why, and the answer has to
--     live somewhere. A second table would mean two places to read "why did
--     people leave" from, and the pair would drift — this repo's most-paid-for
--     defect shape. One table; the status says whether anybody has to answer it.
--     Nothing ever moves INTO `self_removed`: it is written once, already final.
--
--   event_id · no foreign key. event_name · snapshotted. See decision 1 below.
--   reviewed_by · ON DELETE SET NULL, so removing an admin account does not
--     wipe the record of what was asked and answered.
--
-- ─── THE TWO DECISIONS WORTH READING ────────────────────────────────────────
--
-- 1 · `event_id` HAS NO FOREIGN KEY, AND THAT IS THE POINT.
--     A `self_removed` row is written moments BEFORE the celebration is
--     deleted. An `ON DELETE CASCADE` would take the reason with it and an
--     `ON DELETE SET NULL` would leave a reason attached to nothing — so the
--     one moment anybody will ever tell us why they left would be the one
--     moment we cannot keep. `event_name` is snapshotted for the same reason:
--     after the delete there is nothing left to resolve it from.
--     ⚠ CONSEQUENCE, STATED: this table can hold an `event_id` that no longer
--     exists. Every reader must treat it as a label, never as a join key that
--     will resolve.
--
-- 2 · THE GRANTS ARE NARROWED, BECAUSE A NEW TABLE IN THIS SCHEMA IS BORN
--     WIDE OPEN. Measured in production before writing this: a freshly created
--     public table carries DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
--     TRUNCATE and UPDATE for BOTH `anon` and `authenticated`. RLS is the only
--     thing standing there, and this repo has paid for that assumption more
--     than once. `anon` is revoked outright; `authenticated` keeps exactly the
--     three verbs the policies below name — SELECT, INSERT, UPDATE — and no
--     DELETE, because nothing in the product deletes one of these rows.
--     🔑 THE VERBS ARE ENUMERATED FROM THE POLICIES, not from remembered
--     paths. `community_members` shipped a DELETE policy with no DELETE grant
--     and nobody could ever leave a samahan; Postgres checks the grant first,
--     so the policy was never once reached and the button simply did nothing.
--
-- ⚠ `CREATE POLICY` WITH NO `TO` CLAUSE DEFAULTS TO PUBLIC, WHICH INCLUDES
--   `anon`. Every policy below names `TO authenticated` explicitly.
-- ============================================================================

/*
  ── THE NOTICE THE COUPLE GETS BACK ──────────────────────────────────────────
  🚨 A TYPE THE DATABASE NEVER HAD IS REFUSED, NOT THROWN. This schema has
  already carried three notification types that existed only in TypeScript —
  `connection_request`, `connection_confirmed`, `order_cancelled` — with four
  live emit sites between them. Every one typechecked, every INSERT failed at
  runtime, `emitNotification` only console.errors, and the person was simply
  never told. So the enum value is added HERE, in the same change as the code
  that emits it.

  ⚠ OUTSIDE THE TRANSACTION BLOCK, DELIBERATELY. `ALTER TYPE … ADD VALUE` is
  safe inside one on PG 12+ only while the new value is not USED in the same
  transaction; keeping it out removes the question entirely and matches
  20271152428061, which added the four supplier-handshake types the same way.

  ONE type, not two: the title says whether it was removed or not, and a second
  value would be a second thing to register in four more places.
*/
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_deletion_answered';

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL,
  event_name      TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code     TEXT NOT NULL
                    CHECK (reason_code IN (
                      'not_happening',
                      'made_by_mistake',
                      'made_a_new_one',
                      'using_something_else',
                      'too_expensive',
                      'other'
                    )),
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending',
                      'approved',
                      'rejected',
                      'cancelled',
                      'self_removed'
                    )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  admin_note      TEXT
);

CREATE INDEX IF NOT EXISTS event_deletion_requests_event_id_idx
  ON public.event_deletion_requests(event_id);
CREATE INDEX IF NOT EXISTS event_deletion_requests_status_idx
  ON public.event_deletion_requests(status);
CREATE INDEX IF NOT EXISTS event_deletion_requests_user_id_idx
  ON public.event_deletion_requests(user_id);

-- At most one OPEN request per celebration. A couple may ask again after a
-- prior one was answered or withdrawn; they cannot stack them, and a second
-- press of the same button is therefore a no-op rather than a duplicate in the
-- queue.
CREATE UNIQUE INDEX IF NOT EXISTS event_deletion_requests_one_pending_per_event_idx
  ON public.event_deletion_requests(event_id)
  WHERE status = 'pending';

ALTER TABLE public.event_deletion_requests ENABLE ROW LEVEL SECURITY;

-- ── GRANTS · narrowed from the wide-open default ────────────────────────────
--
-- 🪤 THE `authenticated` REVOKE IS LOAD-BEARING AND THE FIRST CUT OF THIS FILE
--    DID NOT HAVE IT. Revoking from PUBLIC and `anon` leaves the default grant
--    to `authenticated` completely untouched, and a following
--    `GRANT SELECT, INSERT, UPDATE` ADDS nothing it did not already hold — so
--    the table shipped with DELETE, TRUNCATE, REFERENCES and TRIGGER still in
--    a signed-in browser's hands while the file above claimed three verbs.
--    Measured by dry-running this migration against production inside a
--    rolled-back transaction: `anon` was correctly at 0, and `authenticated`
--    came back holding all seven. **A GRANT is not a narrowing; only a REVOKE
--    is.**
--
-- 🚨 AND THE GRANTS ARE PER-COLUMN, BECAUSE **THE ROW IS YOURS, THE FIELD IS
--    NOT** — this schema's eighth-recorded defect shape, and the first cut of
--    this table walked straight into it. A table-level
--    `GRANT UPDATE` plus the cancel policy below is NOT "they may cancel": the
--    policy's WITH CHECK constrains `user_id` and `status` and says nothing
--    about the other nine columns, so ONE update that satisfies it could also
--    rewrite `admin_note` (our answer to them), `reviewed_by`, `reason_code`
--    and `event_name`. RLS is ROW-level and can never hide or protect a column.
--    UPDATE is therefore granted on `status` ALONE.
--
-- 🔒 `reviewed_by` IS NOT SELECTABLE BY THE COUPLE. It is the user id of the
--    member of staff who answered — somebody else's identity, of no use to the
--    person asking, and the answer itself reaches them in `admin_note` and as a
--    notification. The admin console reads this table with the service role.
--
-- ⚠ INSERT NAMES ONLY WHAT A PERSON LEGITIMATELY WRITES. `status` is absent, so
--    a filed request can only take the column DEFAULT `'pending'` — a couple
--    cannot post one already `approved`. The `self_removed` rows are written by
--    the service role on the way out of a removal and need no grant here.
REVOKE ALL ON public.event_deletion_requests FROM PUBLIC;
REVOKE ALL ON public.event_deletion_requests FROM anon;
REVOKE ALL ON public.event_deletion_requests FROM authenticated;
GRANT SELECT (
  id, event_id, event_name, user_id, reason_code, reason, status,
  created_at, reviewed_at, admin_note
) ON public.event_deletion_requests TO authenticated;
GRANT INSERT (
  event_id, event_name, user_id, reason_code, reason
) ON public.event_deletion_requests TO authenticated;
GRANT UPDATE (status) ON public.event_deletion_requests TO authenticated;
GRANT ALL ON public.event_deletion_requests TO service_role;

-- ── RLS · Pattern A (self-row) + admin override ─────────────────────────────

-- Read your own.
DROP POLICY IF EXISTS edr_user_select_own ON public.event_deletion_requests;
CREATE POLICY edr_user_select_own ON public.event_deletion_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

/*
  File one for yourself, for a celebration you actually organise.

  🔒 `user_id = auth.uid()` ALONE WOULD NOT BE ENOUGH. Without the membership
  half, any signed-in stranger could post a row naming somebody else's wedding
  and its name into an admin queue — an insert policy that only checks WHOSE
  row it is has no opinion about WHAT is in it, which is this schema's
  eighth-recorded instance of that shape.

  `current_couple_event_ids()` is `member_type = 'couple'` only — the same
  floor the couple-facing delete action checks in the app, so the database and
  the app say the same thing rather than one silently over-promising.
*/
DROP POLICY IF EXISTS edr_user_insert_own ON public.event_deletion_requests;
CREATE POLICY edr_user_insert_own ON public.event_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND event_id IN (SELECT public.current_couple_event_ids())
  );

/*
  Withdraw your own, while it is still pending.

  The USING clause decides which rows an UPDATE can see (yours, still open);
  the WITH CHECK clause constrains the result, so `cancelled` is the only place
  it can go. Approving your own request is refused by the CHECK, not by the
  app — `reviewed_by` and `admin_note` are unreachable from a user session for
  the same reason.
*/
DROP POLICY IF EXISTS edr_user_cancel_own ON public.event_deletion_requests;
CREATE POLICY edr_user_cancel_own ON public.event_deletion_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS edr_admin_select_all ON public.event_deletion_requests;
CREATE POLICY edr_admin_select_all ON public.event_deletion_requests
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS edr_admin_update_all ON public.event_deletion_requests;
CREATE POLICY edr_admin_update_all ON public.event_deletion_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.event_deletion_requests IS
  'Why a celebration was removed, and — when money is in the way — the couple''s request that a person remove it for them. Filed by a couple member from the ⋯ menu on their Events board; answered from /admin/event-deletions. status=self_removed is a reason recorded on an ordinary removal that needed nobody''s answer. event_id carries NO foreign key on purpose: the row outlives the celebration it is about, so treat it as a label and never as a join key that will resolve.';

COMMENT ON COLUMN public.event_deletion_requests.event_id IS
  'The celebration this is about. NOT a foreign key — a self_removed row is written moments before the celebration is deleted, and a cascade would take the reason with it. May name a celebration that no longer exists.';

COMMENT ON COLUMN public.event_deletion_requests.event_name IS
  'Snapshotted at filing time. Nothing can resolve the name after the celebration is gone.';

COMMIT;
