-- ============================================================================
-- 20270929637284_open_browse_enable_sample_event.sql
--
-- OPEN-BROWSE PR11 (verification step) — council verdict 2026-07-22 build-plan
-- row 11: "flip website_open_browse on demo events → owner browser-verifies 4
-- phases × 3 identities → new events default on at creation".
--
-- This migration performs ONLY the demo-event enablement — the safe, reversible
-- first step of the go-live sequence. It flips `website_open_browse` to TRUE for
-- the sample/tour event(s) (`events.is_sample = TRUE`) so the owner can preview
-- the COMPLETE open-browse experience (PR7 phases-as-emphasis engine + PR8
-- editorial-as-archive / empty-state / find-mode layer + PR9 couple manager) at
-- the sample URL and verify it across the four lifecycle phases (`?phase=`
-- preview works for sample events) before the real launch.
--
-- It deliberately does NOT do the production go-live:
--   · It does NOT touch any real couple's event (only `is_sample = TRUE`).
--   · It does NOT change the `website_open_browse` column DEFAULT (new events
--     stay FALSE until the owner runs the launch step).
--   · It does NOT flip the `NEXT_PUBLIC_WEBSITE_MENU_ENABLED` env flag (deploy
--     config) — though the sample event already renders the menu regardless
--     (siteMenuEnabled returns TRUE for is_sample), so no flag change is needed
--     for the sample preview.
--   · It does NOT delete WIDGET_PHASES or retire the legacy bars (post-soak
--     cleanup, a later PR).
--
-- ROLLBACK: re-run `UPDATE public.events SET website_open_browse = FALSE WHERE
-- is_sample = TRUE;` (or flip it from the couple board). Fully reversible.
--
-- IDEMPOTENT: a plain UPDATE guarded on is_sample; re-running is a no-op once
-- the sample rows are already TRUE.
-- ============================================================================

BEGIN;

UPDATE public.events
   SET website_open_browse = TRUE
 WHERE is_sample = TRUE
   AND website_open_browse IS DISTINCT FROM TRUE;

COMMIT;
