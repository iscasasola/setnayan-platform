-- ============================================================================
-- 20270919912384_open_browse_inert_schema.sql
-- Created via `pnpm migration:new` (prefix auto-allocated).
--
-- OPEN-BROWSE PR4 — the inert schema (council build plan §3 row 4,
-- Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md).
--
-- Ships with ZERO readers. Nothing in apps/web selects either column yet;
-- PR7 (open-everything render branch) and PR9 (couple manager mirror) are the
-- readers. Because migrations AUTO-APPLY on merge to main (there is no manual
-- push gate — supabase-migrations.yml runs `db push` on every merge), the
-- go-live hold IS the DEFAULT FALSE below, never "hold the push".
--
-- Two columns:
--
--   1. events.website_open_browse BOOLEAN NOT NULL DEFAULT FALSE
--      The per-event open-browse master switch. FALSE = today's phase-gated
--      site behavior, unchanged. TRUE (read by PR7+, flipped by the couple's
--      board toggle in PR9, defaulted ON at creation for NEW events only in
--      PR11) = the five-tab open-browse site: phases become spotlights, not
--      gates. Per-event by design — a global env flip was REJECTED by the
--      council because it would reshape in-flight weddings without consent
--      (a couple 60 days out must not have her site reshape overnight).
--      Existing launched events opt in via the board; no backfill ever.
--
--   2. invitation_widgets.mode TEXT NOT NULL DEFAULT 'auto'
--      CHECK (mode IN ('auto','shown','hidden'))
--      The couple manager's three-state control (Program Board graft):
--        'auto'   — the site decides via the shared hasContent() predicate +
--                   phase emphasis (PR7); empty sections self-hide.
--        'shown'  — couple force-shows (the PR9 editor disables this while
--                   the source is empty, so force-on can never manufacture a
--                   blank guest-facing section).
--        'hidden' — couple force-hides; the open-browse flip must NEVER
--                   un-hide a couple's deliberate choice.
--      The backfill below (same migration — the council's load-bearing rule)
--      maps every pre-existing is_visible = FALSE row to 'hidden' so that
--      deliberate hides survive the flip. is_visible stays in place as the
--      legacy editor's column and the flag-off render gate; `mode` becomes
--      the couple's only hiding mechanism when PR9 ships. Until then no code
--      reads OR writes `mode` (writes via the legacy is_visible toggle do not
--      sync it — acceptable ONLY because PR9's setSectionMode lands before
--      any reader branches on mode; PR7/PR9 must reconcile is_visible=FALSE
--      OR mode='hidden' at read time for rows hidden between this migration
--      and the PR9 cutover).
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS; DROP CONSTRAINT IF EXISTS + ADD; the
-- backfill only touches rows still at the 'auto' default, so a re-run never
-- clobbers a later couple decision.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. events.website_open_browse — the per-event open-browse switch.
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS website_open_browse BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.website_open_browse IS
  'Open-browse master switch for the guest event website (council verdict '
  '2026-07-22, PR4 of 11). FALSE (default) = legacy phase-gated site; TRUE = '
  'five-tab open-browse site where lifecycle phases are spotlights, not gates. '
  'ZERO readers until PR7 (render branch) + PR9 (couple board toggle); PR11 '
  'defaults NEW events ON at creation only — existing launched events opt in '
  'via the board, never a backfill (in-flight weddings must not reshape '
  'overnight). DEFAULT FALSE is the go-live hold under auto-apply-on-merge. '
  'Distinct from papic pool browsing and landing_page_visibility (the '
  'private-until-launch wall, which stays the outer gate regardless of this '
  'flag).';

-- ----------------------------------------------------------------------------
-- 2. invitation_widgets.mode — three-state couple control: auto|shown|hidden.
-- ----------------------------------------------------------------------------

ALTER TABLE public.invitation_widgets
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_mode_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_mode_check
  CHECK (mode IN ('auto','shown','hidden'));

COMMENT ON COLUMN public.invitation_widgets.mode IS
  'Three-state section control for the PR9 couple board (council verdict '
  '2026-07-22): auto = hasContent()+phase decide; shown = force-show (editor '
  'disables while source empty); hidden = couple force-hide — the open-browse '
  'flip must never un-hide a deliberate choice (is_visible=FALSE rows were '
  'backfilled to hidden in the same migration that added this column). '
  'ZERO readers until PR7/PR9; the legacy is_visible column remains the '
  'flag-off render gate, and readers must treat is_visible=FALSE OR '
  'mode=hidden as hidden EXCEPT is_always_on rows (hero/greeting/qr_card/rsvp '
  'render regardless) until the PR9 cutover makes mode the single source.';

-- ----------------------------------------------------------------------------
-- 3. Backfill — deliberate hides survive the flip (load-bearing rule).
--    Only rows still at the 'auto' default are touched, so a re-run can never
--    overwrite a couple decision made after this migration first applied.
--    The `is_always_on = FALSE` guard preserves the always-on invariant:
--    always-on sections (hero/greeting/qr_card/rsvp) render REGARDLESS of
--    is_visible (lib/invitation-widgets.ts widgetShouldRender), so they must
--    never be tagged mode='hidden' — otherwise, once PR9 makes `mode` the
--    single source of truth, a force-hide could suppress a load-bearing
--    surface like RSVP. No such row exists today (toggleWidgetVisibility
--    blocks hiding always-on), so this is a fail-safe on a latent path.
-- ----------------------------------------------------------------------------

UPDATE public.invitation_widgets
   SET mode = 'hidden'
 WHERE is_visible = FALSE
   AND is_always_on = FALSE
   AND mode = 'auto';

COMMIT;
