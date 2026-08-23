-- retire_pabati
--
-- ─── WHAT THIS IS ──────────────────────────────────────────────────────────
-- Owner, 2026-08-21: "we do not need pabati. retire it because it is part of
-- papic."
--
-- This SUPERSEDES the change made HOURS EARLIER the same afternoon, which made
-- Pabati FREE on his earlier instruction. Free was the right answer to the
-- question asked then; retire is the answer to the question asked after it.
--
-- 🚨 FREE AND RETIRED ARE THE SAME CATALOG ROW AND OPPOSITE PRODUCTS, so a
-- retirement takes TWO halves exactly as a free-ing does — and in the mirror
-- direction. Deactivating the row alone is what you want when the product is
-- gone; leaving the FREE_FOR_ALL_SKUS entry behind would keep asserting that a
-- feature whose surface, API, table and RPCs are deleted is switched on for
-- everybody. Both halves ship in this PR: the app half removes the entry, this
-- file takes the row, the objects and the bundle memberships.
--
-- ─── WHY IT IS SAFE — MEASURED IN PROD, NOT ASSUMED (2026-08-23) ───────────
--   greetings ever recorded                      0   (pabati_clips)
--   times it was ever bought                     0   (orders)
--   challenge-library rows of kind 'pabati'      1   of 631
--   library rows that already ask for a clip   284   (47 in the greeting category)
--   drive_copy_artifacts rows of type 'pabati'   0
--
-- 🔑 THE CAPABILITY DOES NOT DIE WITH THE PRODUCT. Library row 5 (slug
-- 'pabati', "Leave the newlyweds a video greeting") becomes an ordinary clip,
-- so the guest is still asked for the greeting — they just record it the way
-- they record everything else in Papic. Papic's own clip recorder already does
-- that job 284 times over.
--
-- ⚠ A CATALOG ROW IN PROD IS NOT WHAT THE MERGED MIGRATION SAYS. Checked by
-- query, not by schema_migrations: PABATI is ALREADY is_active = false in
-- production, because the free-ing migration eventually applied. The statement
-- below is therefore expected to be a no-op, and it is kept anyway — a
-- migration that only works when a previous one landed is not idempotent.

BEGIN;

-- ── 1 · THE GREETING SURVIVES THE SKU ──────────────────────────────────────
-- Convert before narrowing the CHECK, or the constraint refuses its own table.
UPDATE public.papic_challenge_library
   SET capture_kind = 'clip'
 WHERE capture_kind = 'pabati';

ALTER TABLE public.papic_challenge_library
  DROP CONSTRAINT IF EXISTS papic_challenge_library_capture_kind_check;
ALTER TABLE public.papic_challenge_library
  ADD  CONSTRAINT papic_challenge_library_capture_kind_check
  CHECK (capture_kind = ANY (ARRAY['photo'::text, 'clip'::text]));

COMMENT ON COLUMN public.papic_challenge_library.capture_kind IS
  'What the guest has to capture: photo or clip. A third kind, ''pabati'', '
  'existed until 2026-08-21 for one row gated on the since-retired Pabati SKU; '
  'that row is a clip now and the kind is gone from the CHECK, so a later seed '
  'cannot reintroduce a per-row entitlement gate.';

-- ── 2 · THE BOARD BUILDER LOSES ITS PABATI GATE ────────────────────────────
-- ⚠ THE ARGUMENT LIST CHANGES, WHICH IS NOT A COSMETIC EDIT. PostgREST resolves
-- an RPC by its EXACT set of NAMED arguments, so the app's .rpc() call had to
-- change in the same PR — a call naming p_pabati_active against the new
-- function matches NO candidate and is REFUSED, not thrown, and the only
-- symptom would be a board that silently never materializes.
--
-- DROP-then-CREATE rather than CREATE OR REPLACE: Postgres cannot change a
-- function's parameter list in place, and leaving the two-arg version beside a
-- one-arg version makes ensure_papic_board(uuid) ambiguous ("function is not
-- unique") because the old second parameter has a DEFAULT.
DROP FUNCTION IF EXISTS public.ensure_papic_board(uuid, boolean);

CREATE OR REPLACE FUNCTION public.ensure_papic_board(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_couple_used INTEGER;
  v_vendor_used INTEGER;
  v_target      INTEGER;
  v_slotted     INTEGER;
  v_event_type  TEXT;
BEGIN
  -- Auth: the event's couple or coordinator, an admin, or service_role (server).
  -- NOT anon.
  --
  -- ⚠ The single-line form of this comment failed the secret scan. gitleaks'
  -- generic-api-key rule read the slash-joined role list as one high-entropy
  -- token and reported a leak at this line — in a COMMENT, with no credential
  -- anywhere near it. Split rather than suppressed: an inline `gitleaks:allow`
  -- would silence the rule here permanently, and a suppression marker on a line
  -- that never held a secret is a marker nobody can later evaluate.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.event_members em
       WHERE em.event_id = p_event_id AND em.user_id = auth.uid()
         AND em.member_type IN ('couple','coordinator')
     ) THEN
    RAISE EXCEPTION 'not authorized to build the Papic board for event %', p_event_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('papic_board:' || p_event_id::text));

  -- Was ensure_papic_auto_missions(...), whose 2026-08-01 NULL-session refusal
  -- aborted this whole function on the guest path — the only path that ever
  -- calls it — leaving every event with no board at all. We have authorized
  -- above; call the step, not the public door.
  PERFORM public.papic_generate_booth_missions_unchecked(p_event_id);

  -- What kind of celebration is this? Read once; both lanes use it.
  SELECT e.event_type INTO v_event_type
  FROM public.events e WHERE e.event_id = p_event_id;

  -- ── LANE SIZES — THE COUPLE'S CEILING IS THE WHOLE BOARD MINUS WHAT IS SOLD
  -- Owner, 2026-08-21: "the need to have a real screen to pick their challenges
  -- UP TO 20 CHALLENGES." The couple lane was capped at 10, so a couple who
  -- chose twenty got ten, silently, with the other ten queued behind a wall
  -- they were never shown.
  --
  -- ⚠ THE VENDOR LANE IS MEASURED FIRST, AND THAT IS DELIBERATE. A booth
  -- mission is something a supplier PAID for. If the couple's cap were flat,
  -- the arithmetic would go NEGATIVE the moment one existed and the slot
  -- allocator would try to place more rows than there are seats. Worse than the
  -- maths: a paid placement would vanish the moment the couple added one more
  -- of their own, with nothing anywhere saying so.
  SELECT LEAST(COUNT(*), 2) INTO v_vendor_used
  FROM public.papic_missions m
  WHERE m.event_id = p_event_id AND m.source IN ('vendor','auto') AND m.is_active AND m.approved
    AND m.vendor_id IN (
      SELECT ev.vendor_id FROM public.event_vendors ev
      WHERE ev.event_id = p_event_id
        AND ev.status IN ('contracted','deposit_paid','delivered','complete')
    );

  SELECT LEAST(COUNT(*), 10 - v_vendor_used) INTO v_couple_used
  FROM public.papic_missions m
  WHERE m.event_id = p_event_id AND m.source = 'couple' AND m.is_active AND m.approved;

  -- >= 0 by construction, never negative. It CAN be zero — a couple who picks
  -- the whole board gets exactly their own choices, which is the point of the
  -- screen.
  v_target := 10 - v_couple_used - v_vendor_used;

  -- Materialize the Setnayan fills: top-ranked library items NOT taken by a
  -- couple pick, NOT vetoed (an inactive setnayan tombstone), and only rows
  -- whose scope admits this event type. Idempotent via the partial unique.
  -- Existing active setnayan rows conflict -> DO NOTHING (kept, never
  -- re-created).
  --
  -- 🔑 THE `capture_kind <> 'pabati' OR p_pabati_active` CLAUSE IS GONE FROM
  -- HERE AND FROM THE SLOT QUERY BELOW. That was the only per-row entitlement
  -- gate in the library, and it is what made a greeting a paid thing.
  IF v_target > 0 THEN
    INSERT INTO public.papic_missions
      (event_id, mission_type, source, prompt, library_id, capture_kind, approved, is_active)
    SELECT src.event_id, src.mission_type, 'setnayan', src.prompt, src.library_id, src.capture_kind, true, true
    FROM (
      SELECT p_event_id AS event_id, l.mission_type, l.prompt, l.library_id, l.capture_kind
      FROM public.papic_challenge_library l
      WHERE l.is_active
        AND l.mission_type <> 'face_verified'
        AND (l.event_types IS NULL OR v_event_type = ANY (l.event_types))
        AND NOT EXISTS (  -- taken by a couple pick
          SELECT 1 FROM public.papic_missions cm
          WHERE cm.event_id = p_event_id AND cm.source = 'couple'
            AND cm.is_active AND cm.approved AND cm.library_id = l.library_id)
        AND NOT EXISTS (  -- vetoed tombstone (couple hid this hero)
          SELECT 1 FROM public.papic_missions vm
          WHERE vm.event_id = p_event_id AND vm.source = 'setnayan'
            AND vm.library_id = l.library_id AND NOT vm.is_active)
      ORDER BY l.priority_rank NULLS LAST, l.library_id
      LIMIT v_target
    ) src
    ON CONFLICT (event_id, library_id) WHERE source = 'setnayan' DO NOTHING;
  END IF;

  -- Reset the board, then reassign board_slot deterministically across the three lanes.
  UPDATE public.papic_missions
    SET board_slot = NULL, updated_at = NOW()
  WHERE event_id = p_event_id AND board_slot IS NOT NULL;

  WITH cand AS (
    -- couple lane (slots first): active/approved couple rows by created_at, id.
    SELECT m.mission_id, 0 AS lane,
           row_number() OVER (ORDER BY m.created_at, m.id) AS lane_rank
    FROM public.papic_missions m
    WHERE m.event_id = p_event_id AND m.source = 'couple' AND m.is_active AND m.approved
    UNION ALL
    -- vendor lane: PAID (source='vendor', approved) before FREE booth (source='auto'); booked vendors only.
    SELECT m.mission_id, 1 AS lane,
           row_number() OVER (
             ORDER BY CASE WHEN m.source = 'vendor' THEN 0 ELSE 1 END, m.created_at, m.id
           ) AS lane_rank
    FROM public.papic_missions m
    WHERE m.event_id = p_event_id AND m.source IN ('vendor','auto') AND m.is_active AND m.approved
      AND m.vendor_id IN (
        SELECT ev.vendor_id FROM public.event_vendors ev
        WHERE ev.event_id = p_event_id
          AND ev.status IN ('contracted','deposit_paid','delivered','complete'))
    UNION ALL
    -- setnayan lane: by priority_rank then library order; exclude couple-taken,
    -- and anything whose scope does not admit this event type.
    SELECT m.mission_id, 2 AS lane,
           row_number() OVER (ORDER BY l.priority_rank NULLS LAST, l.library_id) AS lane_rank
    FROM public.papic_missions m
    JOIN public.papic_challenge_library l ON l.library_id = m.library_id
    WHERE m.event_id = p_event_id AND m.source = 'setnayan' AND m.is_active AND m.approved
      AND l.is_active
      AND (l.event_types IS NULL OR v_event_type = ANY (l.event_types))
      AND NOT EXISTS (  -- dedup: a couple pick of the same library item wins the slot
        SELECT 1 FROM public.papic_missions cm
        WHERE cm.event_id = p_event_id AND cm.source = 'couple'
          AND cm.is_active AND cm.approved AND cm.library_id = m.library_id)
  ),
  capped AS (
    SELECT mission_id, lane, lane_rank FROM cand
    WHERE (lane = 0 AND lane_rank <= v_couple_used)
       OR (lane = 1 AND lane_rank <= v_vendor_used)
       OR (lane = 2 AND lane_rank <= v_target)
  ),
  slotted AS (
    SELECT mission_id, row_number() OVER (ORDER BY lane, lane_rank) AS slot
    FROM capped
  )
  UPDATE public.papic_missions m
    SET board_slot = s.slot, updated_at = NOW()
  FROM slotted s
  WHERE m.mission_id = s.mission_id;

  GET DIAGNOSTICS v_slotted = ROW_COUNT;
  RETURN v_slotted;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_papic_board(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3 · THE PABATI OBJECTS ─────────────────────────────────────────────────
-- 🔒 pabati_record_clip was granted EXECUTE to `anon` — an anonymous WRITE path
-- into a table this migration is deleting. Dropping the function closes that
-- grant with it; both lines come out of the anon-RPC baseline in this PR,
-- because a baseline line for a function nobody can call reads as considered
-- when the surface is simply gone.
DROP FUNCTION IF EXISTS public.pabati_record_clip(uuid, uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.pabati_event_owns_pabati(uuid);

-- The empty table follows the LED-backdrop precedent (migration 20271132121622,
-- which dropped its two empty tables when that product was removed). Its
-- policies and its FKs to events/guests go with it.
DROP TABLE IF EXISTS public.pabati_clips;

-- ── 4 · THE SKU IS OFF SALE ────────────────────────────────────────────────
-- Already false in prod; stated anyway so this file does not depend on another
-- one having landed. The FREE_FOR_ALL_SKUS half is in lib/entitlements.ts.
UPDATE public.platform_retail_catalog_v2
   SET is_active = false, updated_at = NOW()
 WHERE service_code = 'PABATI' AND is_active IS DISTINCT FROM false;

-- ── 5 · IT IS NOT IN ANY BUNDLE ────────────────────────────────────────────
-- A bundle cannot include a thing that no longer exists. Re-seeded in full
-- rather than patched, because `apps/web/scripts/lint-entitlement-gates.mjs`
-- guard 2 reads the LATEST migration carrying this statement and compares its
-- tuples against the two app-side mirrors — a DELETE is invisible to a parser
-- that reads INSERT tuples. This file is that mirror from now on.
--
-- Scoped to the bundles it names: a blanket delete would silently drop any
-- bundle a later migration introduces.
DELETE FROM public.bundle_components
 WHERE bundle_sku_code IN ('GUIDED_PACK', 'MEDIA_PACK', 'PAPIC_UNLOCK');

INSERT INTO public.bundle_components (bundle_sku_code, component_service_code)
VALUES
  ('GUIDED_PACK', 'SETNAYAN_AI'),
  ('GUIDED_PACK', 'ANIMATED_MONOGRAM'),
  ('GUIDED_PACK', 'CUSTOM_QR_GUEST'),
  ('GUIDED_PACK', 'PRO_RSVP'),
  ('GUIDED_PACK', 'PAPIC_GUEST'),
  ('GUIDED_PACK', 'EVENT_WEBSITE'),
  ('GUIDED_PACK', 'PRO_WEBSITE'),
  ('MEDIA_PACK', 'SETNAYAN_AI'),
  ('MEDIA_PACK', 'ANIMATED_MONOGRAM'),
  ('MEDIA_PACK', 'CUSTOM_QR_GUEST'),
  ('MEDIA_PACK', 'PRO_RSVP'),
  ('MEDIA_PACK', 'EVENT_WEBSITE'),
  ('MEDIA_PACK', 'PRO_WEBSITE'),
  ('MEDIA_PACK', 'PAPIC_GUEST'),
  ('MEDIA_PACK', 'PAPIC_ADDON_STORIES'),
  ('MEDIA_PACK', 'PAPIC_SEATS'),
  ('MEDIA_PACK', 'CAMERA_BRIDGE'),
  ('MEDIA_PACK', 'PAPIC_ADDON_THANK_YOU'),
  ('MEDIA_PACK', 'LIVE_WALL'),
  ('MEDIA_PACK', 'PANOOD_SYSTEM'),
  ('MEDIA_PACK', 'PAKANTA'),
  ('PAPIC_UNLOCK', 'KWENTO'),
  ('PAPIC_UNLOCK', 'LIVE_WALL'),
  ('PAPIC_UNLOCK', 'PAPIC_ADDON_THANK_YOU'),
  ('PAPIC_UNLOCK', 'PAPIC_ADDON_STORIES'),
  ('PAPIC_UNLOCK', 'CAMERA_BRIDGE'),
  ('PAPIC_UNLOCK', 'PAPIC_GUEST')
ON CONFLICT DO NOTHING;

-- ── 6 · THE DRIVE COPY LOSES AN ARTIFACT TYPE ──────────────────────────────
-- The couple's permanent Drive copy carried six artifact types; the Pabati one
-- was produced by the route this PR deletes. Prod holds ZERO rows of it, so
-- narrowing the CHECK cannot orphan anything, and code and database keep saying
-- the same thing.
ALTER TABLE public.drive_copy_artifacts
  DROP CONSTRAINT IF EXISTS drive_copy_artifacts_artifact_type_check;
ALTER TABLE public.drive_copy_artifacts
  ADD  CONSTRAINT drive_copy_artifacts_artifact_type_check
  CHECK (artifact_type = ANY (ARRAY['papic'::text, 'patiktok'::text, 'pakanta'::text, 'monogram'::text, 'qr_codes'::text]));

COMMIT;

-- ── VERIFY (against prod after deploy — the OBJECT, never schema_migrations) ─
-- SELECT to_regclass('public.pabati_clips')                                   AS table_gone_if_null,
--        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname='public' AND p.proname LIKE 'pabati\_%')            AS pabati_fns,
--        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname='public' AND p.proname='ensure_papic_board')        AS board_fns,
--        (SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p
--           JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname='public' AND p.proname='ensure_papic_board')        AS board_args,
--        (SELECT capture_kind FROM public.papic_challenge_library WHERE slug='pabati') AS greeting_kind,
--        (SELECT count(*) FROM public.bundle_components
--          WHERE component_service_code='PABATI')                             AS bundle_rows;
-- Expected: NULL · 0 · 1 · 'p_event_id uuid' · 'clip' · 0
