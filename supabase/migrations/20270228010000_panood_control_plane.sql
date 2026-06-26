-- panood_moments + panood_control_state — the LIVE CONTROL PLANE for the upgraded
-- Panood multicam controller (iteration 0011), PR3. Two tables that together make
-- the day-of switcher a live, scriptable control room:
--
--   • panood_moments — the MOMENT-DIRECTOR presets/macros: named one-tap recipes
--     ("Processional", "The Kiss", "First Dance", …) that, when applied, set the
--     program source, overlays, the venue-wall source, audio ducking, and a lower-
--     third banner all at once. The macro is loose-text JSONB on purpose (sources,
--     overlays and labels are dynamic per event), so NO CHECK constraint on config.
--   • panood_control_state — the live PROGRAM/PREVIEW/ROUTING state, ONE row per
--     event (UNIQUE event_id): which source is on PROGRAM (broadcast), which is on
--     PREVIEW (cued next), whether the director is hands-on, whether the show is
--     live, and which moment-director preset is currently active.
--
-- These sit ON TOP OF PR1 (panood_camera_operators) and PR2 (panood_screens):
-- a moment's `config.program_source` / `walls_source` reference a camera feed or a
-- screen mode by the same loose-text identifier those layers route by.
--
-- KEEP THIS MIGRATION IDEMPOTENT (mirrors panood_camera_operators / panood_screens
-- conventions — it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ── panood_moments — moment-director presets/macros ──────────────────────────

CREATE TABLE IF NOT EXISTS public.panood_moments (
  id          bigserial PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  sort_order  int NOT NULL DEFAULT 0,
    -- Display order of the preset chips in the control room's Moment Director rail.
  label       text NOT NULL,
    -- The moment name shown on the chip, e.g. "Processional" / "The Kiss".
  icon        text,
    -- Optional Tabler icon name (ti-*) for the chip.
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- The MACRO this preset applies — loose JSON on purpose (sources/overlays/labels
    -- are dynamic per event, so NO CHECK constraint). Recognized keys:
    --   program_source text  — which feed/mode goes to PROGRAM (cam1 | cam2 | mirror | …)
    --   overlays       text[] — overlay layer keys to enable (monogram | lower_third | …)
    --   walls_source   text  — what the venue walls/screens route to
    --   audio_duck     bool  — duck floor/room audio (e.g. during vows)
    --   banner_label   text  — lower-third banner text
    --   banner_icon    text  — lower-third banner icon (ti-*)
  is_default  boolean NOT NULL DEFAULT false,
    -- TRUE for the seeded DEFAULT_MOMENTS spine (Processional…Toast); FALSE for
    -- couple-authored custom moments.
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Defensive ADD COLUMN IF NOT EXISTS for fresh-DB reproducibility — a no-op when
-- the CREATE TABLE above just ran, but keeps the schema correct if an older
-- partial table already exists (mirrors panood_screens).
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS event_id    uuid;
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS sort_order  int NOT NULL DEFAULT 0;
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS label       text;
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS icon        text;
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS config      jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS is_default  boolean NOT NULL DEFAULT false;
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.panood_moments ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS panood_moments_event_idx
  ON public.panood_moments (event_id);

-- ── panood_control_state — live program/preview/routing state (1 row / event) ─

CREATE TABLE IF NOT EXISTS public.panood_control_state (
  id               bigserial PRIMARY KEY,
  event_id         uuid NOT NULL UNIQUE REFERENCES public.events(event_id) ON DELETE CASCADE,
    -- ONE control-state row per event — the single source of truth the control
    -- room writes and every screen/feed watcher reads. UNIQUE enforces it.
  program_source   text,
    -- What is currently ON AIR / on the program bus (cam1 | cam2 | mirror | …).
    -- Loose text — sources are dynamic per event; NO CHECK.
  preview_source   text,
    -- What is cued next on the preview bus (the director takes it to program on cut).
  director_mode    boolean NOT NULL DEFAULT false,
    -- TRUE when the director is hands-on (manual switching) vs. auto/moment-driven.
  is_live          boolean NOT NULL DEFAULT false,
    -- TRUE while the show is broadcasting.
  active_moment_id bigint REFERENCES public.panood_moments(id) ON DELETE SET NULL,
    -- The moment-director preset currently applied (NULL = none / manual). ON DELETE
    -- SET NULL so deleting a preset never orphans the control row.
  updated_at       timestamptz NOT NULL DEFAULT now()
    -- Stamped on every control-plane write so screen/feed watchers pick up changes.
);

-- Defensive ADD COLUMN IF NOT EXISTS for fresh-DB reproducibility.
ALTER TABLE public.panood_control_state ADD COLUMN IF NOT EXISTS event_id         uuid;
ALTER TABLE public.panood_control_state ADD COLUMN IF NOT EXISTS program_source   text;
ALTER TABLE public.panood_control_state ADD COLUMN IF NOT EXISTS preview_source   text;
ALTER TABLE public.panood_control_state ADD COLUMN IF NOT EXISTS director_mode    boolean NOT NULL DEFAULT false;
ALTER TABLE public.panood_control_state ADD COLUMN IF NOT EXISTS is_live          boolean NOT NULL DEFAULT false;
ALTER TABLE public.panood_control_state ADD COLUMN IF NOT EXISTS active_moment_id bigint;
ALTER TABLE public.panood_control_state ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS panood_control_state_event_idx
  ON public.panood_control_state (event_id);

-- ---- RLS -------------------------------------------------------------------
-- Enabled at CREATE TABLE time (canonical rule), in the SAME migration.
--
-- Both tables mirror panood_screens / panood_camera_operators RLS EXACTLY: control
-- scoped to the CONTROL-ROOM roles only — the couple + a coordinator who runs the
-- day-of switcher (member_type IN ('couple','coordinator'), the canonical control
-- scope). Deliberately NOT current_event_ids() (every member, incl. GUESTS) — the
-- moment-director macros and the live program/preview/routing state are the
-- control plane, which a guest must never read or mutate (least privilege). The
-- control room mutates through a SECURITY DEFINER RPC / the service-role admin
-- client in the lib layer, so NO anon/device policy is invented here.

ALTER TABLE public.panood_moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS panood_moments_couple_full ON public.panood_moments;
CREATE POLICY panood_moments_couple_full ON public.panood_moments
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_moments.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_moments.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

ALTER TABLE public.panood_control_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS panood_control_state_couple_full ON public.panood_control_state;
CREATE POLICY panood_control_state_couple_full ON public.panood_control_state
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_control_state.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_control_state.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

COMMENT ON TABLE public.panood_moments IS
  'Upgraded Panood multicam: per-event MOMENT-DIRECTOR presets/macros (Processional…Toast spine + couple custom). config jsonb is the loose macro (program_source, overlays[], walls_source, audio_duck, banner_label, banner_icon — no CHECK, dynamic per event). is_default flags the seeded spine. Control-room-scoped RLS (couple + coordinator only, NOT guests). lib/panood-moments.ts.';

COMMENT ON TABLE public.panood_control_state IS
  'Upgraded Panood multicam: the live PROGRAM/PREVIEW/ROUTING control plane, ONE row per event (UNIQUE event_id). program_source/preview_source (loose text), director_mode, is_live, active_moment_id (FK → panood_moments, ON DELETE SET NULL). Control-room-scoped RLS (couple + coordinator only, NOT guests); mutated via the service-role admin client in the lib layer. lib/panood-control.ts.';
