-- song_requests_open_column_gate
-- ============================================================================
-- SECURITY — the act's requests window is a PAID entitlement, so it must not be
-- writable by every authenticated vendor who happens to hold the row.
--
-- ── THE DEFECT ──────────────────────────────────────────────────────────────
-- `vendor_dayof_configs.song_requests_open` (20271014100000) is governed by
-- `vendor_dayof_configs_vendor_update`, which asks exactly one question: is this
-- your row (`current_vendor_profile_ids()`). It never asks whether the vendor
-- holds the `song_desk` specialization, which is the thing being sold
-- (SPECIALIZATION_MIN_TIER = 'solo'; lib/vendor-specialization-gate.ts).
--
-- Postgres RLS is ROW-level, never COLUMN-level. The anon key is public and
-- PostgREST is reachable directly, so a FREE-tier band booked on an event can
--
--     PATCH /rest/v1/vendor_dayof_configs?vendor_profile_id=eq.<their own>
--     { "song_requests_open": true }
--
-- and start collecting guest song requests they have not paid for. Verified:
-- `resolveVendorSpecializationAccess` is imported only by the RENDER path
-- (vendor-dayof-frame.ts · specialization-slot.tsx · live/[eventId]/page.tsx).
-- No write path checks it. This is the frame's own documented warning — "the
-- frame guarantees your component is only MOUNTED for an entitled vendor; it
-- does not authorise your queries" — landing as a real hole.
--
-- Harm today is nil: no UI writes this column and the window defaults FALSE.
-- That is precisely why it is closed BEFORE the song-desk UI ships.
--
-- ── THE MECHANISM ───────────────────────────────────────────────────────────
-- The same structural control as 20271005100000 (events column privileges). RLS
-- keeps deciding WHICH ROWS; the grant decides WHICH COLUMNS. Postgres cannot
-- subtract one column from a table-level grant, so the table-level INSERT and
-- UPDATE are revoked and an explicit column allow-list is granted back —
-- computed at apply time as "every column MINUS the deny-set", never
-- hand-enumerated, so a column this migration never looked at keeps exactly the
-- access it has today.
--
-- The write path becomes `setSongRequestsOpen` (app/vendor-dashboard/
-- on-the-day/actions.ts): it resolves the entitlement in TypeScript — the one
-- place that rule lives, including the admin free-window promotion that
-- `resolveVendorTier` folds in — and only then writes as service_role. Encoding
-- the check in SQL instead would fork the rule into a second implementation, and
-- the two would drift.
--
-- SELECT is deliberately untouched: a vendor reading the state of their own
-- switch is not the thing being sold.
--
-- REVERSIBLE: `GRANT INSERT, UPDATE ON public.vendor_dayof_configs TO
-- authenticated;` restores the previous state exactly.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Withheld from `authenticated`. One column, one defect — the deny-set is not
  -- an opportunity to lock neighbours that no exploit names.
  locked_columns TEXT[] := ARRAY['song_requests_open'];
  allowed TEXT;
  missing TEXT[];
BEGIN
  -- Fail loudly on a typo: a misspelled entry would lock nothing at all and the
  -- migration would "pass" vacuously.
  SELECT array_agg(c) INTO missing
  FROM unnest(locked_columns) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_dayof_configs'
      AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'locked_columns names non-existent vendor_dayof_configs column(s): %',
      array_to_string(missing, ', ');
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO allowed
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'vendor_dayof_configs'
    AND column_name <> ALL (locked_columns);

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed allow-list is empty';
  END IF;

  EXECUTE 'REVOKE INSERT, UPDATE ON public.vendor_dayof_configs FROM authenticated';
  EXECUTE format('GRANT INSERT (%s) ON public.vendor_dayof_configs TO authenticated', allowed);
  EXECUTE format('GRANT UPDATE (%s) ON public.vendor_dayof_configs TO authenticated', allowed);

  -- Restate service_role explicitly. It already holds this in prod via Supabase
  -- default privileges, so this is a no-op there — but it makes the migration
  -- self-sufficient rather than assuming HOW service_role acquired its grant,
  -- and it keeps the post-conditions meaningful on a freshly-built database.
  EXECUTE 'GRANT INSERT, UPDATE ON public.vendor_dayof_configs TO service_role';
END $$;

-- ----------------------------------------------------------------------------
-- Post-conditions — asserted against the REAL catalog, so a half-applied or
-- silently-ineffective grant fails the migration instead of shipping.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- 1. The locked column is no longer writable by `authenticated`, either verb.
  IF EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name = 'vendor_dayof_configs'
      AND column_name = 'song_requests_open'
      AND grantee = 'authenticated'
      AND privilege_type IN ('INSERT', 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'post-condition failed: authenticated can still write song_requests_open';
  END IF;

  -- 2. The module override — the write this table exists for — still works. A
  --    fix that silently broke the configurator would be a worse bug than the
  --    hole it closed.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name = 'vendor_dayof_configs'
      AND column_name = 'enabled_modules'
      AND grantee = 'authenticated'
      AND privilege_type = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: authenticated lost UPDATE on enabled_modules';
  END IF;

  -- 3. The vendor can still READ their own switch. Reading it is not the sale.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name = 'vendor_dayof_configs'
      AND column_name = 'song_requests_open'
      AND grantee = 'authenticated'
      AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: authenticated lost SELECT on song_requests_open';
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_dayof_configs.song_requests_open IS
  'The act''s requests window for this booking (owner 2026-07-27: "the band will open or close accepting requests"). FALSE by default — a band that never opens it never receives a request. Read by guest_submit_song_request / open_submit_song_request via song_requests_open_for_event(). WRITE-GATED (20271020159662): `authenticated` holds no INSERT/UPDATE column privilege here, because opening the window is the paid song_desk specialization. The only write path is setSongRequestsOpen() in app/vendor-dashboard/on-the-day/actions.ts, which resolves the entitlement before writing as service_role.';

COMMIT;
