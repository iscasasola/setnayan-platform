-- an_actor_leaving_keeps_the_record
--
-- FIVE actor stamps converted from CASCADE to SET NULL, applying the rule this
-- repo already wrote down and tested. From `erasure-completeness.db.test.ts`:
--
--     delegate_user_id is CASCADE + NOT NULL (the row is ABOUT them),
--     granted_by/revoked_by are SET NULL (an actor stamp).
--
-- It calls the failure "the over-deletion trap": deleting a row because the
-- person who ACTED on it left, destroying something a THIRD PARTY still needs.
--
-- All five were pinned as unreviewed in
-- `apps/web/tests/db/comp-grant-survives-its-granter.db.test.ts` when that
-- ratchet shipped, under a docblock that says: "To retire a line: make the
-- actor-vs-subject argument, then either convert it or record why CASCADE is
-- right." This is that argument, made per column — a name is never the
-- argument, which is why a sixth pinned column is deliberately NOT converted
-- (see the end). The last two carried an owner decision as well as an
-- engineering one, and it was taken on 2026-09-06 — see §4/§5.
--
-- ══ 1 · vendor_admin_motions.proposed_by ═══════════════════════════════════
--
-- A motion is peer governance INSIDE a vendor store: a proposal to demote or
-- remove another admin, voted on by that store's other admins through
-- `vendor_admin_motion_votes`, whose `motion_id` is itself ON DELETE CASCADE.
--
-- 🔑 SO DELETING THE PROPOSER SILENTLY DESTROYS OTHER PEOPLE'S VOTES. Not the
-- proposer's record — the votes cast by everyone else, on a motion about a
-- third admin. Three parties lose something and none of them is the actor.
--
-- ══ 2 · coordinator_access_consents.consented_by_user_id ═══════════════════
--
-- An RA 10173 consent receipt: the record that a host authorised sharing an
-- event's planning data with a coordinator. The row is the COORDINATOR's
-- permission slip — `coordinatorMoneyScopeGranted` requires an un-revoked
-- consent — so deleting it revokes a third party's access as a side effect of
-- someone else's account closing.
--
-- ⚠ AND THE CONSENT IS EVIDENCE. A receipt that vanishes cannot show that
-- permission was ever given. Clearing the consenter's uuid keeps the receipt
-- and de-identifies it, which is what the erasure contract asks for; deleting
-- it destroys the evidence entirely. No policy, function, index or CHECK reads
-- the column, and the sole writer always supplies it.
--
-- ══ 3 · admin_approval_requests.initiated_by ═══════════════════════════════
--
-- The two-admin ("four-eyes") queue: admin A proposes a privileged action
-- against a third party, a DIFFERENT admin B approves. After the decision the
-- row is the standing evidence that the gate was satisfied —
-- `erasure/coverage-guardrail.test.ts` files the table under "accountability:
-- audit trails".
--
-- 🔑 THE DECIDING ARGUMENT IS ONE COLUMN AWAY. `decided_by`, the same kind of
-- stamp on the same row, is ALREADY `ON DELETE SET NULL` (migration
-- 20260930000000). A and B are the two halves of one handshake; there is no
-- reading in which B leaving clears a stamp and A leaving shreds the record.
-- The subject slot on this table is taken, and not by this column:
-- `export-coverage-guardrail.test.ts` asserts "target_user_id is the account
-- the motion is ABOUT — the subject, not the operator". And `initiated_by` can
-- never BE the subject: `requestPrivilegedGrant` refuses "a privileged grant
-- for your own account".
--
-- ⚠ MEASURED, NOT ASSUMED: this table carries
-- `CHECK (decided_by IS NULL OR decided_by <> initiated_by)`, and this repo has
-- a recorded case of SET NULL onto a CHECKed column behaving like RESTRICT —
-- the FK refuses, the parent DELETE fails, and an "erasure" quietly becomes
-- impossible. Probed against the PGlite replay before writing this migration:
-- nulling the checked column on an already-decided row SUCCEEDS, because
-- `false OR (uuid <> NULL)` is NULL and Postgres treats a NULL CHECK as
-- satisfied. The hazard is real in general; it does not bite here.
--
-- ⚠ ONE BEHAVIOUR CHANGES, DELIBERATELY, AND IT FAILS CLOSED. `approveRequest`
-- and `rejectRequest` claim a row with `.neq('initiated_by', me)`, and SQL
-- `NULL <> uuid` is NULL, so a request whose initiator was deleted can no
-- longer be decided by anyone. That is the SAFE direction — four eyes means two
-- people, and letting a single admin decide an orphaned privileged request
-- would weaken the gate this table exists to enforce. The row simply stays
-- pending until `expires_at` passes, and the audit record survives, which is
-- the entire point. The app's error copy is corrected in this same commit so it
-- stops blaming the reader for a state they did not cause.
--
-- ══ NOT CONVERTED: live_studio_encoder_claims.requested_by ═════════════════
--
-- Reviewed under the same rule and CASCADE is CORRECT, so it stays. That row is
-- a single-use 60-second CSPRNG nonce for handing a stream key to the desktop
-- encoder: no other table references it, nothing outlives it, and the row is
-- genuinely ABOUT the host who asked. Deleting them should delete it. It stays
-- pinned in the ratchet with the verdict recorded, because the list's contract
-- is "convert it OR record why CASCADE is right" — an entry retired by argument
-- rather than by change.
--
-- ══ THE TWO-STEP, AND WHY BOTH HALVES ══════════════════════════════════════
--
-- Every column here is CASCADE + NOT NULL. `ON DELETE SET NULL` on a NOT NULL
-- column does not null anything: Postgres issues the UPDATE, the constraint
-- rejects it, and the whole parent DELETE aborts with 23502. Converting without
-- the DROP NOT NULL would turn "the record is destroyed" into "the account
-- cannot be deleted" — a different bug, and one that breaks account deletion.
-- Precedent: 20271208517365 (comp_grants.granted_by), where this was found the
-- hard way.
--
-- IDEMPOTENT: DROP NOT NULL is a no-op where already nullable; every constraint
-- is DROP ... IF EXISTS then re-added.

BEGIN;

-- ── 1 · vendor_admin_motions.proposed_by ────────────────────────────────────
ALTER TABLE public.vendor_admin_motions
  ALTER COLUMN proposed_by DROP NOT NULL;
ALTER TABLE public.vendor_admin_motions
  DROP CONSTRAINT IF EXISTS vendor_admin_motions_proposed_by_fkey;
ALTER TABLE public.vendor_admin_motions
  ADD CONSTRAINT vendor_admin_motions_proposed_by_fkey
  FOREIGN KEY (proposed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_admin_motions.proposed_by IS
  'The admin who RAISED this motion. An actor stamp, not the subject — the '
  'subject is target_user_id. SET NULL on their deletion because the motion is '
  'voted on by other admins through vendor_admin_motion_votes, whose motion_id '
  'CASCADEs: destroying the motion destroys THEIR votes. NULL means "the '
  'proposer''s account is gone", never "nobody proposed it".';

-- ── 2 · coordinator_access_consents.consented_by_user_id ────────────────────
ALTER TABLE public.coordinator_access_consents
  ALTER COLUMN consented_by_user_id DROP NOT NULL;
ALTER TABLE public.coordinator_access_consents
  DROP CONSTRAINT IF EXISTS coordinator_access_consents_consented_by_user_id_fkey;
ALTER TABLE public.coordinator_access_consents
  ADD CONSTRAINT coordinator_access_consents_consented_by_user_id_fkey
  FOREIGN KEY (consented_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.coordinator_access_consents.consented_by_user_id IS
  'The host who GAVE this consent. An actor stamp: the receipt is the '
  'coordinator''s permission slip, and deleting it revokes a third party''s '
  'access as a side effect of someone else closing their account. A consent '
  'receipt is also evidence that permission was given — de-identify it, never '
  'destroy it.';

-- ── 3 · admin_approval_requests.initiated_by ────────────────────────────────
ALTER TABLE public.admin_approval_requests
  ALTER COLUMN initiated_by DROP NOT NULL;
ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_initiated_by_fkey;
ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_initiated_by_fkey
  FOREIGN KEY (initiated_by) REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.admin_approval_requests.initiated_by IS
  'Admin A of the four-eyes handshake. An actor stamp — the SUBJECT is '
  'target_user_id — and its sibling decided_by (admin B) has been SET NULL '
  'since this table shipped. A decided row is the standing evidence that a '
  'privileged action passed a two-admin gate, so it must outlive either admin. '
  'A pending row whose initiator is NULL can no longer be claimed (the .neq '
  'predicate stops matching): it expires instead, which keeps four eyes meaning '
  'two people.';

-- ── 4 · vendor_invites.invited_by_user_id ───────────────────────────────────
-- ── 5 · vendor_lock_proposals.proposed_by_user_id ───────────────────────────
--
-- 🔑 THESE TWO REVERSE A SHIPPED RA 10173 DECISION, AND THE OWNER MADE THAT
-- CALL — 2026-09-06, having been shown exactly what changes. Both sat in
-- `SUBJECT_ROW_DELETES` in lib/erasure/coverage.ts, so erasing a user DELETED
-- their invites and lock proposals. After this they survive with the actor
-- nulled. That is a change to what happens to a person's data when they ask to
-- be erased, which is why it was not folded in quietly with the three above.
--
-- The argument that decided it, in both cases: the erased person is
-- de-identified either way, so the only thing the delete adds is that a THIRD
-- PARTY also loses something.
--
--   · A lock proposal is ADDRESSED TO THE COUPLE — "your coordinator wants to
--     lock vendor X, confirm or dismiss". A pending row is the only thing that
--     renders their confirm strip. Deleting it silently removes a live decision
--     from their dashboard for a reason that has nothing to do with them.
--   · A vendor_invite is a live claim credential held by the INVITEE, and the
--     row carries THEIR email — third-party data that coverage.ts's own rule
--     already excludes from erasure. Deleting it kills a claim link a supplier
--     is holding, and `applyClaimAutoLink` then answers INVITE_NOT_FOUND to
--     someone who did nothing wrong.
--
-- The matching moves out of `SUBJECT_ROW_DELETES` and into `AUTHOR_UUID_NULLS`
-- land in lib/erasure/coverage.ts in this same commit. Both halves are needed:
-- the FK below covers a hard DELETE, the coverage entry covers erasure, which
-- anonymizes in place and never fires a delete at all.

ALTER TABLE public.vendor_invites
  ALTER COLUMN invited_by_user_id DROP NOT NULL;
ALTER TABLE public.vendor_invites
  DROP CONSTRAINT IF EXISTS vendor_invites_invited_by_user_id_fkey;
ALTER TABLE public.vendor_invites
  ADD CONSTRAINT vendor_invites_invited_by_user_id_fkey
  FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_invites.invited_by_user_id IS
  'Who tapped "Invite to Setnayan". An actor stamp: the row is a live claim '
  'credential held by the INVITEE, whose email it carries. SET NULL so the '
  'sender leaving does not kill a claim link somebody else is holding.';

ALTER TABLE public.vendor_lock_proposals
  ALTER COLUMN proposed_by_user_id DROP NOT NULL;
ALTER TABLE public.vendor_lock_proposals
  DROP CONSTRAINT IF EXISTS vendor_lock_proposals_proposed_by_user_id_fkey;
ALTER TABLE public.vendor_lock_proposals
  ADD CONSTRAINT vendor_lock_proposals_proposed_by_user_id_fkey
  FOREIGN KEY (proposed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_lock_proposals.proposed_by_user_id IS
  'The coordinator who raised this lock proposal. An actor stamp: the row is '
  'ADDRESSED TO THE COUPLE and a pending one renders their confirm strip, so '
  'the proposer leaving must not delete a decision that is still theirs to '
  'make.';

COMMIT;
