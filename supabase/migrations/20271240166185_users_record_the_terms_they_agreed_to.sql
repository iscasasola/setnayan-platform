-- users_record_the_terms_they_agreed_to — CTRL-B3 build 2.
--
-- `/signup` carried BROWSEWRAP: a footnote below the submit button saying "By
-- signing up, you agree to our Terms and Privacy." No checkbox, nothing
-- required, and — the part this migration is for — NOTHING RECORDED. There was
-- no answer to "what did this person agree to, and when?", which is the only
-- question that matters if it is ever asked.
--
-- 🔑 TWO COLUMNS, NOT ONE. A timestamp alone says somebody clicked something;
-- it does not say WHAT. The version is the effective date printed on /terms, so
-- the record points at a document a person can actually read back.
--
-- ⚠ NULLABLE, AND DELIBERATELY NOT BACKFILLED. Every account created before
-- today agreed under the browsewrap, and stamping them now would manufacture a
-- clickwrap record for a click that never happened — inventing evidence, which
-- is worse than having none. NULL means "we did not collect this properly",
-- which is the truth about those rows.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version     TEXT;

COMMENT ON COLUMN public.users.terms_accepted_at IS
  'When this person affirmatively ticked "I agree to the Terms and Privacy '
  'Policy" at sign-up (CTRL-B3 build 2). NULL = created before clickwrap, or '
  'through a door that does not collect it — never backfilled, because a '
  'manufactured record is worse than an absent one.';

COMMENT ON COLUMN public.users.terms_version IS
  'The /terms effective date agreed to, ISO (e.g. 2026-06-30). Paired with '
  'terms_accepted_at: a timestamp alone says somebody clicked, not what they '
  'agreed to. Mirrors lib/terms-agreement.ts TERMS_VERSION.';

-- ── The two move together, or not at all ───────────────────────────────────
-- A version with no timestamp is a claim with no date; a timestamp with no
-- version points at nothing. Either both are set or both are NULL.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_terms_agreement_ck;
ALTER TABLE public.users
  ADD CONSTRAINT users_terms_agreement_ck
    CHECK ((terms_accepted_at IS NULL) = (terms_version IS NULL));

-- ── Nobody may write their own agreement ───────────────────────────────────
-- 🔑 RLS IS ROW-LEVEL AND CANNOT HIDE A COLUMN, and `users` is updatable by its
-- owner — so without this REVOKE a person could stamp their own consent record,
-- or clear it, with one PostgREST call. The record is only worth keeping if the
-- subject cannot author it.
REVOKE UPDATE (terms_accepted_at, terms_version) ON public.users FROM anon, authenticated;
