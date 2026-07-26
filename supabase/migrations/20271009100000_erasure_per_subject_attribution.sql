-- ============================================================================
-- RA 10173 right-to-erasure — PER-SUBJECT ATTRIBUTION for two event-keyed tables
--
-- WHY (owner ruling 2026-07-26: "a leaver deletes only their OWN paperwork; the
-- remaining partner keeps theirs").
--
-- `event_paperwork` and `oauth_grants` are both keyed by `event_id` and carry NO
-- per-user column. Account erasure therefore purged them EVENT-WIDE: when one
-- partner deleted their account, the OTHER partner's PSA birth certificate,
-- CENOMAR and baptismal/confirmation scans were irreversibly destroyed, along
-- with a Google credential that may belong to the co-partner's account. That is
-- a third party's sensitive personal information (RA 10173 §3(l)) destroyed by
-- someone with no standing to request its erasure — a worse failure than
-- retaining data too long, because it is not recoverable.
--
-- These two nullable columns give erasure something PROVABLE to scope on. The
-- purge (`apps/web/lib/erasure/purge.ts`) then FAILS CLOSED: it deletes only
-- rows whose subject is known to be the leaver, and leaves every NULL-attributed
-- row alone rather than guessing.
--
-- ── WHY `ON DELETE SET NULL` AND NOT CASCADE / NO ACTION ────────────────────
--   · CASCADE would re-create the exact defect in a new place. A paperwork row
--     is the COUPLE'S shared checklist entry, not the attributed subject's
--     property; deleting the user must not delete the co-partner's checklist.
--     Same for a grant: it is the event's photo-delivery connection.
--   · NO ACTION / RESTRICT would add to the 41 existing NO ACTION FKs that
--     already make a hard `DELETE FROM auth.users` throw — the very reason
--     `eraseUserAccount` had to stop issuing one. Adding a 42nd would deepen a
--     known, documented breakage.
--   · SET NULL degrades to exactly the state erasure already treats as "subject
--     unknown → do not touch". The failure mode of the FK and the failure mode
--     of the purge agree, which is what makes fail-closed coherent.
--
-- ── WHAT THIS MIGRATION DELIBERATELY DOES NOT DO ────────────────────────────
-- It does NOT build a user↔partner-slot mapping, and it does not backfill.
-- Nothing in the schema maps an account to "partner 1" or "partner 2":
-- `event_members.role` is only 'host' or NULL, `events` has bride_name /
-- groom_name / partner_a_birth_date / partner_b_birth_date but no
-- partner_a_user_id, and the second partner frequently has no account at all.
-- So no honest backfill value exists. Both columns ship NULL everywhere, which
-- means erasure removes NOTHING from these two tables until an attribution is
-- written — deliberate, and recorded in the purge's own docstring. Live rows at
-- the time of writing: event_paperwork = 0, oauth_grants = 2 (both the owner's).
--
-- Side benefit, load-bearing for the guardrail: both tables previously sat in
-- `PURGED_WITHOUT_SUBJECT_COLUMN` (apps/web/lib/erasure/coverage-guardrail.test.ts)
-- — the pinned list of tables the subject-column detector is STRUCTURALLY blind
-- to. Adding a `*_user_id` column moves both into the enforced tier, shrinking
-- that blind spot from 9 tables to 8 (a 10th, vendor_verification_applications,
-- is added to it by the same PR).
-- ============================================================================

-- ── event_paperwork · whose document is this? ───────────────────────────────
ALTER TABLE public.event_paperwork
  ADD COLUMN IF NOT EXISTS subject_user_id UUID
    REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_paperwork.subject_user_id IS
  'RA 10173 erasure attribution: the account whose civil-registry document this row holds, when known. NULL = subject unknown; erasure MUST NOT delete the row (fail closed — destroying the co-partner''s PSA/CENOMAR scan is the worse failure). Nothing populates this yet: no user↔partner-slot mapping exists (document_type encodes partner_1/partner_2, but no column maps an account to a slot, and the second partner often has no account). Only the 8 per-partner document_type values can ever carry a subject; the 7 joint ones (marriage_license, pre_cana_certificate, banns_posted, canonical_interview_complete, inc_counseling_complete, sharia_counseling_complete, cfo_counseling_complete) have none by definition and must stay NULL.';

-- Erasure's only read pattern on this column: "rows attributed to one leaver".
CREATE INDEX IF NOT EXISTS event_paperwork_subject_user_id_idx
  ON public.event_paperwork(subject_user_id)
  WHERE subject_user_id IS NOT NULL;

-- ── oauth_grants · who consented to this credential? ────────────────────────
-- The honest key is the account that COMPLETED the OAuth handshake, which the
-- three callback routes already have in hand as `oauth_state.initiated_by`.
-- The pre-existing columns are not usable as a per-user key:
-- `external_account_id` is the provider's own subject id (a Google `sub`, a
-- YouTube channel id) and `external_account_display` is whatever the provider
-- returned — an email for Drive, but a CHANNEL NAME ('Setnayan') for YouTube.
-- Matching a Setnayan account to a Google address by string equality would both
-- over-delete (a couple sharing one Gmail) and under-delete (any account whose
-- Google address differs from their login), so it is not defensible.
ALTER TABLE public.oauth_grants
  ADD COLUMN IF NOT EXISTS granted_by_user_id UUID
    REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.oauth_grants.granted_by_user_id IS
  'RA 10173 erasure attribution: the account that completed the OAuth consent (copied from oauth_state.initiated_by at callback time). NULL = pre-2026-07-26 grant, or a flow that did not record it; erasure MUST NOT delete the row (fail closed — the credential may be the co-partner''s Google account, and revoking it silently breaks the event''s photo delivery). A NULL-attributed grant left behind is audit-logged as erasure_unattributed_retained so an operator sweep can still act on it.';

CREATE INDEX IF NOT EXISTS oauth_grants_granted_by_user_id_idx
  ON public.oauth_grants(granted_by_user_id)
  WHERE granted_by_user_id IS NOT NULL;
