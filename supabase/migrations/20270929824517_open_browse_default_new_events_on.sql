-- ============================================================================
-- 20270929824517_open_browse_default_new_events_on.sql
--
-- OPEN-BROWSE LAUNCH (council verdict 2026-07-22 build-plan row 11, the go-live
-- lever): "new events default ON at creation; existing launched events opt in
-- via the board toggle — no backfill of in-flight weddings."
--
-- ⚠ MERGING THIS IS PART OF THE PRODUCTION GO-LIVE. It flips the column DEFAULT
--   so every NEWLY-created event gets the open-browse guest website. It is the
--   deliberate launch step — hold it until the sample-event verification
--   (PR #3650) is merged and you have browser-verified 4 phases × 3 identities.
--
-- What it does:
--   · ALTER the DEFAULT of events.website_open_browse from FALSE to TRUE, so new
--     inserts (create-event/actions.ts inserts without specifying the column,
--     so the DEFAULT applies) get open-browse on.
--
-- What it deliberately does NOT do (council "no backfill" rule):
--   · It does NOT UPDATE any existing row. Every wedding already in flight keeps
--     its current FALSE value and only opts in via the couple board toggle — a
--     couple 60 days out must never have her site reshape overnight.
--   · It does NOT touch NEXT_PUBLIC_WEBSITE_MENU_ENABLED — the bottom-nav menu
--     is enabled globally by that ENV flag (deploy config, your action). Set it
--     to 'true' in the same launch window so new open-browse events ship with
--     the nav to browse them; the sample event already renders the menu.
--   · It does NOT delete WIDGET_PHASES or retire the legacy bars — that is the
--     post-soak cleanup PR, run only after this has soaked in production.
--
-- ROLLBACK: `ALTER TABLE public.events ALTER COLUMN website_open_browse SET
-- DEFAULT FALSE;` — instantly returns new events to the pre-launch behavior.
-- Events created while the default was TRUE keep their value (flip individually
-- from the board if needed). Reversible.
--
-- IDEMPOTENT: SET DEFAULT is declarative; re-running is a no-op.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ALTER COLUMN website_open_browse SET DEFAULT TRUE;

COMMENT ON COLUMN public.events.website_open_browse IS
  'Open-browse master switch for the guest event website (council verdict '
  '2026-07-22). Default flipped to TRUE at launch (migration 20270929824517) so '
  'NEW events ship open-browse; existing launched events were NOT backfilled '
  '(they opt in via the couple board — in-flight weddings must not reshape '
  'overnight). FALSE = legacy phase-gated site; TRUE = five-tab open-browse site '
  'where lifecycle phases are spotlights, not gates. Read by resolveSiteBodyPlan. '
  'The bottom-nav menu is separately gated by NEXT_PUBLIC_WEBSITE_MENU_ENABLED.';

COMMIT;
