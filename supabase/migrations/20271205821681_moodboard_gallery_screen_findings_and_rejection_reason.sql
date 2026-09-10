-- ============================================================================
-- 20271205821681_moodboard_gallery_screen_findings_and_rejection_reason.sql
-- MB21 — THE QUESTIONABLE PHOTO REACHES A HUMAN, AND THE REFUSED ONE REACHES
--        ITS SUPPLIER.
--
-- MB11's content screen had exactly TWO outcomes: clean, or refused at the
-- door. The owner's rule (2026-09-05) has three, and the middle one had
-- nowhere to live:
--
--   QR code · any URL · any social handle · any email · the vendor's own name,
--   phone or logo                         → hard block, naming what was found
--   unfamiliar name · phone-shaped digits · logo-ish mark · heavy text
--                                         → FLAG, a human looks
--   clean                                 → draft, admin approval as today
--
-- This migration adds the two facts the code cannot hold:
--
--   1. WHAT THE SCREEN FOUND.  `screen_findings JSONB` — the hits, each naming
--      itself, plus the transcribed text the judgement was read from. Without
--      the text the flag is a shrug: an admin cannot act on "we saw a name"
--      without seeing which name, on which sign.
--   2. WHY A HUMAN SAID NO.  `rejected_at` + `rejection_reason`, PAIRED by a
--      CHECK in the shape `rights_warranted_at`/`rights_warranty_version`
--      already established on this table (20271202093185). Retiring a photo
--      was the only refusal available, and it left the supplier's own editor
--      saying "draft (pending review)" forever with no reason and nothing to
--      fix.
--
-- ── WHY A PAIRED CHECK AND NOT TWO INDEPENDENT NULLABLE COLUMNS ────────────
-- A `rejected_at` with no reason is the defect this session exists to remove,
-- reintroduced one UPDATE at a time; a `rejection_reason` with no `rejected_at`
-- is a sentence shown to a supplier about a rejection that never happened. The
-- constraint makes both unrepresentable rather than merely discouraged, and it
-- refuses a blank reason too — `retire, reason: ' '` would satisfy a naive
-- pairing and render as an empty box.
--
-- 🔑 AND NEITHER NEW COLUMN IS REACHED BY ANY `ON DELETE SET NULL`. That is
-- checked, not assumed: 20271202522764 records what a CHECK over a SET NULL
-- column costs — the cascade UPDATE violates the check, Postgres fails the
-- PARENT delete, and deleting a celebration (hence an account, hence RA 10173
-- erasure) is blocked by a supplier's photograph while the FK still advertises
-- itself as SET NULL. These three columns are FK-free scalars written only by
-- the service role, so the hazard does not arise here.
--
-- 🛑 NOT APPLIED BY HAND. deploy-prod.yml runs `supabase db push --include-all
-- --yes` on the committed file; a direct apply stamps the prod ledger with a
-- version that has no file on main and jams db push for EVERY subsequent merge
-- (2026-09-02 — seven merged PRs stranded for three hours).
--
-- No new tables → no new RLS. Additive only. Idempotent.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · THE COLUMNS
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS screen_findings   JSONB,
  ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;

-- The pairing, in the shape the rights warranty already uses on this table.
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_rejection_paired;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_rejection_paired
  CHECK (
    (rejected_at IS NULL) = (rejection_reason IS NULL)
    AND (rejection_reason IS NULL OR btrim(rejection_reason) <> '')
  );

-- The admin queue's own query: gallery photos a human has not yet ruled on,
-- that the screen had something to say about. Partial, so it stays the size of
-- the queue rather than the size of the library.
CREATE INDEX IF NOT EXISTS idx_moodboard_library_assets_flagged_queue
  ON public.moodboard_library_assets (created_at DESC)
  WHERE screen_findings IS NOT NULL
    AND approved_at IS NULL
    AND rejected_at IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · THREE SERVER-ONLY COLUMNS, AND THE GRANT IS THE ONLY THING THAT SAYS SO
-- ────────────────────────────────────────────────────────────────────────────
--
-- 🛑 A NEW COLUMN INHERITS THE PUBLIC GRANT SILENTLY. Supabase grants
-- table-level ALL on every public table, so `ADD COLUMN` alone hands `anon` and
-- `authenticated` SELECT, INSERT and UPDATE on all three of these. That was
-- caught on `source_event_id` by exposure-freeze.db.test.ts in 20271202522764
-- and the same trap is set here, with worse contents:
--
--   READ  — `moodboard_library_assets` has a PUBLIC read policy (approved and
--           un-retired) and the anon key ships in the page source by design.
--           `screen_findings` carries the FULL TRANSCRIBED TEXT of the
--           photograph — every name on the backdrop, every line of the menu —
--           and `rejection_reason` carries a Setnayan reviewer's private words
--           about a supplier's work. Neither is anybody's business but the
--           shop's and ours.
--   WRITE — the worse half. `moodboard_library_assets_vendor_insert`
--           (20260527000000) admits a vendor's OWN row, and no policy
--           constrains a column's VALUE. With the grant a supplier could POST
--           straight to PostgREST and clear their own `rejected_at`, or write
--           `screen_findings` themselves so the queue never sees their photo.
--           The entire review this migration exists for would be one HTTP
--           request wide.
--
-- 🔑 RLS IS ROW-LEVEL, NEVER VALUE-LEVEL. A policy that admits you to your own
-- row cannot stop you writing any value into a column of it. Only the GRANT
-- can. (Same lesson as SEC-8 · 20271009210000 and MB11 · 20271202522764.)
--
-- ⚠ AND THE NAIVE ONE-LINER IS A NO-OP. Postgres: "if a role has been granted
-- privileges on a table, then revoking the same privileges from individual
-- columns will have no effect." Both roles hold TABLE-level grants here today,
-- so `REVOKE ALL (screen_findings) ON … FROM anon, authenticated` would apply
-- without error and change nothing. The correct shape — established on
-- `oauth_grants`, `events` and this very table — is REVOKE at the table level,
-- then re-GRANT an explicit allow-list computed from LIVE privileges so it
-- unions with, rather than silently undoes, any earlier column denial
-- (`source_event_id`'s, in particular).

DO $$
DECLARE
  priv    TEXT;
  rle     TEXT;
  allowed TEXT;
  closed  TEXT[] := ARRAY['screen_findings', 'rejected_at', 'rejection_reason'];
  col     TEXT;
BEGIN
  -- Fail loudly on a rename rather than shipping a green no-op.
  FOREACH col IN ARRAY closed LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'moodboard_library_assets'
         AND column_name  = col
    ) THEN
      RAISE EXCEPTION '% is missing — this revoke would deny nothing', col;
    END IF;
  END LOOP;

  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      -- Computed from LIVE privileges, not from the full catalog, so MB11's
      -- source_event_id denial survives instead of being undone.
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
        INTO allowed
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = 'moodboard_library_assets'
        AND NOT (c.column_name = ANY (closed))
        AND has_column_privilege(rle, 'public.moodboard_library_assets', c.column_name, priv);

      -- NULL means the role never had this privilege at all — nothing to
      -- narrow, and re-granting an empty list would be a syntax error.
      CONTINUE WHEN allowed IS NULL;

      EXECUTE format('REVOKE %s ON public.moodboard_library_assets FROM %I', priv, rle);
      EXECUTE format(
        'GRANT %s (%s) ON public.moodboard_library_assets TO %I', priv, allowed, rle);
    END LOOP;
  END LOOP;

  -- The server keeps everything. True already via Supabase defaults; restated
  -- so a freshly-replayed database matches prod and the post-condition below
  -- is meaningful rather than accidentally satisfied.
  EXECUTE 'GRANT ALL ON public.moodboard_library_assets TO service_role';
END $$;

COMMENT ON COLUMN public.moodboard_library_assets.screen_findings IS
  'MB21 · what lib/moodboard-gallery-screen.server.ts found in this photo: {outcome, hits[], text, textScreen, screenedAt}. NOT NULL means a human should look — the admin queue reads exactly that. Carries the FULL transcribed text of the image, so SELECT/INSERT/UPDATE are REVOKED from anon + authenticated; read and write it only through a service-role client. A clean photo stores nothing rather than storing an empty verdict.';

COMMENT ON COLUMN public.moodboard_library_assets.rejected_at IS
  'MB21 · when a Setnayan reviewer refused this photo. Paired with rejection_reason by moodboard_library_assets_rejection_paired — neither can exist without the other, because a rejection with no reason is the defect this column exists to remove. Revoked from anon + authenticated: RLS admits a supplier to their own row and cannot stop them clearing this value.';

COMMENT ON COLUMN public.moodboard_library_assets.rejection_reason IS
  'MB21 · the reviewer''s own words, shown to the supplier in their library editor as "We couldn''t publish this: <reason>." Blank is refused by the pairing CHECK. Revoked from anon + authenticated — it is a private note about a shop''s work on a table with a PUBLIC read policy.';

-- Post-conditions — assert against the REAL catalog so a silently-ineffective
-- revoke fails the migration instead of shipping and looking fixed.
DO $$
DECLARE
  bad  TEXT[] := ARRAY[]::TEXT[];
  rle  TEXT;
  priv TEXT;
  col  TEXT;
BEGIN
  -- (a) THE FINDING. Neither browser role may touch the three new columns, in
  --     any mode.
  FOREACH col IN ARRAY ARRAY['screen_findings', 'rejected_at', 'rejection_reason'] LOOP
    FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
        IF has_column_privilege(rle, 'public.moodboard_library_assets', col, priv) THEN
          bad := array_append(bad, rle || ' can still ' || priv || ' ' || col);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- (b) MB11'S DENIAL MUST HAVE SURVIVED. A re-granted allow-list computed
  --     from the full catalog instead of from live privileges would quietly
  --     hand source_event_id back, re-opening the quota bypass.
  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_column_privilege(
         rle, 'public.moodboard_library_assets', 'source_event_id', 'SELECT')
       OR has_column_privilege(
         rle, 'public.moodboard_library_assets', 'source_event_id', 'UPDATE') THEN
      bad := array_append(bad, rle || ' regained source_event_id — MB11 undone');
    END IF;
  END LOOP;

  -- (c) NOTHING ELSE MAY HAVE BEEN LOST. These are the columns the vendor
  --     insert policy and the couple-facing picker actually use.
  FOREACH col IN ARRAY ARRAY[
    'asset_id','asset_type','asset_subtype','label','storage_path','source',
    'uploaded_by','approved_at','retired_at','created_at','vendor_profile_id',
    'rights_warranted_at','rights_warranty_version'
  ] LOOP
    IF NOT has_column_privilege(
         'authenticated', 'public.moodboard_library_assets', col, 'SELECT') THEN
      bad := array_append(bad, 'lost authenticated SELECT on ' || col);
    END IF;
    IF NOT has_column_privilege(
         'anon', 'public.moodboard_library_assets', col, 'SELECT') THEN
      bad := array_append(bad, 'lost anon SELECT on ' || col);
    END IF;
  END LOOP;

  -- (d) THE SERVER MUST BE UNTOUCHED — every write on this path is its.
  FOREACH col IN ARRAY ARRAY['screen_findings', 'rejected_at', 'rejection_reason'] LOOP
    IF NOT has_column_privilege(
         'service_role', 'public.moodboard_library_assets', col, 'INSERT')
       OR NOT has_column_privilege(
         'service_role', 'public.moodboard_library_assets', col, 'SELECT')
       OR NOT has_column_privilege(
         'service_role', 'public.moodboard_library_assets', col, 'UPDATE') THEN
      bad := array_append(bad, 'service_role lost ' || col);
    END IF;
  END LOOP;

  -- (e) A COLUMN REVOKE IS NOT A SUBSTITUTE FOR THE ROW POLICY.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'moodboard_library_assets'
       AND c.relrowsecurity
  ) THEN
    bad := array_append(bad, 'RLS is no longer enabled on moodboard_library_assets');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'MB21 grant post-conditions failed: %', array_to_string(bad, '; ');
  END IF;
END $$;

COMMIT;
