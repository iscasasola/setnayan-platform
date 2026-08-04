-- events_column_update_privileges
-- ============================================================================
-- SECURITY HARDENING — column-level UPDATE/INSERT privileges on public.events.
--
-- ── THE HOLE (the general class, not one instance) ──────────────────────────
-- `couple_can_update_event` (20260512000000:254, re-created 20260513040000:90)
-- is `FOR UPDATE TO authenticated USING (event_id IN current_couple_event_ids()
-- OR is_admin())`. Postgres RLS is ROW-level, NEVER column-level. The anon key
-- is public and PostgREST is reachable directly, so an authenticated HOST can
--
--     PATCH /rest/v1/events?event_id=eq.<their-own-event>
--     { "<any column at all>": <any value> }
--
-- and every server action, zod schema, and entitlement check in apps/web is
-- bypassed. `authenticated_can_create_event` (same migration, WITH CHECK (TRUE))
-- exposes the identical surface at INSERT time — which is why this migration
-- constrains INSERT as well as UPDATE (an UPDATE-only fix is trivially defeated
-- by POSTing a fresh event with the flag already set; see the INSERT-vector
-- discussion in 20270920020000).
--
-- Verified on prod before writing this file: `authenticated` AND `anon` both
-- held UPDATE on ALL 191 columns of public.events.
--
-- This is the same root cause called out for vendor_profiles in
-- 20271002456914 and 20271004444950 ("...there is no column-scoped GRANT — so a
-- column that the guard does not NAME is writable"). Those were fixed one
-- column at a time with trigger guards. events already carries FOUR such
-- one-off guards — guard_pax_finalize_columns_trg (20261214000000),
-- events_papic_caps_admin_only (20270821110200), trg_guard_events_ai_entitlement
-- (20270920020000), and the anon-only RESTRICTIVE policies (20270823141500) —
-- and each of them left sibling columns uncovered (papic_cost_cap_php is not in
-- the caps guard; setnayan_ai_active_until / _intro_used are not in the AI
-- guard). This migration replaces the whack-a-mole with a structural control.
--
-- ── THE MECHANISM ───────────────────────────────────────────────────────────
-- RLS still governs WHICH ROWS. The grant governs WHICH COLUMNS. Postgres does
-- not allow subtracting a column from a table-level grant, so the table-level
-- privilege is revoked first and an explicit column list is granted back.
--
-- The allow-list is COMPUTED at apply time as "every column of public.events
-- MINUS the deny-set below". It is deliberately NOT hard-coded: hand-enumerating
-- 191 columns is how a legitimate host edit gets silently broken. Only columns
-- named in LOCKED_COLUMNS lose writability; every other column — including ones
-- this audit never looked at — keeps exactly the access it has today.
--
-- ── WHAT IS UNAFFECTED ──────────────────────────────────────────────────────
--   • service_role and postgres: untouched (the paid-activation path
--     lib/sku-activation.ts, lib/supabase/admin.ts, and every admin console
--     writer keep full UPDATE/INSERT).
--   • SECURITY DEFINER RPCs: run as their owner (postgres). The only function
--     that UPDATEs events is public.vendor_claim_locked_qr (SECURITY DEFINER,
--     owner postgres) — unaffected.
--   • Trigger-set columns: Postgres checks column privileges against the
--     columns NAMED IN THE STATEMENT, not columns a BEFORE trigger assigns. The
--     updated_at / pax-revert / papic-caps triggers keep working.
--   • Reads: SELECT is not touched. `.update({...}).select('slug')` still works.
--
-- ── HOW THE DENY-SET WAS DERIVED ────────────────────────────────────────────
-- Every `.from('events').update|insert|upsert(` call site in apps/web (227 of
-- them) was extracted and its Supabase client resolved to service-role vs
-- authenticated. A column is in LOCKED_COLUMNS ONLY IF no authenticated-client
-- write path touches it AND a concrete exploit exists. Columns that are
-- sensitive but legitimately host-written (estimated_pax, master_qr_token,
-- panood_watch_url, website_open_browse, std_reveal_template, site_bg_music_*)
-- are deliberately NOT locked here — see the PR body for those.
--
-- REVERSIBLE: `GRANT UPDATE, INSERT ON public.events TO authenticated, anon;`
-- restores the previous state exactly.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- ── LOCKED: withheld from authenticated + anon ────────────────────────────
  locked_columns TEXT[] := ARRAY[
    -- ▸ Paid entitlement / paywall. A forged value = a free paid feature.
    'kwento_free_grandfathered',   -- lib/kwento-access.ts:29 returns TRUE and
                                   -- SKIPS eventSkuActive(KWENTO) entirely.
                                   -- One boolean = the whole paid SKU, free.
    'setnayan_ai_active',          -- belt over trg_guard_events_ai_entitlement.
    'setnayan_ai_active_until',    -- lib/setnayan-ai.ts:157 — NULL/unparseable
                                   -- => "permanent unlock". Not in the AI guard.
    'setnayan_ai_intro_used',      -- intro-price re-arm; sibling of the above.

    -- ▸ Money integrity. Belt over the two existing (partial) trigger guards.
    'papic_cost_cap_php',          -- NOT covered by events_papic_caps_admin_only.
    'papic_ltd_cap_php',
    'papic_unli_cap_php',
    'papic_mini_cap_php',
    'adaptive_pricing_mode',       -- suppresses vendor surcharge proposals.
    'guest_count_locked_at',       -- binding-count lock; the pax guard only
    'final_pax',                   -- REVERTS these, it does not raise.
    'cleared_at',                  -- settlement markers.
    'cleared_by_user_id',

    -- ▸ Trust / curation. Admin-only columns living on a host-writable row.
    'is_sample',                   -- lib/showcase-db.ts:225 admits samples to
                                   -- /realstories BYPASSING the consent + grace
                                   -- gates, and into sitemap-weddings.xml.
                                   -- Self-service placement on the marketing
                                   -- shelf with no admin curation.
    'showcase_featured_at',        -- app/admin/real-stories/actions.ts only.
    'showcase_feature_rank',       -- with is_sample => self-service top billing.

    -- ▸ Privacy / consent / biometrics (RA 10173).
    'papic_face_mode',             -- lib/papic-face-mode.ts — 'mode_a' keeps a
                                   -- guest's 128-d face descriptor instead of
                                   -- hard-nulling it. DPIA-relevant, hence
                                   -- admin-only (service_role keeps UPDATE;
                                   -- app/admin/events/actions.ts is the one
                                   -- writer, added 2026-08-04).
                                   -- ⚠ CORRECTED 2026-08-04: this note used to
                                   -- read "for EVERY guest with no per-guest
                                   -- opt-in roster". That is FALSE and it kept
                                   -- the switch closed for weeks. Both enrolment
                                   -- writers ([slug]/actions.ts:192-208 and
                                   -- papic/face-enroll-actions.ts:36-44) require
                                   -- biometric_consent AND age_affirmation
                                   -- server-side, and the RSVP path also refuses
                                   -- any guest flagged face_recognition_excluded.
                                   -- No tick, no vector, in either mode.
    'bazi_birthdata_consent_at',   -- a consent RECORD for two partners' birth
                                   -- data; a subject's consent stamp must never
                                   -- be self-writable.
    'pool_gallery_open',           -- gallery exposure switch; the host path
    'live_media_public',           -- deliberately routes through service-role.

    -- ▸ Credentials + the delivery pipeline (all service-role written).
    'photo_delivery_oauth_token_encrypted',  -- a Google Drive OAuth token.
    'photo_delivery_oauth_expires_at',
    'photo_delivery_provider',
    'photo_delivery_folder_id',
    'photo_delivery_folder_name',
    'photo_delivery_account_email',
    'photo_delivery_status',
    'photo_delivery_progress_pct',
    'photo_delivery_started_at',
    'photo_delivery_completed_at',
    'photo_delivery_failed_count',
    'photo_delivery_sync_mode',
    'photos_released_at',                    -- releases originals to the couple.

    -- ▸ R2 key columns that are NOT host-written. lib/uploads.ts:53
    --   (displayUrlForStoredAsset) presigns any `r2://<bucket>/<key>` verbatim —
    --   it validates the BUCKET but never checks the key belongs to the event.
    --   Every key-bearing column is therefore a re-signing oracle. Most of them
    --   are legitimately host-written and stay grantable (see the PR body); these
    --   are written only by service-role paths, so they can be closed here.
    'pakanta_song_r2_key',         -- written only by app/admin/pakanta/actions.ts:95.
    'pakanta_song_status',         -- paid-deliverable bookkeeping (admin console).
    'pakanta_song_filename',
    'pakanta_song_delivered_at',
    'pakanta_song_adopted_as_site_music',
    'photo_wall_photos',           -- jsonb array of R2 refs rendered on the public
                                   -- editorial page; ZERO writers in apps/web.

    -- ▸ Cross-tenant read expander.
    'community_id',                -- community_member_can_read_events
                                   -- (20270808218211:207) grants FULL-ROW SELECT
                                   -- on events to every member of the pointed-at
                                   -- community. Pointing this at a community the
                                   -- host does not belong to hands that entire
                                   -- membership the event row (incl. master_qr_token
                                   -- and the Drive OAuth token). The organizer check
                                   -- at create-event/actions.ts:290 is PATCH-bypassable.
                                   -- Never written to events by app code.

    -- ▸ Live Studio (the Wave 3 hole, closed at the WRITE layer).
    'live_studio_roam_manifest',   -- the public multi-cam picker manifest. The
                                   -- read gate (loaders.ts:528 re-reduces via
                                   -- canPublishMultiCam) already neutralises a
                                   -- forged value; this removes the write too,
                                   -- so the paywall no longer depends on one
                                   -- render-time call being right forever.
                                   -- Written only by mirrorRoamManifest(admin).

    -- ▸ Identity / system. Never host-writable under any circumstance.
    'id',
    'event_id',
    'public_id',                   -- the canonical S89E- id (UNIQUE).
    'created_at'
  ];
  allowed TEXT;
  missing TEXT[];
BEGIN
  -- 1. Fail loudly on a typo. A misspelled entry would silently lock nothing
  --    and the migration would "pass" vacuously.
  SELECT array_agg(c) INTO missing
  FROM unnest(locked_columns) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'LOCKED_COLUMNS names non-existent events column(s): %',
      array_to_string(missing, ', ');
  END IF;

  -- 2. Compute the allow-list from the live catalog: everything MINUS the
  --    deny-set. Never hand-enumerated.
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO allowed
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'events'
    AND column_name <> ALL (locked_columns);

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed allow-list is empty';
  END IF;

  -- 3. Table-level privilege must go first — Postgres cannot subtract a column
  --    from a table-level grant.
  EXECUTE 'REVOKE UPDATE, INSERT ON public.events FROM authenticated, anon';
  EXECUTE format('GRANT UPDATE (%s) ON public.events TO authenticated, anon', allowed);
  EXECUTE format('GRANT INSERT (%s) ON public.events TO authenticated, anon', allowed);

  -- 4. Restate service_role's full access explicitly. It already holds this in
  --    prod (Supabase default privileges), so this is a no-op there — but it
  --    makes the migration self-sufficient rather than assuming HOW service_role
  --    acquired its grant, and it keeps the post-condition below meaningful on a
  --    freshly-built database where that grant has not been issued yet.
  EXECUTE 'GRANT UPDATE, INSERT ON public.events TO service_role';
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
  -- (a) every locked column must be UN-writable by authenticated AND anon
  FOREACH c IN ARRAY ARRAY[
    'kwento_free_grandfathered','setnayan_ai_active','setnayan_ai_active_until',
    'setnayan_ai_intro_used','papic_cost_cap_php','papic_ltd_cap_php',
    'papic_unli_cap_php','papic_mini_cap_php','adaptive_pricing_mode',
    'guest_count_locked_at','final_pax','cleared_at','cleared_by_user_id',
    'is_sample','showcase_featured_at','showcase_feature_rank','papic_face_mode',
    'bazi_birthdata_consent_at','pool_gallery_open','live_media_public',
    'photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at',
    'photo_delivery_provider','photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email','photo_delivery_status','photo_delivery_progress_pct',
    'photo_delivery_started_at','photo_delivery_completed_at','photo_delivery_failed_count',
    'photo_delivery_sync_mode','photos_released_at','live_studio_roam_manifest',
    'pakanta_song_r2_key','pakanta_song_status','pakanta_song_filename',
    'pakanta_song_delivered_at','pakanta_song_adopted_as_site_music',
    'photo_wall_photos','community_id',
    'id','event_id','public_id','created_at'
  ] LOOP
    IF has_column_privilege('authenticated', 'public.events', c, 'UPDATE')
       OR has_column_privilege('anon', 'public.events', c, 'UPDATE')
       OR has_column_privilege('authenticated', 'public.events', c, 'INSERT')
       OR has_column_privilege('anon', 'public.events', c, 'INSERT') THEN
      bad := array_append(bad, 'still-writable:' || c);
    END IF;
  END LOOP;

  -- (b) a representative slice of the HOST-EDITABLE set must still be writable.
  --     These are the columns real server actions write with the authenticated
  --     client; if any of them lost UPDATE the app is broken.
  FOREACH c IN ARRAY ARRAY[
    'display_name','event_date','venue_name','venue_address','slug',
    'landing_page_visibility','std_launched_at','scheduled_launch_at',
    'std_reveal_template','std_theme','std_reveal_effects','std_background','std_media',
    'site_bg_music_r2_key','site_bg_music_enabled','site_bg_music_source',
    'landing_page_hero_image_url','landing_page_hero_video_r2_key',
    'monogram_text','monogram_color','monogram_custom_svg','monogram_studio_config',
    'love_story','our_photos','special_message','what_to_bring','role_palette',
    'wizard_state','estimated_pax','estimated_budget_centavos','region',
    'master_qr_token','master_qr_token_rotated_at','panood_watch_url',
    'website_open_browse','live_studio_guest_pick_enabled','wax_seal_config',
    'dress_code_config','photo_moments_config','site_bg_color','site_button_color',
    'updated_at','archived','is_primary','timezone'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'UPDATE') THEN
      bad := array_append(bad, 'lost-host-write:' || c);
    END IF;
  END LOOP;

  -- (c) service_role must be entirely unaffected.
  IF NOT has_table_privilege('service_role', 'public.events', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.events',
                                 'live_studio_roam_manifest', 'UPDATE') THEN
    bad := array_append(bad, 'service_role-lost-update');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'events column-privilege post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Adjacent fix — events.master_qr_token cross-event collision.
--
-- master_qr_token IS legitimately host-writable (the rotate action,
-- app/dashboard/[eventId]/event-qr/actions.ts:55, uses the AUTHENTICATED
-- client), so a grant cannot close it. But it had NO unique index while
-- app/api/crew/register-device/route.ts:159 resolves an event by
-- `.eq('master_qr_token', token).maybeSingle()` — a host who reads a victim's
-- event QR (it is shown to crew by design) could PATCH their OWN token to the
-- same value, making .maybeSingle() return "multiple rows" and breaking the
-- VICTIM's crew device registration with a 500 until they rotate. Cross-tenant
-- denial of service; same shape as the Wave 4 zone→seat FK bug.
--
-- The constraint makes the collision impossible at the DB layer while leaving
-- legitimate rotation working. Verified 0 duplicates on prod before shipping.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS events_master_qr_token_key
  ON public.events (master_qr_token);

COMMENT ON INDEX public.events_master_qr_token_key IS
  'Prevents a host from pointing their own event''s master_qr_token at another '
  'event''s value (the token is host-writable via the rotate action). Without '
  'it, a duplicate breaks the victim''s crew device-registration lookup '
  '(app/api/crew/register-device/route.ts, .maybeSingle()).';

COMMIT;

-- ============================================================================
-- ⚠ MAINTENANCE NOTE FOR FUTURE MIGRATIONS
--
-- The allow-list is a snapshot taken at apply time. A column added to
-- public.events AFTER this migration is NOT granted to authenticated/anon and
-- will therefore be service-role-writable only. That is fail-CLOSED (safe), but
-- it WILL surprise you if the new column is meant to be host-editable.
--
-- If a new host-editable column is added, add to the same migration:
--     GRANT UPDATE (new_col), INSERT (new_col) ON public.events
--       TO authenticated, anon;
--
-- apps/web/lib/security/events-column-privileges.test.ts fails with that exact
-- instruction when a column in the schema is neither granted nor deliberately
-- locked, so this cannot rot silently.
-- ============================================================================
