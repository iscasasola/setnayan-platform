-- ============================================================================
-- 20260607030000_invitation_widgets.sql
--
-- V1 Invitation Widgets Editor (iteration 0004 · owner directive 2026-05-22 PM).
--
-- OWNER DIRECTIVE (verbatim, 2026-05-22 PM)
-- -----------------------------------------
-- "yes" — confirms ship of the V1 widget editor per the scope proposed:
--   1. invitation_widgets migration with 11+ pre-seeded rows per event
--   2. /dashboard/[eventId]/website/widgets page with show/hide + reorder
--   3. Landing page reads from invitation_widgets instead of hardcoded JSX
--
-- THE PROBLEM IT SOLVES
-- ---------------------
-- Until today, the public landing page at apps/web/app/[slug]/page.tsx
-- renders widgets in a hardcoded order (Hero → Greeting → QR card → RSVP →
-- Event Details → Countdown → Schedule → Venue → Dress Code → Photo Moments
-- → Your Photos → Tier Comparison). Every wedding ships the same widget
-- set in the same order. Hosts who want a tighter landing page (drop the
-- Tier Comparison, lead with Photo Moments, push Venue further down) have
-- no lever — every edit is an engineering ask.
--
-- WHAT THIS MIGRATION SHIPS
-- -------------------------
-- A per-event widget registry with:
--   • One row per (event, widget_type) — 12 widget types per the spec at
--     0004_invitation_widgets/0004_invitation_widgets.md PLUS the
--     `tier_comparison` widget that exists in the landing-page render today
--     (per the prompt's 12-widget table — supersedes the spec's 11-widget
--     count for this V1 ship).
--   • Boolean `is_visible` for show/hide toggle.
--   • Integer `display_order` for V1 Up/Down reorder buttons (drag-and-
--     drop deferred to V1.1; arrow buttons are mobile-friendly + keyboard-
--     accessible + zero new dependencies).
--   • `is_always_on` flag — hero, greeting, qr_card, rsvp render in fixed
--     positions regardless of display_order. The editor disables hide +
--     reorder for these rows so the host can't accidentally remove the
--     wedding's load-bearing surfaces (RSVP especially).
--   • `tier` column ('basic' | 'pro') — schema-level support for the two
--     V1 Pro upgrades from iteration 0034 (Monogram Hero ₱1,999 + Live
--     Schedule ₱999). The Pro purchase flow + tier-toggle UI is V1.1
--     scope per the prompt; the column exists today so the activation hook
--     from the existing service_orders → orders pipeline doesn't need a
--     schema migration when V1.1 ships.
--   • `config_json` JSONB for future per-widget overrides — empty default
--     today; renderers in [slug]/page.tsx already read content from
--     events.* columns (dress_code_config, photo_moments_config, etc.) so
--     V1 config_json stays empty.
--
-- WHY ONE ROW PER (event, widget_type) AND NOT (event, widget_instance)
-- --------------------------------------------------------------------
-- Every event has exactly one Hero, one Greeting, one QR card, one RSVP,
-- one Schedule, etc. — there's no use case in V1 for two Hero blocks on
-- the same landing page. The UNIQUE constraint on (event_id, widget_type)
-- enforces "one per event" and makes the seeding logic trivial (INSERT
-- a known list of widget_types, ON CONFLICT DO NOTHING for idempotency).
--
-- WHY A TRIGGER AND NOT APP-LAYER SEEDING
-- ---------------------------------------
-- Events are created in three different code paths today (
-- /dashboard/create-event server action, admin console event create,
-- event-join-token flows). Adding the seed via app-code means three
-- parallel places to keep in sync. A trigger on events INSERT runs once
-- in the DB and covers every path the app can reach. Backwards-compat
-- with existing events is handled by the same INSERT ... SELECT logic
-- run once via this migration's backfill step.
--
-- RLS — couples + hosts (event_moderators) read + write their own event's
-- widgets. Mirrors the canonical event_vendor_packages RLS shape from
-- 20260604110000_vendor_packages.sql · the public landing page reads via
-- the admin client (createAdminClient()) so no RLS path is needed for
-- anonymous-browser reads.
--
-- IDEMPOTENT via IF NOT EXISTS + ON CONFLICT DO NOTHING — safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invitation_widgets (
  widget_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL
                   REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- 12 canonical widget types matching the renderer in
  -- apps/web/app/[slug]/page.tsx. Order in the CHECK list mirrors the
  -- canonical render order; the actual render order is governed by the
  -- (is_always_on, display_order) tuple at runtime (see [slug]/page.tsx
  -- after refactor).
  widget_type      TEXT NOT NULL CHECK (widget_type IN (
    'hero',
    'greeting',
    'qr_card',
    'event_details',
    'countdown',
    'schedule',
    'rsvp',
    'venue_map',
    'dress_code',
    'photo_moments',
    'your_photos',
    'tier_comparison'
  )),
  display_order    INT NOT NULL,
  is_visible       BOOLEAN NOT NULL DEFAULT TRUE,
  -- is_always_on widgets (hero, greeting, qr_card, rsvp) render in fixed
  -- positions in the landing-page render loop regardless of display_order
  -- AND regardless of is_visible. The editor disables hide + reorder for
  -- these rows so the host can't accidentally remove load-bearing surfaces.
  is_always_on     BOOLEAN NOT NULL DEFAULT FALSE,
  -- 'basic' = free tier (every event). 'pro' = the iteration 0034 paid
  -- upgrades (Monogram Hero ₱1,999, Live Schedule ₱999). V1 ships with
  -- every row at 'basic'; the Pro purchase flow + tier-toggle UI is V1.1.
  tier             TEXT NOT NULL DEFAULT 'basic'
                   CHECK (tier IN ('basic','pro')),
  -- Per-widget config overrides. Empty default in V1 — the renderer reads
  -- content from events.* columns (dress_code_config, photo_moments_config,
  -- landing_page_hero_image_url, etc.) and the widget editor only controls
  -- show/hide + reorder. V1.1 may surface per-widget config (e.g., variant
  -- picker for Countdown ticker vs flip-digit, RSVP single vs multi-event).
  config_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per widget type per event. The seed inserts all 12; the editor
  -- never inserts or deletes — it only flips is_visible + display_order.
  UNIQUE (event_id, widget_type)
);

CREATE INDEX IF NOT EXISTS invitation_widgets_event_idx
  ON public.invitation_widgets(event_id, display_order);

CREATE INDEX IF NOT EXISTS invitation_widgets_event_visible_idx
  ON public.invitation_widgets(event_id)
  WHERE is_visible = TRUE;

-- ----------------------------------------------------------------------------
-- 2. RLS — couples + hosts read + write; admin read-all; public landing
--    reads via createAdminClient() so no anonymous policy is needed.
-- ----------------------------------------------------------------------------

ALTER TABLE public.invitation_widgets ENABLE ROW LEVEL SECURITY;

-- Couple read — uses the canonical helper from 20260513040000_fix_rls_
-- infinite_recursion.sql · matches event_vendor_packages from
-- 20260604110000_vendor_packages.sql.
DROP POLICY IF EXISTS invitation_widgets_couple_read ON public.invitation_widgets;
CREATE POLICY invitation_widgets_couple_read
  ON public.invitation_widgets FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- Couple write — same gate as read.
DROP POLICY IF EXISTS invitation_widgets_couple_write ON public.invitation_widgets;
CREATE POLICY invitation_widgets_couple_write
  ON public.invitation_widgets FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- Moderator read+write — iteration 0048 multi-host invite path (V1 per
-- CLAUDE.md 2026-05-20 row). Accepted hosts (accepted_at IS NOT NULL +
-- removed_at IS NULL) get the same surface as the legacy event_members
-- 'couple' rows.
DROP POLICY IF EXISTS invitation_widgets_moderator_read ON public.invitation_widgets;
CREATE POLICY invitation_widgets_moderator_read
  ON public.invitation_widgets FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS invitation_widgets_moderator_write ON public.invitation_widgets;
CREATE POLICY invitation_widgets_moderator_write
  ON public.invitation_widgets FOR ALL
  TO authenticated
  USING (
    event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT em.event_id FROM public.event_moderators em
      WHERE em.user_id = auth.uid()
        AND em.accepted_at IS NOT NULL
        AND em.removed_at IS NULL
    )
  );

-- Admin read-all — matches the broader admin pattern in vendor_packages.
DROP POLICY IF EXISTS invitation_widgets_admin_read ON public.invitation_widgets;
CREATE POLICY invitation_widgets_admin_read
  ON public.invitation_widgets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invitation_widgets_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitation_widgets_updated_at ON public.invitation_widgets;
CREATE TRIGGER invitation_widgets_updated_at
  BEFORE UPDATE ON public.invitation_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.invitation_widgets_set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. AFTER INSERT trigger on public.events — populate the 12 default rows
--
-- Runs alongside the existing on_event_created trigger (which seeds the
-- event_join_tokens row). Both run AFTER INSERT FOR EACH ROW so any
-- ordering is fine — there's no inter-trigger dependency.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.populate_default_invitation_widgets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 12 widget rows in canonical landing-page order. is_always_on widgets
  -- (hero, greeting, qr_card, rsvp) get display_order values that don't
  -- collide with the hideable widgets, but the renderer ignores
  -- display_order for is_always_on rows anyway — they render in fixed
  -- positions. Values are spaced so future inserts have room (display_
  -- order 50, 100, 150, ... pattern is overkill for V1; we use 1..12
  -- sequentially and let the editor swap as needed).
  INSERT INTO public.invitation_widgets
    (event_id, widget_type, display_order, is_visible, is_always_on)
  VALUES
    (NEW.event_id, 'hero',            1,  TRUE, TRUE),
    (NEW.event_id, 'greeting',        2,  TRUE, TRUE),
    (NEW.event_id, 'qr_card',         3,  TRUE, TRUE),
    (NEW.event_id, 'event_details',   4,  TRUE, FALSE),
    (NEW.event_id, 'countdown',       5,  TRUE, FALSE),
    (NEW.event_id, 'schedule',        6,  TRUE, FALSE),
    (NEW.event_id, 'rsvp',            7,  TRUE, TRUE),
    (NEW.event_id, 'venue_map',       8,  TRUE, FALSE),
    (NEW.event_id, 'dress_code',      9,  TRUE, FALSE),
    (NEW.event_id, 'photo_moments',  10,  TRUE, FALSE),
    (NEW.event_id, 'your_photos',    11,  TRUE, FALSE),
    (NEW.event_id, 'tier_comparison',12,  TRUE, FALSE)
  ON CONFLICT (event_id, widget_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_created_invitation_widgets ON public.events;
CREATE TRIGGER on_event_created_invitation_widgets
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_default_invitation_widgets();

-- ----------------------------------------------------------------------------
-- 5. Backfill — every existing event needs 12 rows
--
-- Runs once at migration apply. Idempotent via ON CONFLICT DO NOTHING:
-- events that already have widget rows (from a prior partial run) keep
-- their existing state; events with no widget rows get the canonical
-- 12-row seed. Production has ~tens of events today; this runs in
-- milliseconds.
-- ----------------------------------------------------------------------------

WITH widget_types(widget_type, display_order, is_always_on) AS (
  VALUES
    ('hero',            1,  TRUE),
    ('greeting',        2,  TRUE),
    ('qr_card',         3,  TRUE),
    ('event_details',   4,  FALSE),
    ('countdown',       5,  FALSE),
    ('schedule',        6,  FALSE),
    ('rsvp',            7,  TRUE),
    ('venue_map',       8,  FALSE),
    ('dress_code',      9,  FALSE),
    ('photo_moments',  10,  FALSE),
    ('your_photos',    11,  FALSE),
    ('tier_comparison',12,  FALSE)
)
INSERT INTO public.invitation_widgets
  (event_id, widget_type, display_order, is_visible, is_always_on)
SELECT
  e.event_id,
  wt.widget_type,
  wt.display_order,
  TRUE,
  wt.is_always_on
FROM public.events e
CROSS JOIN widget_types wt
ON CONFLICT (event_id, widget_type) DO NOTHING;

COMMENT ON TABLE public.invitation_widgets IS
  'Per-event widget registry for the public landing page (iteration 0004 V1). '
  'One row per (event_id, widget_type). The editor at '
  '/dashboard/[eventId]/website/widgets toggles is_visible + display_order. '
  'is_always_on widgets (hero, greeting, qr_card, rsvp) cannot be hidden or '
  'reordered. tier column is V1 scaffolding for the V1.1 Pro upgrade flow.';

COMMIT;
