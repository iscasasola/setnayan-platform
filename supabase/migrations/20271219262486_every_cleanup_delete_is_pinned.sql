-- every_cleanup_delete_is_pinned
-- ============================================================================
-- A BROWSER MAY NO LONGER CHOOSE A STORAGE KEY THAT ONE OF OUR CLEANUP JOBS
-- WILL LATER DELETE. (Write side. The delete side is the application's
-- choke point, apps/web/lib/cleanup-delete-scope.ts — both halves ship together.)
--
-- ── THE CLASS ──────────────────────────────────────────────────────────────
-- "THE ROW IS YOURS, THE FIELD IS NOT" + AN UNPINNED SERVICE-ROLE DELETE.
-- A non-admin writes `r2://<bucket>/<key>` into a column of a row they own; a
-- job running with the ADMIN client later deletes whatever that string names,
-- with no check that the object belongs to that row. Buckets are not
-- versioned. PR #5401 (migration 20271218766967) closed one instance. A review
-- that EXECUTED every claim found three more — all read here out of the live
-- catalog (information_schema.column_privileges / role_table_grants /
-- pg_policies / pg_trigger on production, 2026-09-10), not from migrations:
--
--   1 · papic_photos — `authenticated` holds column UPDATE on r2_object_key,
--       display_r2_key, poster_r2_key, thumb_r2_key, wall_safe_r2_key and
--       clip_web_r2_key; papic_photos_couple_update / _claimer_update constrain
--       only ownership; papic_photos_pin_moderation_state pins only
--       moderation_state. A couple PATCHes their OWN photo's key to any bucket's
--       key; once the event ages past its clock `runFullResDropSweep` (ON by
--       default, admin client, no admin step) deletes the target.
--   2 · vendor_papic_captures — TABLE-level INSERT and UPDATE to anon and
--       authenticated; vendor_papic_captures_vendor_insert's WITH CHECK
--       constrains only event_id and vendor_profile_id; the update policy only
--       ownership; tg_pin_vendor_capture_verdict pins only nsfw_checked /
--       hidden_at. Same sweep, same result.
--   3 · vendor_verification_applications — `authenticated` holds column INSERT
--       and UPDATE on doc_uploads and status; owner_update_draft lets a vendor
--       PATCH its own draft and move it to pending_review; the table has NO
--       trigger. #5401 left it unpinned believing refs were "tenancy-pinned at
--       WRITE time by SEC-1" — that pin lives ONLY in the server action. After
--       any admin approve OR reject, the 90-day identity sweep deleted whatever
--       the slot named: another shop's seven-year DTI permit, a stranger's logo.
--
-- ── THE TOOL, PER COLUMN — chosen by what the LEGITIMATE code must name ─────
--   papic_photos  r2_object_key · display_r2_key · poster_r2_key ·
--                 thumb_r2_key · wall_safe_r2_key
--       → REVOKE UPDATE. Grepped every writer: the only one is the SERVICE ROLE
--         (the recording RPC, lib/papic-derivatives.ts, the face-blur bake). No
--         RLS client names these columns. The grants are COLUMN-level on this
--         table (the exposure baseline reads `tpriv papic_photos|authenticated SD`
--         — no table-level U), so a column revoke is what actually removes them.
--   papic_photos  clip_web_r2_key
--       → KEPT, and held by a RESTRICTIVE UPDATE policy. `persistSeatClipWebCopy`
--         (app/papic/actions.ts) legitimately writes it through the claimer's own
--         session; the policy requires it to sit under the row's own
--         `papic/event-<event_id>/` folder, which is where the seat presign files
--         every web copy.
--   vendor_papic_captures  every key column
--       → RESTRICTIVE INSERT + UPDATE policies. The supplier route inserts
--         r2_object_key and poster_r2_key through the supplier's OWN session (the
--         insert policy is its booking gate), so the column cannot be revoked —
--         and the grants are TABLE-level, so a column revoke would be INERT
--         anyway. Every key must sit under `papic/vendor-<vendor>/event-<event>/`
--         (or its `derivatives/` mirror), which is exactly what the route mints.
--   vendor_verification_applications  doc_uploads
--       → RESTRICTIVE INSERT + UPDATE policies. The intake writes doc_uploads
--         through the vendor's own session (app/vendor-dashboard/verify/actions.ts,
--         …/shop/inline-docs-actions.ts), so it cannot be revoked. Every string
--         anywhere in the JSON that LOOKS LIKE a storage ref — padded, BOM-led or
--         upper-cased included (§ 4 says exactly what that means) — must be a
--         canonical ref under the vendor's OWN folder in one of the two places
--         the intake's own gate accepts:
--           r2://setnayan-vendor-verification/vendors/<vendor>/verification/…
--           r2://setnayan-media/vendors/<vendor>/…
--         The reviewer's point stands and is kept: a legitimate slot CAN live in
--         the public media bucket, so this pins by TENANT, not by bucket.
--
-- ⚠ WHY RESTRICTIVE, AND WHY IT IS SAFE ON LIVE UPLOAD TABLES:
--   • Policies are OR-ed — adding a PERMISSIVE policy would WIDEN. A RESTRICTIVE
--     one is AND-ed with the permissive set, so it can only narrow.
--   • It binds only the session roles named — `authenticated`, plus `anon` on
--     vendor_papic_captures, the one table where anon holds the grant (a policy
--     naming a verb its role was never granted is dead text, and
--     a-samahan-lives-while-one-stays.db.test.ts fails on it). service_role bypasses RLS, so the
--     derivative writer, the NSFW screen, the sweeps and the recording RPC are
--     untouched — which is also why the two server actions validate the same
--     folder themselves (recordSeatCapture's key reaches the table through the
--     service role).
--   • Measured 2026-09-10: every existing row already satisfies it — papic_photos
--     14/14 on every key column; vendor_papic_captures 0 rows;
--     vendor_verification_applications 1 row, whose doc_uploads holds no ref at
--     all. So no existing row becomes un-updatable.
--
-- ── WHAT IS DELIBERATELY NOT HERE (named, and pinned on the DELETE side) ────
--   • events site-media columns (hero image/film, site music, our_photos) —
--     `authenticated` holds column UPDATE on them; narrowing `events`, the most
--     central table, is its own change. "Remove for good" now refuses any of
--     those refs outside `events/<event_id>/`.
--   • guest_face_enrollments.asset_url — couple_writes_face_enrollment is FOR
--     ALL. Every face-data delete now refuses a ref outside the enrollment's own
--     `events/<event>/guest-selfies/<guest>/` folder.
--   • papic_guest_captures — table-level grants, but NO non-admin write policy
--     (only papic_guest_captures_admin_all), so no browser path exists today.
--
-- ⚠ HONEST LIMIT: the production `BEGIN…ROLLBACK` rehearsal of this migration
-- could NOT be run from the session that wrote it — production was reachable
-- READ-ONLY (catalog SELECTs only). It was exercised in the PGlite replay as a
-- real `authenticated` session (tests/db/every-cleanup-delete-is-pinned.db.test.ts)
-- and every post-condition below re-asserts itself on apply.
--
-- REVERSIBLE (do not): GRANT UPDATE (…) back and DROP the five policies.
-- ============================================================================

BEGIN;

-- ── 1 · papic_photos — take back UPDATE on the keys no session writes ───────
REVOKE UPDATE (r2_object_key, display_r2_key, poster_r2_key, thumb_r2_key, wall_safe_r2_key)
  ON public.papic_photos FROM authenticated, anon;

-- ── 2 · papic_photos — the one session-written key stays in its event ───────
DROP POLICY IF EXISTS papic_photos_keys_stay_in_their_event ON public.papic_photos;
CREATE POLICY papic_photos_keys_stay_in_their_event
  ON public.papic_photos
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    clip_web_r2_key IS NULL
    OR (
      starts_with(clip_web_r2_key, 'r2://setnayan-media/papic/event-' || event_id::text || '/')
      AND clip_web_r2_key !~ '(^|/)\.{1,2}(/|$)'
    )
  );

-- ── 3 · vendor_papic_captures — every key stays in the supplier's own folder ──
DROP POLICY IF EXISTS vendor_papic_captures_keys_stay_in_their_folder_insert ON public.vendor_papic_captures;
CREATE POLICY vendor_papic_captures_keys_stay_in_their_folder_insert
  ON public.vendor_papic_captures
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[r2_object_key, poster_r2_key, display_r2_key, thumb_r2_key, tile_r2_key]) AS k(ref)
      WHERE k.ref IS NOT NULL
        AND NOT (
          (
            starts_with(k.ref, 'r2://setnayan-media/papic/vendor-' || vendor_profile_id::text
                               || '/event-' || event_id::text || '/')
            OR starts_with(k.ref, 'r2://setnayan-media/derivatives/papic/vendor-' || vendor_profile_id::text
                                  || '/event-' || event_id::text || '/')
          )
          AND k.ref !~ '(^|/)\.{1,2}(/|$)'
        )
    )
  );

DROP POLICY IF EXISTS vendor_papic_captures_keys_stay_in_their_folder_update ON public.vendor_papic_captures;
CREATE POLICY vendor_papic_captures_keys_stay_in_their_folder_update
  ON public.vendor_papic_captures
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[r2_object_key, poster_r2_key, display_r2_key, thumb_r2_key, tile_r2_key]) AS k(ref)
      WHERE k.ref IS NOT NULL
        AND NOT (
          (
            starts_with(k.ref, 'r2://setnayan-media/papic/vendor-' || vendor_profile_id::text
                               || '/event-' || event_id::text || '/')
            OR starts_with(k.ref, 'r2://setnayan-media/derivatives/papic/vendor-' || vendor_profile_id::text
                                  || '/event-' || event_id::text || '/')
          )
          AND k.ref !~ '(^|/)\.{1,2}(/|$)'
        )
    )
  );

-- ── 4 · vendor_verification_applications — every ref in doc_uploads is the vendor's own ──
-- `strict $.**` walks the whole document (the slot union has array members — a
-- known-key read would miss every portfolio sample).
--
-- ⚠ AN ALLOW-LIST, NOT A DENY-LIST (corrected before release, review of #5414).
-- The first cut refused only strings that BEGAN `r2://`, so a foreign ref behind
-- a leading space / tab / newline / NBSP / BOM, or spelled `R2://`, was
-- ACCEPTED — and the shipped readers normalise exactly those away:
-- parseStoredAsset, parseClientRef and planCleanupDelete all JS-`trim()` (which
-- strips every one of those characters) before testing the scheme, and
-- referenceCandidateForms (lib/verification-docs.ts) also lower-cases it. So a
-- string any reader would resolve to an object sailed past the pin.
--
-- The rule is now: a string LOOKS LIKE A STORAGE REF when, after every leading
-- character that is not an ASCII letter or digit is stripped (a strict superset
-- of what `trim()` removes — whitespace, NBSP, BOM, line separators, and also
-- zero-width and control characters no reader strips) and it is lower-cased, it
-- begins `r2:`. EVERY such string must then be EXACTLY canonical — the raw
-- value, untrimmed and case-sensitive, starting with one of the vendor's own two
-- prefixes, with no `.`/`..` segment. Legitimate writers store `encodeR2Ref`
-- output (`r2://<bucket>/<key>`, lower-case, no padding), so they are unaffected;
-- a legacy `https://` URL, a date, a referee's name or a social link does not
-- look like a ref and is left alone, as before.
DROP POLICY IF EXISTS vendor_verification_applications_refs_are_own_insert ON public.vendor_verification_applications;
CREATE POLICY vendor_verification_applications_refs_are_own_insert
  ON public.vendor_verification_applications
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM jsonb_path_query(COALESCE(doc_uploads, '{}'::jsonb), 'strict $.**') AS d(node)
      WHERE jsonb_typeof(d.node) = 'string'
        AND starts_with(lower(regexp_replace(d.node #>> '{}', '^[^0-9A-Za-z]+', '')), 'r2:')
        AND NOT (
          (
            starts_with(d.node #>> '{}', 'r2://setnayan-vendor-verification/vendors/'
                                         || vendor_profile_id::text || '/verification/')
            OR starts_with(d.node #>> '{}', 'r2://setnayan-media/vendors/' || vendor_profile_id::text || '/')
          )
          AND (d.node #>> '{}') !~ '(^|/)\.{1,2}(/|$)'
        )
    )
  );

DROP POLICY IF EXISTS vendor_verification_applications_refs_are_own_update ON public.vendor_verification_applications;
CREATE POLICY vendor_verification_applications_refs_are_own_update
  ON public.vendor_verification_applications
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM jsonb_path_query(COALESCE(doc_uploads, '{}'::jsonb), 'strict $.**') AS d(node)
      WHERE jsonb_typeof(d.node) = 'string'
        AND starts_with(lower(regexp_replace(d.node #>> '{}', '^[^0-9A-Za-z]+', '')), 'r2:')
        AND NOT (
          (
            starts_with(d.node #>> '{}', 'r2://setnayan-vendor-verification/vendors/'
                                         || vendor_profile_id::text || '/verification/')
            OR starts_with(d.node #>> '{}', 'r2://setnayan-media/vendors/' || vendor_profile_id::text || '/')
          )
          AND (d.node #>> '{}') !~ '(^|/)\.{1,2}(/|$)'
        )
    )
  );

COMMIT;

-- ----------------------------------------------------------------------------
-- Post-conditions. Asserted per COLUMN with has_column_privilege, which answers
-- for a table-level grant too — has_table_privilege reads FALSE while column
-- grants stand, so it cannot verify this revoke.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  r   TEXT;
  c   TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    FOREACH c IN ARRAY ARRAY['r2_object_key', 'display_r2_key', 'poster_r2_key', 'thumb_r2_key', 'wall_safe_r2_key'] LOOP
      IF has_column_privilege(r, 'public.papic_photos', c, 'UPDATE') THEN
        bad := array_append(bad, format('%s still holds UPDATE on papic_photos.%s', r, c));
      END IF;
    END LOOP;
  END LOOP;

  FOREACH c IN ARRAY ARRAY[
    'papic_photos|papic_photos_keys_stay_in_their_event',
    'vendor_papic_captures|vendor_papic_captures_keys_stay_in_their_folder_insert',
    'vendor_papic_captures|vendor_papic_captures_keys_stay_in_their_folder_update',
    'vendor_verification_applications|vendor_verification_applications_refs_are_own_insert',
    'vendor_verification_applications|vendor_verification_applications_refs_are_own_update'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename  = split_part(c, '|', 1)
        AND policyname = split_part(c, '|', 2)
        AND permissive = 'RESTRICTIVE'
    ) THEN
      bad := array_append(bad, format('missing RESTRICTIVE policy %s', c));
    END IF;
  END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'every_cleanup_delete_is_pinned post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;
