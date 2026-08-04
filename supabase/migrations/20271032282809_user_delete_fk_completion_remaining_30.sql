-- 20271032282809_user_delete_fk_completion_remaining_30.sql
--
-- SEC · Finish the user-delete FK sweep. Thirty blockers were left; this is the
-- decision for every one of them.
--
-- ── WHY THERE IS A SECOND SWEEP ────────────────────────────────────────────
-- Migration 20271030238978 (PR #4019) swept the FKs onto `auth.users` and fixed
-- 21 of them. It could not have fixed the admin "Delete user" on its own, and
-- the reason is one line of schema:
--
--     public.users.user_id -> auth.users(id)   ON DELETE CASCADE
--
-- Deleting an auth user therefore ALWAYS cascades into `public.users`, which
-- detonates every foreign key pointing at PUBLIC.users. Twenty-six of the thirty
-- remaining blockers point there, not at auth.users — invisible both to the
-- earlier sweep and to the guard test it shipped, whose query filters on
-- `confrelid = 'auth.users'::regclass`. The guard passed while the delete stayed
-- broken. That filter is widened in the same PR as this migration.
--
-- Verified against prod before writing (project njrupjnvkjkitfctetvi):
--   confdeltype 'a' NO ACTION  26   ← blocks
--   confdeltype 'r' RESTRICT    4   ← blocks
--   confdeltype 'n' SET NULL  121
--   confdeltype 'c' CASCADE    63
--
-- ── THE TEST APPLIED TO ALL THIRTY ─────────────────────────────────────────
-- Is the column the row's ACTOR or its SUBJECT?
--
--   ACTOR  — an authorship stamp: who reviewed, granted, uploaded, requested,
--            edited. The row records something that happened to somebody else or
--            to an event, and it stays TRUE when its author leaves. SET NULL.
--            This is also the erasure-correct answer: the person stops being
--            identifiable, the record survives. 23 of the 30.
--   SUBJECT— the row's whole reason for existing. Once the user is erased the
--            row is meaningless, and RETAINING it is itself the RA 10173
--            problem: you would be keeping a dossier on somebody who exercised
--            their right to be forgotten. CASCADE. 4 of the 30.
--   REFUSE — an anonymous actor would FALSIFY the record rather than merely
--            de-identify it. 3 of the 30, left untouched deliberately and
--            written into tests/db/user-delete-refusing-fks.baseline.txt.
--
-- ── THE THREE THAT KEEP REFUSING, AND WHY (NOT TOUCHED BELOW) ──────────────
--   order_refunds.refunded_by_admin_id       money leaving the business; an
--     unattributable refund is an unauditable one. (Its order_id -> orders FK is
--     ALSO RESTRICT, so converting this column alone would not unblock anything.)
--   supplies_orders.buyer_user_id            a commercial transaction with a
--     counterparty, a delivery address and a BIR duty. The buyer IS the record.
--   vendor_contract_signatures.signer_user_id  under RA 8792 the signer identity
--     is the legally operative act. Anonymising it does not protect the person,
--     it VOIDS the instrument and destroys the counterparty's enforceable rights.
-- For these the honest product answer is ANONYMIZE-AND-RETAIN, which is exactly
-- what lib/erasure/purge.ts already does — not a schema change.
--
-- ── THE PART THAT IS A REAL SEMANTIC CHANGE, NAMED RATHER THAN BURIED ──────
-- THIRTEEN of the 23 SET NULL columns are currently NOT NULL, so each needs
-- DROP NOT NULL in this same migration. A SET NULL constraint against a NOT NULL
-- column does NOT fail at migration time — it fails at DELETE time, converting a
-- cleanly-refused delete into a runtime 500. That is worse than the bug.
--
-- ⚠ Dropping NOT NULL genuinely retires the assertion "this row always has an
-- author". Every read path must now tolerate a null actor and render something
-- like "removed user". Affected: discount_code_eligible_users.added_by_admin_id,
-- discount_codes.created_by_admin_id, event_action_log.performed_by_user_id,
-- event_delegates.granted_by_user_id, event_inspiration_assets.added_by_user_id,
-- event_playlist_picks.created_by_user_id, kwento_assignments.assigned_by_user_id,
-- manpower_gigs.posted_by_user_id, order_ledger.actor_user_id,
-- patiktok_oauth_grants.granted_by, patiktok_render_jobs.requested_by,
-- render_jobs.requested_by, vendor_contracts.uploaded_by_user_id.
--
-- ── THREE IN-SCHEMA PRECEDENTS DECIDED THE ARGUABLE CASES ──────────────────
--   users.concierge_banned_by has an identical twin on the same table,
--     users.concierge_enforcement_by, ALREADY ON DELETE SET NULL. Twin settles it.
--   vendor_contracts.cancelled_by_user_id is already SET NULL while its sibling
--     uploaded_by_user_id was RESTRICT — an inconsistency inside one table is
--     evidence of drift, not design. Converting uploaded_by therefore unblocks
--     only UNSIGNED DRAFTS; signed contracts still refuse via signer_user_id.
--   founder_seats.user_id is already CASCADE, which decides
--     founder_time_log.user_id the same way.
--
-- ── NO DATA IS DESTROYED BY THIS MIGRATION ─────────────────────────────────
-- It changes constraint ACTIONS and column nullability only; not one row is
-- written. Row counts checked first (prod is pre-launch-empty): the four CASCADE
-- tables are all EMPTY today (concierge_abuse_flags 0, discount_code_redemptions
-- 0, event_delegates 0, founder_time_log 0), so nothing is put at risk of a
-- cascade that is not already the intended behaviour.
--
-- ── IDEMPOTENT AND RE-RUNNABLE ─────────────────────────────────────────────
-- Constraint names are LOOKED UP from pg_constraint rather than guessed, so a
-- historically differently-named constraint is still found and replaced. A table
-- or column that does not exist is skipped rather than aborting the migration,
-- and a constraint already carrying the target action is left alone.

-- ── THE SCHEMA ALREADY AGREED WITH THIS SPLIT, AND PROD HAD DRIFTED OFF IT ─
-- `concierge_abuse_flags` is the corroboration. Its CREATE TABLE, back in
-- 20260518000000, writes the exact verdicts reached independently above:
--
--     flagged_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE
--     reviewed_by     UUID          REFERENCES public.users(user_id) ON DELETE SET NULL
--
-- The subject cascades, the reviewer is nulled — written down in 2026 and then
-- LOST: in prod today both read NO ACTION. So this migration is not introducing
-- a new opinion on that table, it is restoring the one already declared.
--
-- ── ONE PIECE OF SCHEMA DRIFT FIXED IN PASSING ─────────────────────────────
-- `users.concierge_banned_by` HAS a foreign key in prod (NO ACTION, which is why
-- it is in this sweep) and has NO foreign key in the migration corpus: the only
-- file that mentions the column, 20271011873973_reconcile_declared_schema_to_
-- production.sql, declares it as a bare `UUID` with no REFERENCES clause. The
-- constraint was therefore created outside the corpus, and a fresh replay of all
-- migrations produces a schema where the column points at nothing.
--
-- So this migration does not merely CONVERT constraints, it ENSURES them: when
-- the shape-based lookup finds no FK for a listed column, it adds one with the
-- decided behaviour. Prod is unaffected (its constraint exists and is converted
-- in place); the replayed schema converges onto prod instead of diverging.

DO $$
DECLARE
  spec    record;
  found   record;
  target  char(1);
  matched boolean;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- ── 1 · ACTOR / authorship stamp  →  SET NULL (23) ──────────────────
      -- tbl                              col                        parent_sch  parent_col  action      drop_not_null
      ('concierge_abuse_flags',          'reviewed_by',              'public', 'user_id', 'SET NULL', false),
      ('concierge_brain_chunks',         'last_verified_by_user_id', 'public', 'user_id', 'SET NULL', false),
      ('concierge_plan_templates',       'admin_edited_by_user_id',  'public', 'user_id', 'SET NULL', false),
      ('concierge_response_cache',       'admin_edited_by_user_id',  'public', 'user_id', 'SET NULL', false),
      ('concierge_unanswered_questions', 'resolved_by_user_id',      'public', 'user_id', 'SET NULL', false),
      ('discount_code_eligible_users',   'added_by_admin_id',        'public', 'user_id', 'SET NULL', true),
      ('discount_codes',                 'created_by_admin_id',      'public', 'user_id', 'SET NULL', true),
      ('event_action_log',               'performed_by_user_id',     'public', 'user_id', 'SET NULL', true),
      ('event_delegates',                'granted_by_user_id',       'public', 'user_id', 'SET NULL', true),
      ('event_delegates',                'revoked_by_user_id',       'public', 'user_id', 'SET NULL', false),
      ('event_inspiration_assets',       'added_by_user_id',         'public', 'user_id', 'SET NULL', true),
      ('event_playlist_picks',           'created_by_user_id',       'public', 'user_id', 'SET NULL', true),
      ('founder_seats',                  'granted_by',               'public', 'user_id', 'SET NULL', false),
      ('kwento_assignments',             'assigned_by_user_id',      'auth',   'id',      'SET NULL', true),
      ('manpower_gigs',                  'posted_by_user_id',        'public', 'user_id', 'SET NULL', true),
      ('moodboard_library_assets',       'uploaded_by',              'public', 'user_id', 'SET NULL', false),
      ('order_ledger',                   'actor_user_id',            'public', 'user_id', 'SET NULL', true),
      ('owner_alerts',                   'acknowledged_by',          'public', 'user_id', 'SET NULL', false),
      ('patiktok_oauth_grants',          'granted_by',               'auth',   'id',      'SET NULL', true),
      ('patiktok_render_jobs',           'requested_by',             'auth',   'id',      'SET NULL', true),
      ('render_jobs',                    'requested_by',             'auth',   'id',      'SET NULL', true),
      ('users',                          'concierge_banned_by',      'public', 'user_id', 'SET NULL', false),
      ('vendor_contracts',               'uploaded_by_user_id',      'public', 'user_id', 'SET NULL', true),

      -- ── 2 · SUBJECT / meaningless without the user  →  CASCADE (4) ───────
      -- concierge_abuse_flags.flagged_user_id — a behavioural dossier ABOUT this
      --   person (similarity scores, matched_user_ids, admin notes). The clearest
      --   CASCADE of the thirty. NOTE the pairing with reviewed_by above: the
      --   reviewer is a stamp (SET NULL), the flagged person is the subject.
      ('concierge_abuse_flags',          'flagged_user_id',          'public', 'user_id', 'CASCADE',  false),
      -- discount_code_redemptions.couple_user_id — the row ALREADY disappears via
      --   order_id -> orders, because orders.user_id is ALREADY ON DELETE CASCADE.
      --   Blocking here protected nothing; CASCADE makes the FK agree with the
      --   outcome the schema already produces.
      ('discount_code_redemptions',      'couple_user_id',           'public', 'user_id', 'CASCADE',  false),
      -- event_delegates.delegate_user_id — this row IS the grant of access to this
      --   person. A dangling access row after erasure is a security defect, not an
      --   untidiness. Opposite call to granted_by_user_id in the same table, and
      --   that asymmetry is the whole point.
      ('event_delegates',                'delegate_user_id',         'public', 'user_id', 'CASCADE',  false),
      -- founder_time_log.user_id — a person's own weekly self-reported time split.
      --   No counterparty, no money, no external duty. founder_seats.user_id on
      --   the same feature is already CASCADE.
      ('founder_time_log',               'user_id',                  'public', 'user_id', 'CASCADE',  false)
    ) AS v(tbl, col, parent_schema, parent_col, action, drop_not_null)
  LOOP
    -- Skip cleanly if the table or column is absent, so the file stays replayable
    -- against any historical schema instead of aborting the whole migration.
    IF to_regclass('public.' || spec.tbl) IS NULL THEN
      RAISE NOTICE 'skip: public.% does not exist', spec.tbl;
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
       WHERE attrelid = ('public.' || spec.tbl)::regclass
         AND attname = spec.col AND attnum > 0 AND NOT attisdropped
    ) THEN
      RAISE NOTICE 'skip: public.%.% does not exist', spec.tbl, spec.col;
      CONTINUE;
    END IF;

    -- SET NULL against a NOT NULL column fails at DELETE time, not here. Drop the
    -- assertion FIRST so the constraint we add is actually executable.
    -- (DROP NOT NULL is already a no-op on an already-nullable column.)
    IF spec.drop_not_null THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', spec.tbl, spec.col);
    END IF;

    target  := CASE spec.action WHEN 'CASCADE' THEN 'c' ELSE 'n' END;
    matched := false;

    -- Find the EXISTING single-column FK on (tbl, col) pointing at the users
    -- table by SHAPE rather than by name — a constraint minted under a different
    -- name in some older migration is still the one we mean.
    -- NOTE the parent SCHEMA is not in the WHERE clause. It is checked inside the
    -- loop instead, so that a column already carrying a users-FK pointing at the
    -- OTHER users table still counts as matched. Repointing an FK from auth.users
    -- to public.users (or back) is a semantic change nobody asked for, and adding
    -- a second FK alongside it would be worse — so that case is left alone and
    -- announced. It does not arise in prod, where all thirty match this table.
    FOR found IN
      SELECT con.conname, con.confdeltype, pn.nspname AS parent_schema
        FROM pg_constraint con
        JOIN pg_attribute a  ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
        JOIN pg_class     pr ON pr.oid     = con.confrelid
        JOIN pg_namespace pn ON pn.oid     = pr.relnamespace
       WHERE con.contype = 'f'
         AND con.conrelid = ('public.' || spec.tbl)::regclass
         AND array_length(con.conkey, 1) = 1
         AND a.attname   = spec.col
         AND pr.relname  = 'users'
         AND pn.nspname IN ('public', 'auth')
    LOOP
      matched := true;
      IF found.parent_schema <> spec.parent_schema THEN
        RAISE NOTICE 'left alone: %.% points at %.users, not %.users',
          spec.tbl, spec.col, found.parent_schema, spec.parent_schema;
        CONTINUE;
      END IF;
      CONTINUE WHEN found.confdeltype = target;  -- already correct → re-run is a no-op
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec.tbl, found.conname);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.users(%I) ON DELETE %s',
        spec.tbl,
        -- Re-mint under the canonical Postgres name so the schema stays uniform
        -- (it matches the current prod name for all thirty).
        spec.tbl || '_' || spec.col || '_fkey',
        spec.col, spec.parent_schema, spec.parent_col, spec.action
      );
      RAISE NOTICE 'converted %.% -> % (was %)', spec.tbl, spec.col, spec.action, found.confdeltype;
    END LOOP;

    -- No FK at all on a column this file is deciding the delete behaviour for.
    -- In prod that is impossible for all thirty; in a fresh replay it is exactly
    -- users.concierge_banned_by (see the drift note above). Add it, so "the
    -- schema says what we decided" is true on every database, not just prod.
    IF NOT matched THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.users(%I) ON DELETE %s',
        spec.tbl, spec.tbl || '_' || spec.col || '_fkey',
        spec.col, spec.parent_schema, spec.parent_col, spec.action
      );
      RAISE NOTICE 'added missing FK %.% -> %.users (%)', spec.tbl, spec.col, spec.parent_schema, spec.action;
    END IF;
  END LOOP;
END $$;
