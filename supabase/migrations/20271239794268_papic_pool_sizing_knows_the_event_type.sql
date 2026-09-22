-- ═══════════════════════════════════════════════════════════════════════════
-- THE CREDIT RECOMMENDATION LEARNS WHAT KIND OF CELEBRATION THIS IS
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-09-22: *"how about the credit recommendation? we also want that.
-- based on they type of event and the number of guest."* — then, confirming the
-- table below: *"yes, confirm the table."*
--
-- ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
-- `papic_event_pool_config` is a SINGLETON (`config_key = 'default'`, one row).
-- Every reader in the tree pins that key, so a christening, a debut and a
-- wedding are all quoted **150 credits a head**. Event type does not exist as a
-- dimension anywhere in the sizing formula:
--
--     pool = clamp(guest_count × points_per_guest, floor_points, ceiling_points)
--
-- ── 🛑 AND THE PER-HEAD NUMBER ALONE COULD NOT CARRY IT ────────────────────
-- The obvious build — one `points_per_guest` per type — SHIPS BROKEN, because
-- the clamp is global. With floor 5,000:
--
--     a 2-guest `date`        ×  50 =   100  → clamped UP to 5,000
--     a 30-guest `christening`×  70 = 2,100  → clamped UP to 5,000
--
-- i.e. we would recommend ₱3,360 of credits for a dinner for two. **A single
-- global floor makes every small event type absurd**, so a per-type row carries
-- `floor_points` and `ceiling_points` as well as the per-head figure.
--
-- ── THE VALUES ARE THE OWNER'S, NOT ENGINEERING'S ──────────────────────────
-- CLAUDE.md rule 9 (owner 2026-08-31, on this exact surface: *"don't guess"*):
-- a number that governs money gets its existing home or it stops. The 17
-- per-head figures below are the owner's, confirmed verbatim on 2026-09-22 and
-- recorded in DECISION_LOG.md. They are seeded here and **admin-editable
-- afterwards** — this migration builds the DIMENSION, not the policy.
--
-- ⚠ THE FLOOR/CEILING COLUMN VALUES ARE *NOT* OWNER-ACCEPTED YET. He confirmed
-- `points_per_guest` only. What is seeded is the recommendation put to him in
-- the PR body: **wedding keeps floor 5,000 / ceiling 30,000; every other type
-- gets floor 0 and the same ceiling** — the floor is REMOVED rather than
-- invented, because a per-head figure that is already type-appropriate makes it
-- redundant. If he wants different floors they are one admin edit each; nothing
-- here hardcodes them into app code.
--
-- ── 🔑 NOTHING MOVES ON MERGE, AND THAT IS THE ACCEPTANCE TEST ─────────────
-- `wedding` is seeded 150 / 5,000 / 30,000 — **byte-identical to the live
-- 'default' row** (measured in prod 2026-09-22). 9 of the 11 live events are
-- weddings, and the other two (`simple_event`, `date`) hold no Papic pool. So
-- every live celebration's recommendation is unchanged the moment this applies.
-- `papic-pool-sizing.test.ts` pins that as an assertion, not as a hope.
--
-- ── ⚠ TWO KINDS OF ROW IN ONE TABLE, AND THE RULE BETWEEN THEM ────────────
-- After this migration `papic_event_pool_config` holds:
--
--   • `config_key = 'default'` — the GLOBAL row. It owns every column, and it
--     is the ONLY row anything reads for `soft_stop_pct`, `pass_service_codes`,
--     `is_active`, `free_grant_points`, `camera_grant_points` and
--     `free_one_camera_points`.
--   • `config_key = '<event_type>'` — a SIZING row. **Only three columns on it
--     are ever read**: `points_per_guest`, `floor_points`, `ceiling_points`.
--
-- The other columns exist on a sizing row solely because they are NOT NULL;
-- they are seeded from the global row and are **INERT**. Making them nullable
-- would turn six shipped columns nullable in the generated TypeScript across
-- every unrelated reader, which is a far bigger blast radius than the fact it
-- would document. So the rule is enforced instead of merely written down:
-- `scripts/lint-pool-config-global-columns.mjs` fails the build if any read of
-- a global column is not pinned to `config_key = 'default'`.
--
-- 🪤 EVERY EXISTING READER ALREADY PINS `config_key = 'default'` — audited
-- across `apps/web` and `supabase/migrations` on 2026-09-22, TS and SQL, with
-- no unfiltered `select` anywhere. That is why seeding 17 new rows cannot
-- change any shipped behaviour, and it is why the lint above is cheap to keep
-- true rather than a retrofit.
--
-- ADDITIVE + IDEMPOTENT. Seeds 17 rows, adds one resolver function, and
-- replaces `papic_event_pool_status` so the DB fence and the app read the SAME
-- per-type numbers. No column is added, dropped or altered; no existing row is
-- changed.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · The 17 sizing rows
-- ---------------------------------------------------------------------------
-- Seeded from the 'default' row so the INERT columns can never disagree with
-- it at birth, then the three sizing columns are set to the owner's figures.
--
-- ON CONFLICT DO NOTHING: re-running never overwrites an admin's later edit.
-- That is the whole point of making these admin-editable.

INSERT INTO public.papic_event_pool_config (
  config_key, points_per_guest, floor_points, ceiling_points,
  soft_stop_pct, pass_service_codes, is_active,
  camera_grant_points, free_grant_points, free_one_camera_points
)
SELECT
  v.event_type,
  v.per_head,
  v.floor_pts,
  d.ceiling_points,
  d.soft_stop_pct, d.pass_service_codes, d.is_active,
  d.camera_grant_points, d.free_grant_points, d.free_one_camera_points
FROM public.papic_event_pool_config d
CROSS JOIN (VALUES
  -- ── 150 ───────────────────────────────────────────────────────────────
  -- wedding is UNCHANGED, deliberately. travel matches it because it is
  -- multi-DAY and duration beats any one evening.
  ('wedding',       150, 5000),
  ('travel',        150,    0),
  -- ── 120 ── debut carries the most planning steps of any type (14, in
  --           lib/checklist-event-type-defs.ts).
  ('debut',         120,    0),
  -- ── 90 ── reunion is high because guests photograph *each other*; that is
  --          the event.
  ('birthday',       90,    0),
  ('reunion',        90,    0),
  -- ── 80 ──
  ('gala_night',     80,    0),
  ('anniversary',    80,    0),
  -- ── 70 ──
  ('christening',    70,    0),
  -- ── 60 ──
  ('corporate',      60,    0),
  ('tournament',     60,    0),
  ('graduation',     60,    0),
  ('celebration',    60,    0),
  -- ── 50, the owner's floor ── wake is here because it is multi-night and the
  --    LEAST photographed by design; date and hangout carry 4 planning steps
  --    and two people.
  ('gender_reveal',  50,    0),
  ('wake',           50,    0),
  ('simple_event',   50,    0),
  ('date',           50,    0),
  ('hangout',        50,    0)
) AS v(event_type, per_head, floor_pts)
WHERE d.config_key = 'default'
ON CONFLICT (config_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2 · Refuse to apply if the seed did not cover the live vocabulary
-- ---------------------------------------------------------------------------
-- 🔑 A TYPE WITH NO ROW IS NOT AN ERROR AT RUNTIME — it falls back to 'default'
-- and is quoted 150/head, which is today's behaviour and is safe. But it IS an
-- error at BUILD time: it means somebody added an event type and never priced
-- it, and the fallback would hide that forever. Fail here, loudly, once.

DO $$
DECLARE
  v_missing TEXT[];
  v_wedding RECORD;
  v_default RECORD;
BEGIN
  SELECT array_agg(v.event_type ORDER BY v.event_type)
    INTO v_missing
    FROM public.event_type_vocab v
   WHERE NOT EXISTS (
     SELECT 1 FROM public.papic_event_pool_config c
      WHERE c.config_key = v.event_type
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'refusing to apply: event types with no Papic sizing row: %. Add them to the seed above with an owner-set per-head figure — do not let them fall back silently.',
      array_to_string(v_missing, ', ');
  END IF;

  -- The acceptance test, asserted in the migration itself: a wedding must be
  -- sized EXACTLY as it is today, or a live couple's number moves on merge.
  SELECT points_per_guest, floor_points, ceiling_points INTO v_wedding
    FROM public.papic_event_pool_config WHERE config_key = 'wedding';
  SELECT points_per_guest, floor_points, ceiling_points INTO v_default
    FROM public.papic_event_pool_config WHERE config_key = 'default';

  IF v_wedding IS DISTINCT FROM v_default THEN
    RAISE EXCEPTION
      'refusing to apply: the wedding sizing row (%/%/%) differs from default (%/%/%) — 9 of 11 live events are weddings and their recommendation would move.',
      v_wedding.points_per_guest, v_wedding.floor_points, v_wedding.ceiling_points,
      v_default.points_per_guest, v_default.floor_points, v_default.ceiling_points;
  END IF;
END $$;

COMMENT ON COLUMN public.papic_event_pool_config.config_key IS
  'TWO KINDS OF ROW. ''default'' is the GLOBAL row and owns every column — it is '
  'the only row anything reads for soft_stop_pct, pass_service_codes, is_active, '
  'free_grant_points, camera_grant_points or free_one_camera_points. Any other '
  'key is an `event_type_vocab.event_type` SIZING row, and ONLY THREE COLUMNS ON '
  'IT ARE EVER READ: points_per_guest, floor_points, ceiling_points. The rest are '
  'seeded copies kept only because those columns are NOT NULL, and they are '
  'INERT. Enforced by scripts/lint-pool-config-global-columns.mjs, not by '
  'convention. Resolve a celebration''s numbers with papic_event_pool_sizing().';

-- ---------------------------------------------------------------------------
-- 3 · THE ONE RESOLVER — event type in, three numbers out
-- ---------------------------------------------------------------------------
-- Mirrored exactly by `pickPoolSizing` in apps/web/lib/papic-pool-sizing.ts, the
-- pure TS twin, so the figure the app SHOWS and the figure the fence ENFORCES
-- cannot drift. That drift is the defect `computeEventPool` was built to avoid
-- and this keeps the promise one dimension wider.
--
-- Falls back to 'default' for an unknown or NULL type. A fallback is correct at
-- runtime (§2 makes an unpriced type a build failure instead), and it is what
-- keeps this safe on a database where the seed has not run yet.

CREATE OR REPLACE FUNCTION public.papic_event_pool_sizing(
  p_event_type TEXT
) RETURNS TABLE (
  points_per_guest INTEGER,
  floor_points     INTEGER,
  ceiling_points   INTEGER,
  sized_by         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.points_per_guest, c.floor_points, c.ceiling_points, c.config_key
    FROM public.papic_event_pool_config c
   WHERE c.config_key = COALESCE(p_event_type, 'default')
      OR c.config_key = 'default'
   -- The type's own row wins; 'default' is the fallback and sorts second.
   ORDER BY (c.config_key = 'default')
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.papic_event_pool_sizing(TEXT) IS
  'The per-event-type Papic pool sizing numbers, falling back to the global '
  '''default'' row. `sized_by` names the row that answered, so a screen can say '
  'whether a celebration is priced by its own type or by the fallback. Pure '
  'TS twin: pickPoolSizing() in apps/web/lib/papic-pool-sizing.ts.';

REVOKE ALL ON FUNCTION public.papic_event_pool_sizing(TEXT)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4 · The fence reads the same numbers
-- ---------------------------------------------------------------------------
-- Byte-identical to the shipped body (migration 20271184624871) except for the
-- sizing SELECT, which now goes through §3 with the event's own type. Every
-- other line — the flat-pass short circuit, the shared-grant rule, the seat
-- allocations, the soft stop — is unchanged.
--
-- ⚠ `soft_stop_pct` STAYS ON THE GLOBAL ROW. It is a UI warning threshold, not
-- a sizing number, and §2's comment is the rule this obeys.

CREATE OR REPLACE FUNCTION public.papic_event_pool_status(
  p_event_id UUID
) RETURNS TABLE (
  applies          BOOLEAN,
  guest_count      INTEGER,
  base_points      INTEGER,
  granted_points   INTEGER,
  total_points     INTEGER,
  used_points      INTEGER,
  remaining_points INTEGER,
  soft_stop_at     INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per_guest  INTEGER;
  v_floor      INTEGER;
  v_ceiling    INTEGER;
  v_soft_pct   INTEGER;
  v_event_type TEXT;
  v_guests     INTEGER;
  v_base       INTEGER;
  v_granted    INTEGER;
  v_alloc      INTEGER;
  v_total      INTEGER;
  v_used       INTEGER;
  v_has_flat   BOOLEAN;
BEGIN
  v_has_flat := public.papic_event_has_flat_pass(p_event_id);

  -- SHARED grants only. seat_id NOT NULL is a camera's own balance.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_granted
    FROM public.papic_event_point_grants
   WHERE event_id = p_event_id
     AND seat_id IS NULL;

  IF NOT v_has_flat AND COALESCE(v_granted, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- What the host has handed out to individual cameras. Those shots are still
  -- the event's; they are just no longer shared.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_alloc
    FROM public.papic_seat_allocations
   WHERE event_id = p_event_id;

  SELECT e.event_type INTO v_event_type
    FROM public.events e WHERE e.event_id = p_event_id;

  SELECT s.points_per_guest, s.floor_points, s.ceiling_points
    INTO v_per_guest, v_floor, v_ceiling
    FROM public.papic_event_pool_sizing(v_event_type) s;

  SELECT soft_stop_pct INTO v_soft_pct
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  IF v_has_flat THEN
    v_guests := COALESCE(public.papic_event_guest_headcount(p_event_id), 0);
    v_base := LEAST(v_ceiling, GREATEST(v_floor, v_guests * v_per_guest));
  ELSE
    v_guests := 0;
    v_base := 0;
  END IF;

  v_total := v_base + COALESCE(v_granted, 0) - COALESCE(v_alloc, 0);

  SELECT COALESCE(points_used, 0)
    INTO v_used
    FROM public.papic_event_pool_usage
   WHERE event_id = p_event_id;
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    TRUE,
    v_guests,
    v_base,
    COALESCE(v_granted, 0),
    v_total,
    v_used,
    GREATEST(0, v_total - v_used),
    (v_total * v_soft_pct) / 100;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_event_pool_status(UUID)
  FROM PUBLIC, anon, authenticated;

COMMIT;
