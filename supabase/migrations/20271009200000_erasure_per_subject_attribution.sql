-- ============================================================================
-- RA 10173 right-to-erasure — PER-SUBJECT ATTRIBUTION for two event-keyed tables
--
-- ⚠ NUMBERING (2026-07-26). Originally written as 20271009100000 and renumbered
-- before merge: two OTHER branches landed 20271009120000 and 20271009140000 in
-- prod while this one was in review, and Supabase SILENTLY SKIPS a migration
-- numbered below one already applied — it would have appeared to merge cleanly
-- and never run, leaving the purge scoping on columns that do not exist. Check
-- `supabase_migrations.schema_migrations` (not just `ls supabase/migrations/`)
-- before picking a timestamp; the local directory lags prod on a busy day.
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

-- ============================================================================
-- LOCK THE TWO NEW COLUMNS AGAINST THE BROWSER — in the SAME file that creates
-- them, so the column and its lockdown can never be cherry-picked apart.
--
-- ⚠ THE TRAP THIS CLOSES. This project carries
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated
--   so a column added by `ADD COLUMN` ships with `arwdDxtm` for BOTH browser
--   roles. New columns are OPEN by default; `GRANT` is additive and subtracts
--   nothing. Without this block the exposure freeze reports exactly:
--     col public.event_paperwork.subject_user_id  anon=SIU authenticated=SIU
--     col public.oauth_grants.granted_by_user_id  anon=SIU authenticated=SIU
--   (verified — that is the CI failure this block was written against). The
--   same trap broke a different migration earlier the same day.
--
-- ⚠ POSTGRES RULE THAT MAKES THE NAIVE FIX A NO-OP. From the REVOKE docs: "if a
--   role has been granted privileges on a table, then revoking the same
--   privileges from individual columns will have no effect." Both roles hold
--   TABLE-level SELECT/INSERT/UPDATE here, so
--     REVOKE SELECT (subject_user_id) ON public.event_paperwork FROM authenticated;
--   would apply cleanly, change nothing, and leave the column readable. The
--   table-level privilege must be revoked FIRST and an explicit column list
--   granted back — the same REVOKE-then-GRANT shape as SEC-2b
--   (20271008731642). The allow-list is computed from LIVE privileges rather
--   than from the full catalog, so it is a UNION with every earlier revoke on
--   these tables instead of a silent undo of one.
--
-- ── WHY *ALL THREE* PRIVILEGES, NOT JUST SELECT ─────────────────────────────
-- SELECT · nothing in apps/web reads either column from a browser client.
--   Every reader of `subject_user_id` and `granted_by_user_id` is the purge
--   (lib/erasure/purge.ts), which runs as service_role by design; the only
--   writer of `granted_by_user_id` is the three OAuth callback routes, all on
--   createAdminClient(). Denying costs nothing.
-- UPDATE · this is the load-bearing one, and it is the SEC-6 shape (a
--   host-writable field feeding a server decision). `event_paperwork`'s host
--   policies are TO PUBLIC with cmd=UPDATE, so a host really can PATCH their
--   own paperwork rows through the anon key. Leaving `subject_user_id`
--   writable would let a host stamp the CO-PARTNER'S user id onto their own
--   rows — and erasure would then destroy the co-partner's PSA/CENOMAR scan on
--   the attacker's say-so. That is precisely the harm the column was added to
--   prevent, handed back through the front door. An erasure-control input must
--   be server-attributed or it controls nothing.
-- INSERT · same reasoning at row-creation time; `seedPaperworkForEvent` posts
--   an explicit four-column payload and never names this column.
-- ============================================================================
DO $$
DECLARE
  -- (table, column-that-must-not-reach-the-browser)
  targets TEXT[][] := ARRAY[
    ARRAY['event_paperwork', 'subject_user_id'],
    ARRAY['oauth_grants',    'granted_by_user_id']
  ];
  pair    TEXT[];
  tbl     TEXT;
  denied  TEXT;
  qname   TEXT;
  priv    TEXT;
  rle     TEXT;
  allowed TEXT;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY targets LOOP
    tbl    := pair[1];
    denied := pair[2];
    qname  := format('public.%I', tbl);

    -- Fail loudly on a typo: a misspelled column would deny nothing and the
    -- migration would "pass" vacuously.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = denied
    ) THEN
      RAISE EXCEPTION 'deny-set names a non-existent column: %.%', tbl, denied;
    END IF;

    FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      FOREACH rle IN ARRAY ARRAY['authenticated', 'anon'] LOOP
        SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
          INTO allowed
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name   = tbl
          AND c.column_name <> denied
          AND has_column_privilege(rle, qname, c.column_name, priv);

        -- Table-level must go first — Postgres cannot subtract a column from a
        -- table-level grant (see the header).
        EXECUTE format('REVOKE %s ON %s FROM %I', priv, qname, rle);

        -- NULL means the role held nothing of this kind to begin with (or held
        -- it only on the denied column). Granting an empty list is a syntax
        -- error, and re-granting would be a widening — so skip.
        IF allowed IS NOT NULL THEN
          EXECUTE format('GRANT %s (%s) ON %s TO %I', priv, allowed, qname, rle);
        END IF;
      END LOOP;
    END LOOP;

    -- Restate service_role's full access explicitly. Already true in prod via
    -- Supabase default privileges, so a no-op there — but it makes the
    -- migration self-sufficient on a freshly-built database and keeps the
    -- post-condition below meaningful rather than accidentally satisfied.
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO service_role', qname);
  END LOOP;
END $$;

-- ── Post-conditions — assert against the REAL catalog, so a silently ────────
--    ineffective grant fails the migration instead of shipping.
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  c   TEXT;
BEGIN
  -- (a) neither new column may be reachable by either browser role, in any of
  --     the three privileges. This is the assertion that would have caught the
  --     no-op column-REVOKE described in the header.
  FOREACH c IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
    IF has_column_privilege('authenticated', 'public.event_paperwork', 'subject_user_id', c)
       OR has_column_privilege('anon', 'public.event_paperwork', 'subject_user_id', c) THEN
      bad := array_append(bad, 'event_paperwork.subject_user_id still has ' || c);
    END IF;
    IF has_column_privilege('authenticated', 'public.oauth_grants', 'granted_by_user_id', c)
       OR has_column_privilege('anon', 'public.oauth_grants', 'granted_by_user_id', c) THEN
      bad := array_append(bad, 'oauth_grants.granted_by_user_id still has ' || c);
    END IF;
  END LOOP;

  -- (b) the couple's OWN paperwork surface must survive intact. These are the
  --     exact columns the host UI reads and writes through the session client:
  --     the dashboard's explicit select list (_components/event-dashboard.tsx),
  --     lib/paperwork.ts, and the four-column seed upsert + status/notes
  --     updates in paperwork/actions.ts. If any of them lost SELECT or UPDATE,
  --     the paperwork checklist breaks.
  FOREACH c IN ARRAY ARRAY[
    'id','event_id','document_type','status','requested_at','received_at',
    'expected_completion_date','expires_at','tracking_reference',
    'document_r2_key','notes','created_at','updated_at'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.event_paperwork', c, 'SELECT') THEN
      bad := array_append(bad, 'lost host SELECT on event_paperwork.' || c);
    END IF;
    IF NOT has_column_privilege('authenticated', 'public.event_paperwork', c, 'UPDATE') THEN
      bad := array_append(bad, 'lost host UPDATE on event_paperwork.' || c);
    END IF;
  END LOOP;
  FOREACH c IN ARRAY ARRAY['event_id','document_type','status','expected_completion_date'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.event_paperwork', c, 'INSERT') THEN
      bad := array_append(bad, 'lost host INSERT on event_paperwork.' || c);
    END IF;
  END LOOP;

  -- (c) the couple-facing oauth_grants read (the Panood setup page's
  --     grant_id / external_account_* / granted_at / metadata projection, plus
  --     connection_health on the Papic + Photo-Delivery panels) must survive.
  FOREACH c IN ARRAY ARRAY[
    'grant_id','event_id','provider','external_account_id',
    'external_account_display','granted_at','revoked_at','metadata',
    'connection_health'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.oauth_grants', c, 'SELECT') THEN
      bad := array_append(bad, 'lost couple SELECT on oauth_grants.' || c);
    END IF;
  END LOOP;

  -- (d) service_role — the purge, the OAuth callbacks and the refresh cron all
  --     run here — must be entirely unaffected on both tables.
  IF NOT has_column_privilege('service_role', 'public.event_paperwork', 'subject_user_id', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.event_paperwork', 'subject_user_id', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.oauth_grants', 'granted_by_user_id', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.oauth_grants', 'granted_by_user_id', 'UPDATE') THEN
    bad := array_append(bad, 'service_role lost access to an attribution column');
  END IF;

  IF array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION 'erasure-attribution column lockdown post-condition failed: %',
      array_to_string(bad, '; ');
  END IF;
END $$;
