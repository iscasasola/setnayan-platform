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
-- owner — so without a guard a person could stamp their own consent record, or
-- clear it, with one PostgREST call. The record is only worth keeping if the
-- subject cannot author it.
--
-- 🪤 A COLUMN-LEVEL REVOKE WAS THE FIRST ATTEMPT AND IT IS A NO-OP. `users`
-- carries a TABLE-level UPDATE grant, and `REVOKE UPDATE (col) … FROM
-- authenticated` does not subtract from it — the exposure baseline said so
-- plainly, still reporting `authenticated=SU` on both new columns after the
-- revoke. The revoke shipped inert and looked exactly like protection.
--
-- 🔑 SO THIS EXTENDS THE MECHANISM THAT ALREADY WORKS. `guard_users_privilege_
-- columns` (20270814328403) is a BEFORE UPDATE trigger that reverts privileged
-- columns for a non-privileged caller — same table, same problem, already
-- proven. Two triggers on one table racing to revert different columns is a
-- second mechanism for one rule, so the existing function is re-created with
-- two more lines rather than a sibling added beside it.
CREATE OR REPLACE FUNCTION public.guard_users_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role      TEXT := auth.role();  -- NULL under a direct/superuser connection
  privileged  BOOLEAN;
BEGIN
  privileged := (v_role IS NULL)                 -- migration / superuser / direct DB
             OR (v_role = 'service_role')        -- elevated admin client
             OR public.is_admin();               -- authenticated admin session

  IF privileged THEN
    RETURN NEW;
  END IF;

  -- Non-privileged caller: neutralize any attempt to change a privilege flag.
  NEW.is_internal    := OLD.is_internal;
  NEW.is_team_member := OLD.is_team_member;

  -- CTRL-B3 build 2, added 2026-09-22. The clickwrap record is evidence ABOUT
  -- the subject, so the subject must not be able to write it — forward (to
  -- manufacture an agreement) or backward (to erase one). `signUp` writes both
  -- on the service-role client, which is privileged above and passes through.
  NEW.terms_accepted_at := OLD.terms_accepted_at;
  NEW.terms_version     := OLD.terms_version;

  -- account_type: customer <-> vendor are peer identities (open-shop / callback
  -- self-heal them and confer no privilege), so only block ESCALATION to
  -- 'admin' — is_admin() keys off account_type = 'admin'.
  IF NEW.account_type = 'admin' AND OLD.account_type IS DISTINCT FROM 'admin' THEN
    NEW.account_type := OLD.account_type;
  END IF;

  RETURN NEW;
END;
$$;
