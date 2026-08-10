-- papic_board_server_path_fix
--
-- 🚨 THE GUEST BOARD HAS NEVER BEEN BUILT. Every Papic challenge Setnayan
-- supplies — the 40 errands and all 20 story questions — has been unreachable
-- by any guest, and nothing anywhere said so.
--
-- ── WHAT HAPPENS TODAY ─────────────────────────────────────────────────────
-- `app/api/papic/guest-missions/route.ts` calls ensure_papic_board through the
-- SERVICE-ROLE admin client, because a Papic guest is the zero-account model —
-- there is no auth.uid() to present, only a validated session cookie. Its own
-- comment states the belief this rests on:
--
--     "auth.uid() IS NULL → the couple/coordinator/admin gate is bypassed for
--      the server"
--
-- That was true when it was written. On **2026-08-01** migration
-- `20271030569442` hardened ensure_papic_auto_missions with, verbatim:
--
--     "⚠ THE FIX (2026-08-01): a missing session is now a REFUSAL, not a bypass."
--       IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized …'
--
-- ensure_papic_board's FIRST act is `PERFORM ensure_papic_auto_missions(...)`.
-- So the nested call raises, the whole board transaction aborts, and the route's
-- `.catch(() => 0)` + the wrapper's `if (error) return 0` swallow it. The v4
-- reader then FAIL-SOFTS to "no board → show every active mission by
-- created_at", which is a plausible-looking list, so nothing looks broken.
--
-- REPRODUCED against the full replayed prod schema: with auth.uid() NULL,
-- `SELECT ensure_papic_board(<event>, false)` raises 'not authorized to generate
-- missions', and the event is left with **0 setnayan missions and 0 board
-- slots**. Not inferred from reading — run.
--
-- Consequences, all silent:
--   • no library challenge (errand OR story) is ever offered to a guest;
--   • no booth mission is generated for a booked vendor — the § 3 commercial
--     core;
--   • the § 9.4 hero ranking and the 20-slot cap never apply;
--   • a guest sees ONLY what the couple typed by hand.
-- Prod shows 0 papic_missions across 0 events, so no wedding has been harmed —
-- this is pre-launch. It would have failed on the first real one.
--
-- ── WHY THE FIX IS NOT "LET A NULL SESSION THROUGH AGAIN" ───────────────────
-- That would REVERSE a deliberate security fix. The 2026-08-01 hardening is
-- correct and stays correct at every PUBLIC entry point.
--
-- 🔑 THE REAL DEFECT IS WHERE THE CHECK LIVES. ensure_papic_auto_missions is
-- both a public RPC *and* an internal step of another SECURITY DEFINER
-- function. Putting the authorization inside the shared step means the caller's
-- own — already-passed, deliberately different — gate gets re-litigated under
-- rules written for a different caller. An entry point authorizes; a step does
-- the work. So: split them.
--
--   ensure_papic_auto_missions(p_event_id)            PUBLIC  — keeps the
--       2026-08-01 guard, byte-for-byte, then delegates.
--   papic_generate_booth_missions_unchecked(p_event_id) INTERNAL — the body, no
--       auth, EXECUTE revoked from anon + authenticated so it is reachable only
--       from inside a SECURITY DEFINER function that has already authorized.
--
-- ensure_papic_board keeps ITS OWN guard (couple / coordinator / admin, or a
-- NULL uid meaning the trusted server) and then calls the unchecked step. That
-- guard is the one that matters here, and it is unchanged by this migration.
-- ⚠ ensure_papic_board is NOT granted to anon — verified below and asserted in
-- the db test — so "NULL uid" can only be our own server, never a browser.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

-- ── 1) The internal step: the shipped body, verbatim, minus the auth block ──
CREATE OR REPLACE FUNCTION public.papic_generate_booth_missions_unchecked(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- ⛔ NO AUTHORIZATION HERE, BY DESIGN. Every caller must have authorized
  -- already. EXECUTE is revoked from anon + authenticated below, so the only
  -- way in is from another SECURITY DEFINER function in this schema.
  --
  -- Serialize concurrent generation for this event so the NOT EXISTS check is race-safe.
  PERFORM pg_advisory_xact_lock(hashtext('papic_auto_missions:' || p_event_id::text));

  INSERT INTO public.papic_missions (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  SELECT ev.event_id,
         'vendor_booth',
         'auto',
         ev.vendor_id,
         -- left(...,256) caps the prompt at 15+256+8 = 279 <= the papic_missions
         -- length(prompt) <= 280 CHECK, so one pathological/uncapped vendor_name
         -- (event_vendors.vendor_name is unbounded TEXT) can't abort the whole batch.
         'Get a photo at ' || left(ev.vendor_name, 256) || '''s booth',
         true,
         true
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')  -- "booked" (§3.3)
    AND NOT EXISTS (
      SELECT 1 FROM public.papic_missions m
      WHERE m.vendor_id = ev.vendor_id
        AND m.source = 'auto'
        AND m.mission_type = 'vendor_booth'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_generate_booth_missions_unchecked(UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.papic_generate_booth_missions_unchecked(UUID) IS
  'INTERNAL booth-mission generator — NO authorization check. Callable only from inside a SECURITY DEFINER function that has already authorized (EXECUTE revoked from anon + authenticated). Public entry point: ensure_papic_auto_missions.';

-- ── 2) The public RPC keeps its 2026-08-01 guard and delegates ─────────────
CREATE OR REPLACE FUNCTION public.ensure_papic_auto_missions(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ⚠ THE FIX (2026-08-01): a missing session is now a REFUSAL, not a bypass.
  -- UNCHANGED. This is the public door; it stays shut to a sessionless caller.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized to generate missions for event %', p_event_id;
  END IF;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.event_members em
       WHERE em.event_id = p_event_id
         AND em.user_id = auth.uid()
         AND em.member_type IN ('couple', 'coordinator')
     ) THEN
    RAISE EXCEPTION 'not authorized to generate missions for event %', p_event_id;
  END IF;

  RETURN public.papic_generate_booth_missions_unchecked(p_event_id);
END;
$$;

-- ── 3) The board builder calls the STEP, not the public door ───────────────
-- Only the PERFORM line changes. ensure_papic_board's own guard — couple /
-- coordinator / admin, or a NULL uid meaning the trusted server — is reproduced
-- here untouched, and it remains the authorization for this path.
CREATE OR REPLACE FUNCTION public.ensure_papic_board(
  p_event_id      UUID,
  p_pabati_active BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_used INTEGER;
  v_vendor_used INTEGER;
  v_target      INTEGER;
  v_slotted     INTEGER;
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

  -- ⬇ THE ONE-LINE FIX. Was ensure_papic_auto_missions(...), whose 2026-08-01
  -- NULL-session refusal aborted this whole function on the guest path — the
  -- only path that ever calls it — leaving every event with no board at all.
  -- We have authorized above; call the step, not the public door.
  PERFORM public.papic_generate_booth_missions_unchecked(p_event_id);

  -- Lane sizes. Caps: couple 10, vendor 5. Setnayan backfills the remainder to 20.
  SELECT LEAST(COUNT(*), 10) INTO v_couple_used
  FROM public.papic_missions m
  WHERE m.event_id = p_event_id AND m.source = 'couple' AND m.is_active AND m.approved;

  SELECT LEAST(COUNT(*), 5) INTO v_vendor_used
  FROM public.papic_missions m
  WHERE m.event_id = p_event_id AND m.source IN ('vendor','auto') AND m.is_active AND m.approved
    AND m.vendor_id IN (
      SELECT ev.vendor_id FROM public.event_vendors ev
      WHERE ev.event_id = p_event_id
        AND ev.status IN ('contracted','deposit_paid','delivered','complete')
    );

  v_target := 20 - v_couple_used - v_vendor_used;  -- structurally ≥ 5 → Top-5 always fits.

  -- Materialize the Setnayan fills: top-ranked library items NOT taken by a couple pick, NOT vetoed
  -- (an inactive setnayan tombstone), Pabati only if the SKU is active. Idempotent via the partial
  -- unique. Existing active setnayan rows conflict → DO NOTHING (kept, never re-created).
  IF v_target > 0 THEN
    INSERT INTO public.papic_missions
      (event_id, mission_type, source, prompt, library_id, capture_kind, approved, is_active)
    SELECT src.event_id, src.mission_type, 'setnayan', src.prompt, src.library_id, src.capture_kind, true, true
    FROM (
      SELECT p_event_id AS event_id, l.mission_type, l.prompt, l.library_id, l.capture_kind
      FROM public.papic_challenge_library l
      WHERE l.is_active
        AND l.mission_type <> 'face_verified'
        AND (l.capture_kind <> 'pabati' OR p_pabati_active)
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
    -- setnayan lane: by priority_rank then library order; exclude Pabati-if-inactive and couple-taken.
    SELECT m.mission_id, 2 AS lane,
           row_number() OVER (ORDER BY l.priority_rank NULLS LAST, l.library_id) AS lane_rank
    FROM public.papic_missions m
    JOIN public.papic_challenge_library l ON l.library_id = m.library_id
    WHERE m.event_id = p_event_id AND m.source = 'setnayan' AND m.is_active AND m.approved
      AND l.is_active
      AND (l.capture_kind <> 'pabati' OR p_pabati_active)
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
$$;

-- Signatures unchanged → existing grants survive CREATE OR REPLACE. Restated so
-- this migration is self-sufficient on a fresh database, and so the anon
-- exclusion is visible at the place it matters rather than inferred.
REVOKE ALL ON FUNCTION public.ensure_papic_board(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_papic_board(UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.ensure_papic_auto_missions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_papic_auto_missions(UUID) TO authenticated;

COMMENT ON FUNCTION public.ensure_papic_board(UUID, BOOLEAN) IS
  'Materializes + ranks the §9 20-slot challenge board. Authorizes the event couple/coordinator, an admin, or the trusted server (NULL uid; never anon — EXECUTE is not granted to anon). 2026-08-10: now calls papic_generate_booth_missions_unchecked instead of the public ensure_papic_auto_missions, whose NULL-session refusal (added 2026-08-01) had been aborting every guest-path board build since.';

COMMIT;
