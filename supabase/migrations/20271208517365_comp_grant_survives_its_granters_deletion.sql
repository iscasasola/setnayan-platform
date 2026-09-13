-- comp_grant_survives_its_granters_deletion
--
-- ══ THE DEFECT ══════════════════════════════════════════════════════════════
--
-- `comp_grants.granted_by` references `public.users` with ON DELETE CASCADE, so
-- deleting the ADMIN who issued a comp destroys the grant row itself: the
-- retail value, the rationale, the approver, the whole money record of what
-- this company gave away. The person who left takes the receipts with them.
--
-- 🔑 THE ADJACENT COLUMN SETTLES IT. `granted_by` and `approved_by` are created
-- in ONE statement, on consecutive lines, in migration 20260515030000:
--
--     ADD COLUMN IF NOT EXISTS granted_by   UUID
--       REFERENCES public.users(user_id) ON DELETE CASCADE,
--     ADD COLUMN IF NOT EXISTS approved_by  UUID
--       REFERENCES public.users(user_id) ON DELETE SET NULL,
--
-- Same table, same parent, same statement — opposite actions. Nobody decides
-- that the issuer's departure erases the record while the approver's merely
-- blanks a field. It is a typo with a five-figure blast radius.
--
-- ══ THE HOUSE RULE ALREADY EXISTS, AND IT IS TESTED ═════════════════════════
--
-- `apps/web/tests/db/erasure-completeness.db.test.ts` names this exact trap —
-- "the over-deletion trap" — and states the rule, verbatim:
--
--     delegate_user_id is CASCADE + NOT NULL (the row is ABOUT them),
--     granted_by/revoked_by are SET NULL (an actor stamp).
--
-- It then ASSERTS the granter's uuid is cleared rather than the row deleted
-- ("OVER-DELETION: a third party lost their event access because the person who
-- granted it erased their account"). Every other actor stamp in the schema
-- already obeys it: `founder_seats.granted_by`, `oauth_grants.granted_by_user_id`,
-- `event_delegates.granted_by_user_id`, `vendor_event_access_grants.granted_by`,
-- and ~30 `created_by*` columns are all SET NULL. Read the roll-call yourself:
--
--     grep -E '\.(granted_by|approved_by|revoked_by|created_by)' \
--       apps/web/tests/db/user-fk-behaviour.generated.txt
--
-- `comp_grants.granted_by` is the ONLY actor stamp still on CASCADE. It was not
-- excluded from the two sweeps that fixed the rest — those converted NO ACTION
-- to SET NULL and never looked at CASCADE columns, so this one was never in
-- their window.
--
-- ══ WHY NO SNAPSHOT COLUMN — WE DELIBERATELY DIVERGE FROM 20271208142357 ════
--
-- The sibling fix for `comp_grants.event_id` (migration 20271208142357) does
-- NOT just SET NULL: it snapshots the id into a plain UUID column first, because
-- a NULL `event_id` MEANS "every event this user hosts" to
-- `event_has_comp_for_sku`, so nulling it would silently PROMOTE a one-event
-- comp into an account-wide one.
--
-- 🛑 COPYING THAT HERE WOULD BE A PRIVACY DEFECT, NOT A SAFETY FEATURE. Two
-- reasons, and both are load-bearing:
--
--   1. An event is not a data subject; an admin is. A `granted_by_snapshot`
--      would preserve a real person's uuid through the deletion of their own
--      account — which is precisely what the erasure test above forbids. The
--      snapshot pattern is right for a thing and wrong for a person.
--   2. `granted_by` confers NOTHING. Neither entitlement function
--      (`event_has_comp_for_sku` and its sibling in 20271205612762) reads it;
--      they filter on `user_id`, `event_id`, `revoked_at`, `expiry` and scope.
--      So nulling it cannot promote, extend or widen any comp. The only
--      predicate that reads it is the RLS policy `comp_grants_owner_read`
--      (`USING (user_id = auth.uid() OR granted_by = auth.uid())`), whose
--      `granted_by` branch exists to let the issuing admin read their own
--      grant — unreachable by definition once that account is gone.
--
-- Attribution is the thing being given up, and giving it up is the point.
--
-- ══ WHY THE `DROP NOT NULL` IS NOT OPTIONAL ═════════════════════════════════
--
-- 🛑 `ON DELETE SET NULL` ON A `NOT NULL` COLUMN DOES NOT NULL ANYTHING — IT
-- MAKES THE PARENT DELETE FAIL. Postgres issues `UPDATE ... SET granted_by =
-- NULL`, the constraint rejects it, and the whole `DELETE FROM users` aborts
-- with 23502. Without the line below, this migration would convert "the admin's
-- deletion erases the record" into "the admin cannot be deleted at all" — a
-- different bug, and one that breaks account deletion outright.
--
-- ⚠ AND THE REPLAY CANNOT SEE THIS. Measured 2026-09-06: production has
-- `comp_grants.granted_by`, `.user_id` and `.rationale` marked NOT NULL, while
-- NO migration in this repo ever sets them so — the PGlite replay produces all
-- three nullable (`grep '^comp_grants\.' apps/web/tests/db/user-fk-behaviour.generated.txt`
-- prints `nullable`). Production and the migration set genuinely disagree, so a
-- SET NULL written without this line would pass every local db test and fail in
-- production only, the first time an admin account was ever deleted.
--
-- `DROP NOT NULL` is a no-op where the column is already nullable (the replay,
-- and any fresh environment), and is the whole fix where it is not (production).
-- It also brings prod back into line with the schema-as-code rather than
-- weakening a constraint anyone designed: no migration asserted it.
--
-- ══ WHAT IS DELIBERATELY LEFT ALONE ═════════════════════════════════════════
--
-- `comp_grants.user_id -> users ON DELETE CASCADE` stays CASCADE. That row is
-- ABOUT the customer: it is their personal data under RA 10173, and
-- `apps/web/lib/erasure/coverage-guardrail.test.ts` classifies the table as
-- "the money-side record of a waived charge" held against that subject. Same
-- half of the rule as `event_delegates.delegate_user_id`.
--
-- `comp_grants.event_id` is 20271208142357's business, not this migration's.
--
-- IDEMPOTENT: DROP NOT NULL is unconditional-safe, the constraint is
-- DROP ... IF EXISTS then re-added.

BEGIN;

-- 1 · Make the column able to hold the NULL the new FK action will write.
--     Ordered FIRST: if the constraint went on while the column were still
--     NOT NULL, the window between the two statements would be a schema in
--     which deleting an admin fails outright.
ALTER TABLE public.comp_grants
  ALTER COLUMN granted_by DROP NOT NULL;

-- 2 · The actual fix: an actor stamp is cleared, never used to delete the row.
ALTER TABLE public.comp_grants
  DROP CONSTRAINT IF EXISTS comp_grants_granted_by_fkey;
ALTER TABLE public.comp_grants
  ADD CONSTRAINT comp_grants_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.comp_grants.granted_by IS
  'The admin who issued this comp. An ACTOR STAMP, not a subject: SET NULL on '
  'their deletion so the money record survives them, per the over-deletion rule '
  'asserted in erasure-completeness.db.test.ts. NULL means "the issuing account '
  'is gone", never "nobody issued it" — the app always writes it. Deliberately '
  'NOT snapshotted: preserving a departed person''s uuid would defeat erasure.';

COMMIT;
