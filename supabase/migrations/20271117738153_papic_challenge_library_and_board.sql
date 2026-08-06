-- Papic Challenges §9 — 40-challenge library + 20-slot 3-lane board (PR-A, atomic DB PR).
-- Spec: ~/Documents/Claude/Projects/Setnayan/0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md §9
-- Council verdict: ~/Documents/Claude/Projects/Setnayan/0012_papic/Papic_Games_Build_Council_Verdict_2026-07-23.md
--
-- Ships DARK behind NEXT_PUBLIC_PAPIC_GAMES_V1 (gated at the call sites in later PRs). The reader v4
-- is FAIL-SOFT: until a board is materialized (later PRs wire ensure_papic_board into the routes) it
-- returns the v3 behaviour (all active/approved missions by created_at), so this migration is safe to
-- land alone even though the flag is LIVE in prod.
--
-- Load-bearing council findings honoured here:
--   • papic_mission_completions.mission_id is ON DELETE CASCADE (20270832487160:67) → the board is
--     MATERIALIZE-ONCE, NEVER-DELETE. De-selection = board_slot NULL, never a row delete.
--   • `source` is a CHECK constraint (not a pg enum) → additive superset rebuild, honours never-rename.
--   • papic_guest_missions has a fixed RETURNS TABLE → widen via DROP+CREATE (not CREATE OR REPLACE),
--     re-GRANT to authenticated,anon, carry the v3 fail-closed target_role guard.
--   • Pabati availability (eventSkuActive = a 6-source TS entitlement engine) is NOT replicated in SQL;
--     it is passed as p_pabati_active, computed SERVER-SIDE by the trusted (non-anon) caller. Fail-closed.
--   • §2.2 minor-safety: couple/vendor FREE-TEXT is an RLS-direct insert → guarded by a DB trigger,
--     not TS alone. (Owner 2026-07-23: ship with the blocklist, residual accepted.)

BEGIN;

-- ============================================================================
-- 1) papic_challenge_library — the 40 canonical Setnayan-supplied challenges.
--    Global seed rows (NOT 40×N per-event copies): papic_missions.event_id is
--    NOT NULL ON DELETE CASCADE, and a catalog makes the PROVISIONAL §9.4 rank a
--    10-row UPDATE, not a mass per-event rewrite. Read via the board reader, so
--    SELECT is granted to authenticated only (guests never read the catalog).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.papic_challenge_library (
  library_id    SMALLINT PRIMARY KEY CHECK (library_id BETWEEN 1 AND 40),
  slug          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL,
  title         TEXT NOT NULL,
  prompt        TEXT NOT NULL CHECK (length(prompt) BETWEEN 1 AND 280),
  capture_kind  TEXT NOT NULL CHECK (capture_kind IN ('photo','clip','pabati')),
  mission_type  TEXT NOT NULL CHECK (mission_type IN
                  ('prompt','roster','video_greeting','toast_or_dance','vendor_booth','face_verified')),
  -- §9.4 Top-10 Must-Capture rank (1..10). NULL = not a guaranteed hero. ⚠ PROVISIONAL — owner
  -- ranking pending; a reorder is a 10-row UPDATE of this column, no machinery change.
  priority_rank SMALLINT UNIQUE CHECK (priority_rank BETWEEN 1 AND 10),
  is_active     BOOLEAN NOT NULL DEFAULT true
);
COMMENT ON TABLE public.papic_challenge_library IS
  'Papic Challenges §9.2: the 40 generic Setnayan-supplied wedding challenges (category-level, never a named vendor). priority_rank 1..10 = the §9.4 Top-10 Must-Capture (⚠ PROVISIONAL). Read via ensure_papic_board / papic_guest_missions.';

ALTER TABLE public.papic_challenge_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS papic_challenge_library_read ON public.papic_challenge_library;
CREATE POLICY papic_challenge_library_read ON public.papic_challenge_library
  FOR SELECT TO authenticated USING (true);
-- Writes are migration/admin-only (no INSERT/UPDATE/DELETE policy for authenticated).

-- The 40 seed rows (idempotent). capture_kind: 25 photo / 14 clip / 1 pabati.
-- "Drink" is deliberately "Toast — any drink counts" (§2.2 minor-safety, no age gate).
-- No face_verified rows (gated on the dormant NEXT_PUBLIC_FACE_MODEL_URL).
-- priority_rank seeds the PROVISIONAL §9.4 Top-10: Top-5 = Steal a Dance(1), Grand Finale(2), Pabati(3),
-- Kiss Cam(4), Tunnel Run(5); 6-10 = Confetti(6), Blessing Cam(7), Group Boogie(8), Parents' Hug(9),
-- Photo Booth Run(10). ⚠ reorder = UPDATE these 10 rows only.
INSERT INTO public.papic_challenge_library
  (library_id, slug, category, title, prompt, capture_kind, mission_type, priority_rank)
VALUES
  (1,  'steal-a-dance',    'couple_family',   'Steal a Dance',     'Sneak onto the floor and dance with the bride or groom. Now. Go.',              'clip',   'prompt',          1),
  (2,  'kiss-cam',         'couple_family',   'Kiss Cam',          'Catch the newlyweds mid-kiss.',                                                 'photo',  'prompt',          4),
  (3,  'twin-the-couple',  'couple_family',   'Twin the Couple',   'Recreate their signature pose. Full commitment.',                               'photo',  'prompt',          NULL),
  (4,  'blessing-cam',     'couple_family',   'Blessing Cam',      'Five seconds to camera: your wish for them.',                                   'clip',   'prompt',          7),
  (5,  'pabati',           'couple_family',   'Pabati',            'Leave the newlyweds a video greeting.',                                         'pabati', 'video_greeting',  3),
  (6,  'parents-hug',      'couple_family',   'Parents'' Hug',     'A photo with one of the couple''s parents.',                                    'photo',  'prompt',          9),
  (7,  'entourage-selfie', 'couple_family',   'Entourage Selfie',  'Grab a shot with a bridesmaid or groomsman.',                                   'photo',  'prompt',          NULL),
  (8,  'toast-at-the-bar', 'food_drinks',     'Toast at the Bar',  'Raise a glass at the drinks station. Any drink counts. Clink!',                 'photo',  'toast_or_dance',  NULL),
  (9,  'signature-drink',  'food_drinks',     'Signature Drink',   'Order the couple''s signature cocktail or mocktail and show it off.',            'photo',  'prompt',          NULL),
  (10, 'sweet-tooth',      'food_drinks',     'Sweet Tooth',       'Raid the dessert table and flaunt your haul.',                                  'photo',  'prompt',          NULL),
  (11, 'cake-watch',       'food_drinks',     'Cake Watch',        'Get the wedding cake in frame before it''s gone.',                              'photo',  'prompt',          NULL),
  (12, 'catch-the-cart',   'food_drinks',     'Catch the Cart',    'Ice cream, coffee, fishball, cotton candy — catch a cart in action.',           'clip',   'prompt',          NULL),
  (13, 'grazing-table',    'food_drinks',     'Grazing Table',     'Strike a pose at the grazing or appetizer spread.',                             'photo',  'prompt',          NULL),
  (14, 'food-trip',        'food_drinks',     'Food Trip',         'Snap the best-looking plate of the night.',                                     'photo',  'prompt',          NULL),
  (15, 'tunnel-run',       'band_dance',      'Tunnel Run',        'Dance your way through the grand entrance or send-off tunnel.',                  'clip',   'prompt',          5),
  (16, 'bust-a-move',      'band_dance',      'Bust a Move',       'Your best move, on the floor, no warning.',                                     'clip',   'prompt',          NULL),
  (17, 'dance-off',        'band_dance',      'Dance-Off',         'Challenge someone to a 10-second dance battle.',                                'clip',   'toast_or_dance',  NULL),
  (18, 'group-boogie',     'band_dance',      'Group Boogie',      'Get 5+ people dancing in one frame.',                                           'photo',  'prompt',          8),
  (19, 'request-a-song',   'band_dance',      'Request a Song',    'Shout your request at the band or DJ.',                                         'clip',   'prompt',          NULL),
  (20, 'serenade',         'band_dance',      'Serenade',          'Sing one line of the couple''s song.',                                          'clip',   'prompt',          NULL),
  (21, 'conga-line',       'band_dance',      'Conga Line',        'Start one. Do not stop.',                                                       'clip',   'prompt',          NULL),
  (22, 'photo-booth-run',  'decor_booth',     'Photo Booth Run',   'Hit the photo booth or photo wall and grab a shot.',                            'photo',  'prompt',          10),
  (23, 'backdrop-star',    'decor_booth',     'Backdrop Star',     'Pose at the main backdrop or arch.',                                            'photo',  'prompt',          NULL),
  (24, 'bloom-check',      'decor_booth',     'Bloom Check',       'Find the prettiest florals in the room.',                                       'photo',  'prompt',          NULL),
  (25, 'under-the-lights', 'decor_booth',     'Under the Lights',  'Catch the LED wall, fairy lights, or dance-floor glow.',                        'clip',   'prompt',          NULL),
  (26, 'table-art',        'decor_booth',     'Table Art',         'Show off your table''s centerpiece and styling.',                               'photo',  'prompt',          NULL),
  (27, 'aisle-moment',     'decor_booth',     'Aisle Moment',      'A photo at the ceremony aisle, altar, or arch.',                                'photo',  'prompt',          NULL),
  (28, 'new-friend',       'meet_room',       'New Friend',        'Meet a total stranger. Selfie. Instant friend.',                                'photo',  'roster',          NULL),
  (29, 'table-squad',      'meet_room',       'Table Squad',       'Everyone at your table, one shot.',                                             'photo',  'roster',          NULL),
  (30, 'both-sides',       'meet_room',       'Both Sides',        'A photo with one guest from each family side, together.',                       'photo',  'roster',          NULL),
  (31, 'generation-gap',   'meet_room',       'Generation Gap',    'The oldest and youngest at your table.',                                        'photo',  'roster',          NULL),
  (32, 'runway-moment',    'fashion_candids', 'Runway Moment',     'Best runway walk, then pose. Show the fit.',                                    'clip',   'prompt',          NULL),
  (33, 'best-dressed',     'fashion_candids', 'Best Dressed',      'Hunt down the sharpest-dressed guest here.',                                    'photo',  'prompt',          NULL),
  (34, 'accessory-game',   'fashion_candids', 'Accessory Game',    'The boldest accessory in the room — hat, earrings, barong detail.',             'photo',  'prompt',          NULL),
  (35, 'the-big-laugh',    'fashion_candids', 'The Big Laugh',     'A real, unposed mid-laugh candid.',                                             'photo',  'prompt',          NULL),
  (36, 'photobomb',        'fashion_candids', 'Photobomb',         'Sneak into someone else''s shot.',                                              'photo',  'prompt',          NULL),
  (37, 'bouquet-catch',    'big_moments',     'Bouquet / Garter Catch', 'Catch the toss (or the scramble for it).',                                 'clip',   'prompt',          NULL),
  (38, 'confetti-moment',  'big_moments',     'Confetti Moment',   'The petal, bubble, sparkler, or confetti toss.',                                'clip',   'prompt',          6),
  (39, 'guestbook-signing','big_moments',     'Guestbook Signing', 'A photo leaving your message at the signing station.',                          'photo',  'prompt',          NULL),
  (40, 'grand-finale',     'big_moments',     'Grand Finale',      'The send-off or the last dance.',                                               'clip',   'prompt',          2)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2) Extend papic_missions (additive — never parallel-tabled, never rename).
-- ============================================================================
ALTER TABLE public.papic_missions
  ADD COLUMN IF NOT EXISTS library_id   SMALLINT REFERENCES public.papic_challenge_library(library_id),
  ADD COLUMN IF NOT EXISTS capture_kind TEXT,
  ADD COLUMN IF NOT EXISTS board_slot   SMALLINT;

-- Guarded constraints (idempotent: DROP IF EXISTS then ADD).
ALTER TABLE public.papic_missions DROP CONSTRAINT IF EXISTS papic_missions_capture_kind_check;
ALTER TABLE public.papic_missions
  ADD CONSTRAINT papic_missions_capture_kind_check
  CHECK (capture_kind IS NULL OR capture_kind IN ('photo','clip','pabati'));

ALTER TABLE public.papic_missions DROP CONSTRAINT IF EXISTS papic_missions_board_slot_check;
ALTER TABLE public.papic_missions
  ADD CONSTRAINT papic_missions_board_slot_check
  CHECK (board_slot IS NULL OR board_slot BETWEEN 1 AND 20);

-- source: additive superset rebuild ('auto','couple','vendor') → + 'setnayan'. It is an inline
-- column CHECK named papic_missions_source_check; all existing rows are a subset → widen is safe.
ALTER TABLE public.papic_missions DROP CONSTRAINT IF EXISTS papic_missions_source_check;
ALTER TABLE public.papic_missions
  ADD CONSTRAINT papic_missions_source_check
  CHECK (source IN ('auto','couple','vendor','setnayan'));

-- TWO source-scoped partial uniques (NOT a single cross-lane unique — that would 23505 when a couple
-- picks an already-materialized Setnayan hero and block curation). Couple + Setnayan can co-hold a
-- library_id; the duplicate resolves at board time (couple wins, Setnayan row falls off-board).
CREATE UNIQUE INDEX IF NOT EXISTS uq_papic_missions_setnayan_lib
  ON public.papic_missions (event_id, library_id)
  WHERE source = 'setnayan';
CREATE UNIQUE INDEX IF NOT EXISTS uq_papic_missions_couple_lib
  ON public.papic_missions (event_id, library_id)
  WHERE source = 'couple' AND library_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_papic_missions_board ON public.papic_missions (event_id, board_slot)
  WHERE board_slot IS NOT NULL;

-- ============================================================================
-- 3) events.papic_vendor_challenges_enabled — the couple "allow vendors" toggle
--    (§9.3 vendor lane on/off). Default ON preserves today's behaviour.
-- ============================================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_vendor_challenges_enabled BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- 4) §2.2 minor-safety guard — couple/vendor FREE-TEXT (library_id IS NULL) is an
--    RLS-direct insert (papic_missions member policy is FOR ALL TO authenticated),
--    so a couple can PostgREST past any app-layer guard. The blocklist holds at the
--    DB boundary. Library-linked picks (vetted prompts) and auto/setnayan rows skip it.
--    Defense-in-depth, NOT a complete solution (owner accepted the residual 2026-07-23).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.papic_missions_prompt_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source IN ('couple','vendor')
     AND NEW.library_id IS NULL
     AND NEW.prompt ~* '(\y(alcohol|tequila|vodka|whiskey|whisky|rum|gin|brandy|beer|liquor|shots?|chug|booze|drunk|strip)\y)|get\s+drunk|body\s+shot|down\s+your\s+drink|take\s+(it|them)\s+off|remove\s+your\s+(clothes|top|shirt)|kiss\s+a\s+stranger'
  THEN
    RAISE EXCEPTION 'This challenge can''t include drinking dares or unsafe prompts (Papic §2.2). Please reword it.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papic_missions_prompt_guard_trg ON public.papic_missions;
CREATE TRIGGER papic_missions_prompt_guard_trg
  BEFORE INSERT OR UPDATE OF prompt, source, library_id ON public.papic_missions
  FOR EACH ROW EXECUTE FUNCTION public.papic_missions_prompt_guard();

-- ============================================================================
-- 5) ensure_papic_board — materialize-once, deterministic 3-lane resolver.
--    Lanes: couple (≤10) + vendor (≤5) + Setnayan (backfills to 20). board_slot is
--    reset to NULL then reassigned each call; rows are NEVER deleted (the cascade
--    trap) so guest completions survive a reflow. Returns the number of live slots.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_papic_board(
  p_event_id      UUID,
  p_pabati_active BOOLEAN DEFAULT false  -- server-computed (eventPabatiActive); fail-closed when absent
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

  -- Reuse: materialize FREE booth missions from booked vendors (idempotent).
  PERFORM public.ensure_papic_auto_missions(p_event_id);

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

REVOKE ALL ON FUNCTION public.ensure_papic_board(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_papic_board(UUID, BOOLEAN) TO authenticated, service_role;
COMMENT ON FUNCTION public.ensure_papic_board(UUID, BOOLEAN) IS
  'Papic Challenges §9.3: materialize-once, deterministic 20-slot board (couple ≤10 + vendor ≤5 + Setnayan backfill). Rows are never deleted; de-selection = board_slot NULL. p_pabati_active is server-computed (never client-spoofable; resolver is non-anon). Auth: couple, coordinator, admin, or service_role. Flag-gated at the call site.';

-- ============================================================================
-- 6) papic_guest_missions v4 — widened reader. DROP+CREATE (return shape changes),
--    re-GRANT to authenticated,anon, carry the v3 fail-closed target_role guard,
--    order by board_slot, UNION completed-off-board, FAIL-SOFT when no board exists.
-- ============================================================================
DROP FUNCTION IF EXISTS public.papic_guest_missions(UUID);
CREATE FUNCTION public.papic_guest_missions(p_guest_id UUID)
RETURNS TABLE (
  mission_id      UUID,
  mission_type    TEXT,
  prompt          TEXT,
  vendor_id       UUID,
  vendor_name     TEXT,
  target_guest_id UUID,
  target_role     public.guest_role,
  completed       BOOLEAN,
  consent_shared  BOOLEAN,
  source          TEXT,
  capture_kind    TEXT,
  library_id      SMALLINT,
  board_slot      SMALLINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_guest_role public.guest_role;
  v_has_board  BOOLEAN;
BEGIN
  SELECT g.event_id, g.role INTO v_event_id, v_guest_role
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event_id IS NULL THEN
    RETURN;  -- unknown / deleted guest → empty set
  END IF;

  -- Has a board been materialized for this event? If not, FAIL-SOFT to v3 behaviour
  -- (show all active/approved missions by created_at) — the flag is LIVE in prod and
  -- the resolver is wired by a later PR, so this reader must not blank today's missions.
  SELECT EXISTS (
    SELECT 1 FROM public.papic_missions m
    WHERE m.event_id = v_event_id AND m.board_slot IS NOT NULL
  ) INTO v_has_board;

  RETURN QUERY
  SELECT m.mission_id, m.mission_type, m.prompt, m.vendor_id, ev.vendor_name,
         m.target_guest_id, m.target_role,
         (c.completion_id IS NOT NULL) AS completed,
         COALESCE(c.consent_to_share, false) AS consent_shared,
         m.source, m.capture_kind, m.library_id, m.board_slot
  FROM public.papic_missions m
  LEFT JOIN public.event_vendors ev ON ev.vendor_id = m.vendor_id
  LEFT JOIN public.papic_mission_completions c
    ON c.mission_id = m.mission_id AND c.guest_id = p_guest_id
  WHERE m.event_id = v_event_id
    AND m.is_active
    AND m.approved
    -- targeted (roster) missions show only to the targeted guest; general missions show to all.
    AND (m.target_guest_id IS NULL OR m.target_guest_id = p_guest_id)
    -- role-scoped missions show only to a guest of that role (fail-CLOSED — v3 guard carried forward).
    AND (m.target_role IS NULL OR m.target_role = v_guest_role)
    AND (
      NOT v_has_board                 -- fail-soft: no board → show all (v3 behaviour)
      OR m.board_slot IS NOT NULL     -- on the board (the live ≤20)
      OR c.completion_id IS NOT NULL  -- completed-off-board → the "Done" archive (never un-finish a guest)
    )
  ORDER BY (c.completion_id IS NOT NULL), m.board_slot NULLS LAST, m.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_guest_missions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_guest_missions(UUID) TO authenticated, anon;
COMMENT ON FUNCTION public.papic_guest_missions(UUID) IS
  'Papic Challenges §9: guest board reader (v4). Orders by board_slot, UNIONs completed-off-board into a Done archive, fail-soft to v3 created_at order when no board is materialized. Carries the v3 fail-closed target_role guard.';

COMMIT;
