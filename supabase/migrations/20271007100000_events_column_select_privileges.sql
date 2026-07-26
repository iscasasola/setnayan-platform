-- events_column_select_privileges
-- ============================================================================
-- SEC-2 — column-level SELECT privileges on public.events.
--
-- ── THE FINDING (2026-07-26 privilege audit, deferred out of PR #3715) ──────
-- A wedding GUEST — not a host, not a coordinator — can SELECT the entire
-- events row, including `master_qr_token` and the Google Drive OAuth token.
--
--     public.current_event_ids()   (20260512000000:178)
--       = SELECT event_id FROM event_members WHERE user_id = auth.uid()
--
-- has NO member_type filter, and `event_member_can_read` (20260512000000:242)
-- is `FOR SELECT TO authenticated USING (event_id IN current_event_ids())`.
-- A plain guest row (member_type='guest', seeded by app/join/[eventId]) is
-- therefore a full "member". Migration 20270920030000 re-scoped that pattern
-- off current_event_ids() on SEVEN tables — but deliberately left the events
-- row itself on it ("benign event context"), and the tokens live on that row.
--
-- With the public anon key (it is public) a guest can simply:
--     GET /rest/v1/events?event_id=eq.<event>&select=master_qr_token,
--         photo_delivery_oauth_token_encrypted
--
-- ── WHY A COLUMN GRANT AND NOT A POLICY RE-SCOPE ────────────────────────────
-- Postgres RLS is ROW-level, NEVER column-level. A policy can only answer
-- "this guest sees the row / does not see the row" — it cannot answer "this
-- guest sees 18 of the 192 columns". And a guest genuinely NEEDS a slice of
-- this row through the authenticated client, on two live paths:
--
--   • lib/events.ts:95 fetchUserEvents — a PostgREST EMBED
--     `event_members → events:event_id (event_id, public_id, event_type,
--      display_name, event_date, is_primary, archived, venue_name,
--      venue_address, monogram_*, concierge_status)`; called WITHOUT a
--      member_type filter by app/dashboard/(account)/library/_data/editorials.ts
--   • app/_components/account-switcher/get-switcher-data.ts:139 — the event
--     switcher, which reads event_members for EVERY member_type and then
--     SELECTs a 12-column slice of events.
--
-- So "drop guests from event_member_can_read" would close the leak by breaking
-- the guest's own switcher and library. The column grant closes it without
-- touching a single row-visibility decision.
--
-- A grant is also STRICTLY STRONGER than re-scoping this one policy, because a
-- column privilege is checked BEFORE and INDEPENDENTLY of every policy. One
-- REVOKE closes the tokens against ALL THREE SELECT policies on the table at
-- once — event_member_can_read (guest), events_moderator_read (20261129003000),
-- community_member_can_read_events (20270808218211, which hands the FULL row to
-- every member of the owning Samahan) — plus every future one, plus PostgREST
-- embeds from all 152 tables with an FK to events, plus `select=*`.
--
-- It also closes the two BLIND-SEARCH oracles a row policy leaves wide open:
-- Postgres requires SELECT privilege on any column named in a WHERE or ORDER BY,
-- so `?master_qr_token=like.a*` and `?order=master_qr_token` now fail too. A
-- policy re-scope would not have touched those.
--
-- This is the read-side twin of 20271005100000 (PR #3715), same mechanism, same
-- table: Postgres cannot subtract a column from a table-level grant, so the
-- table-level privilege is revoked and an explicit column list granted back.
-- The allow-list is COMPUTED at apply time as "every column MINUS the deny-set"
-- — never hand-enumerated.
--
-- ── HOW THE DENY-SET WAS DERIVED ────────────────────────────────────────────
-- A column is denied ONLY IF no authenticated-client READ path in apps/web
-- selects it. Every `.from('events')` call site (287 of them) was extracted and
-- its Supabase client resolved to service-role vs cookie-scoped:
--
--   master_qr_token                       → 1 authenticated reader,
--       app/dashboard/[eventId]/event-qr/page.tsx:48. Moved to the service-role
--       client with an EXPLICIT host check in the same commit as this file.
--       The rotate action (event-qr/actions.ts:54) is untouched — it UPDATEs
--       and RETURNs only (event_id, master_qr_token_rotated_at), so it never
--       needed SELECT on the token.
--   photo_delivery_oauth_token_encrypted  → ZERO readers outside service-role
--       (lib/secrets/reencrypt.ts:181 and app/admin/users/actions.ts, both admin).
--   photo_delivery_oauth_expires_at       → ZERO readers anywhere.
--
-- ── WHAT IS DELIBERATELY *NOT* DENIED (and therefore still guest-readable) ──
-- Columns a guest should not see but the COUPLE reads with the authenticated
-- client, so a role-level grant cannot close them without breaking the product:
--   partner_a/b_birth_date, partner_a/b_birth_time, bazi_birthdata_consent_at
--       (app/dashboard/[eventId]/details/page.tsx:68)
--   estimated_budget_centavos, budget_band  (details/page.tsx, checklist-actions.ts:200)
--   wizard_state                            (wizard-actions.ts:235)
--   photo_delivery_folder_id / _folder_name / _account_email
--       (studio/photo-delivery/page.tsx:58 — the couple's Google account email)
-- Those need the ROW-level fix (a guest-scoped narrow surface + re-scoping
-- event_member_can_read off current_event_ids). Reported as follow-up; it is a
-- different change with a different blast radius, and it is NOT what leaks a
-- credential.
--
-- ── WHAT IS UNAFFECTED ──────────────────────────────────────────────────────
--   • service_role and postgres: untouched. Every admin-console read of events
--     already goes through the service-role client — there is no is_admin()
--     arm in ANY SELECT policy on this table, so admins were never reading it
--     as `authenticated` in the first place.
--   • The public guest site: app/[slug]/** reads events through
--     createAdminClient() with explicit column lists (loaders.ts:103). It never
--     depended on this grant or on RLS. RSVP, hub, seat, find-my-table, print,
--     recap, welcome, invite, venue, live-wall, redeem — all service-role.
--   • The UPDATE/INSERT grants from 20271005100000 and 20271006100000: REVOKE
--     SELECT does not touch them.
--   • Views: the four views over events are owned by postgres with
--     security_invoker=false, so they run as owner. Verified: none of them
--     projects a denied column (vendor_completed_events exposes 6 columns —
--     vendor_profile_id, vendor_id, event_id, event_type, event_date,
--     completed_at).
--   • SECURITY DEFINER RPCs: verified zero functions in public reference
--     master_qr_token or photo_delivery_oauth* in their body.
--   • Realtime: events is NOT in the supabase_realtime publication.
--   • RLS policy expressions reference only event_id / community_id, both of
--     which stay granted.
--
-- ── ONE KNOWN BEHAVIOUR CHANGE ──────────────────────────────────────────────
-- Three dashboard reads carry a `select('*')` FALLBACK that fires only when the
-- lean select returns 42703/undefined_column (schema drift):
--   app/dashboard/[eventId]/layout.tsx:190, page.tsx:114,
--   _components/event-dashboard.tsx:228.
-- After this migration that fallback raises 42501 instead of returning a row.
-- All three already funnel a null row into notFound(), so the drift case
-- degrades to a 404 rather than a crash — and it only reaches that branch when
-- the schema is ALREADY broken. Left as-is deliberately: rewriting three hot
-- files to fix a path that cannot run on a healthy schema is the larger risk.
--
-- REVERSIBLE: `GRANT SELECT ON public.events TO authenticated, anon;`
-- restores the previous state exactly.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- ── DENIED: withheld from authenticated + anon ────────────────────────────
  locked_select_columns TEXT[] := ARRAY[
    -- ▸ The event master QR token. 32 hex chars of pairing credential. Scanning
    --   it POSTs to /api/crew/register-device (route.ts:159 resolves the event
    --   BY this value) and registers a capture device against the event. A
    --   guest holding it can burn the host's 5-device-per-vendor cap and pair
    --   rogue capture devices. The host is TOLD to treat it as a secret —
    --   event-qr/actions.ts:10 exists precisely to rotate it "when a crew
    --   device leaks the QR".
    'master_qr_token',

    -- ▸ The Google Drive OAuth token (encrypted at rest by lib/encryption.ts,
    --   decryptable by anything that also holds the app key). Already denied
    --   for WRITE by 20271005100000; this closes the READ half. Named in that
    --   migration's own CRITICAL_LOCKED list as "a Google Drive OAuth token
    --   living on the host's own writable row" — it was living on the host's
    --   own GUEST-READABLE row too.
    'photo_delivery_oauth_token_encrypted',
    'photo_delivery_oauth_expires_at'
  ];
  allowed TEXT;
  missing TEXT[];
BEGIN
  -- 1. Fail loudly on a typo. A misspelled entry would deny nothing and the
  --    migration would "pass" vacuously.
  SELECT array_agg(c) INTO missing
  FROM unnest(locked_select_columns) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'locked_select_columns names non-existent events column(s): %',
      array_to_string(missing, ', ');
  END IF;

  -- 2. Compute the allow-list from the live catalog: everything MINUS the
  --    deny-set. Never hand-enumerated — hand-typing 189 columns is how a
  --    legitimate read gets silently broken.
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO allowed
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'events'
    AND column_name <> ALL (locked_select_columns);

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed allow-list is empty';
  END IF;

  -- 3. Table-level privilege must go first — Postgres cannot subtract a column
  --    from a table-level grant.
  EXECUTE 'REVOKE SELECT ON public.events FROM authenticated, anon';
  EXECUTE format('GRANT SELECT (%s) ON public.events TO authenticated, anon', allowed);

  -- 4. Restate service_role's full read explicitly. It already holds this in
  --    prod (Supabase default privileges), so this is a no-op there — but it
  --    makes the migration self-sufficient rather than assuming HOW service_role
  --    acquired its grant, and keeps the post-condition below meaningful on a
  --    freshly-built database.
  EXECUTE 'GRANT SELECT ON public.events TO service_role';
END $$;

-- ----------------------------------------------------------------------------
-- Post-conditions — assert against the REAL catalog, so a half-applied or
-- silently-ineffective grant fails the migration instead of shipping.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  c   TEXT;
BEGIN
  -- (a) every denied column must be UN-readable by authenticated AND anon
  FOREACH c IN ARRAY ARRAY[
    'master_qr_token',
    'photo_delivery_oauth_token_encrypted',
    'photo_delivery_oauth_expires_at'
  ] LOOP
    IF has_column_privilege('authenticated', 'public.events', c, 'SELECT')
       OR has_column_privilege('anon', 'public.events', c, 'SELECT') THEN
      bad := array_append(bad, 'still-readable:' || c);
    END IF;
  END LOOP;

  -- (b) the GUEST-VISIBLE surface must survive intact. These are the exact
  --     columns lib/events.ts fetchUserEvents embeds and the account switcher
  --     selects — the two paths a plain guest reads events through. If any of
  --     them lost SELECT, a guest's switcher and library go blank.
  FOREACH c IN ARRAY ARRAY[
    'event_id','public_id','event_type','display_name','event_date',
    'is_primary','archived','venue_name','venue_address',
    'monogram_text','monogram_color','monogram_frame_key','monogram_font_key',
    'monogram_style','monogram_custom_svg','monogram_uploaded_svg',
    'concierge_status','slug'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      bad := array_append(bad, 'lost-guest-read:' || c);
    END IF;
  END LOOP;

  -- (c) the COUPLE's own authenticated reads must survive. Deliberately
  --     includes the private-but-host-read columns this migration does NOT
  --     close, so an over-eager future edit that adds one to the deny-set
  --     fails here instead of breaking the details page in production.
  FOREACH c IN ARRAY ARRAY[
    'partner_a_birth_date','partner_a_birth_time','partner_b_birth_date',
    'partner_b_birth_time','bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band','wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email','photo_delivery_status',
    'master_qr_token_rotated_at','event_date_precision','cleared_at',
    'landing_page_visibility','scheduled_launch_at','updated_at'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      bad := array_append(bad, 'lost-host-read:' || c);
    END IF;
  END LOOP;

  -- (d) service_role must be entirely unaffected — it is now the ONLY way to
  --     read the tokens, so this assert is load-bearing for crew registration,
  --     the Drive pipeline and the admin console.
  IF NOT has_table_privilege('service_role', 'public.events', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.events',
                                 'master_qr_token', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.events',
                                 'photo_delivery_oauth_token_encrypted', 'SELECT') THEN
    bad := array_append(bad, 'service_role-lost-select');
  END IF;

  -- (e) the write grants from 20271005100000 / 20271006100000 must be intact —
  --     REVOKE SELECT must not have collaterally disturbed UPDATE/INSERT.
  IF NOT has_column_privilege('authenticated', 'public.events', 'display_name', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.events', 'master_qr_token', 'UPDATE') THEN
    bad := array_append(bad, 'write-grants-disturbed');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'events column-SELECT post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;

COMMENT ON COLUMN public.events.master_qr_token IS
  'Crew-pairing credential (32 hex chars). Resolved by /api/crew/register-device. '
  'NOT readable by authenticated/anon since 20271007100000 — read it with the '
  'service-role client only. UNIQUE per 20271005100000. Still host-WRITABLE '
  '(the rotate action), which is why the unique index exists.';

COMMENT ON COLUMN public.events.photo_delivery_oauth_token_encrypted IS
  'Google Drive OAuth token, encrypted by lib/encryption.ts. Neither readable '
  'nor writable by authenticated/anon (SELECT denied 20271007100000, '
  'UPDATE/INSERT denied 20271005100000). service-role only.';

COMMIT;

-- ============================================================================
-- ⚠ MAINTENANCE NOTE FOR FUTURE MIGRATIONS
--
-- The allow-list is a snapshot taken at apply time — the same trap
-- 20271005100000 documents for writes, and 20271006100000 already had to pay.
-- A column added to public.events AFTER this migration is NOT SELECT-granted to
-- authenticated/anon. That is fail-CLOSED (safe) but LOUDER than the write
-- trap: the read fails with 42501 instead of silently writing nothing.
--
-- Every `ALTER TABLE public.events ADD COLUMN` from here on must also carry:
--     GRANT SELECT (new_col) ON public.events TO authenticated, anon;
--     GRANT UPDATE (new_col), INSERT (new_col) ON public.events TO authenticated;
-- (the second line is 20271005100000's requirement; both are needed).
--
-- apps/web/lib/security/events-column-select-privileges.test.ts fails with that
-- exact instruction when a column is neither granted nor deliberately denied,
-- so this cannot rot silently.
-- ============================================================================
