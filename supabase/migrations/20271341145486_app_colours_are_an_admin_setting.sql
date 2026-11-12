-- app_colours_are_an_admin_setting
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- THE APP'S COLOURS ARE AN ADMIN SETTING — Admin › Colours, wave 1 (owner
-- approved the prototype 12 Nov 2026: corpus Design_App_Colours_2026-11-12/
-- app-colours-admin.html; DECISION_LOG row 2026-11-12). Colour by JOB — page,
-- header band, frame, money, decision, private chat, toggle "on", icon tiles —
-- on every screen except the guest Event Hub (`app/[slug]`), which wears the
-- couple's own colours.
--
--   1. platform_settings.app_colours JSONB, NULLABLE. NULL = the code's
--      defaults (`APP_COLOURS_DEFAULT` in apps/web/lib/app-colours.ts), which
--      are today's exact values — so an unset row changes no pixel. The root
--      layout reads it once through the remembered global read (service role,
--      `getAppColours`) and writes the set as `:root` tokens only when it
--      differs from the defaults.
--   2. CHECK: NULL or a JSON object of bounded size. The SHAPE (every hex, the
--      readability gate, "two button kinds that look alike") is validated in
--      TypeScript by the one writer and again on every read
--      (`parseAppColours` fails toward the default field by field), so a bad
--      value can never paint an unreadable screen.
--
-- platform_settings already has RLS + its read-all policy and a TABLE-level
-- `GRANT SELECT … TO authenticated`, which covers a new column. The only
-- writer is Admin › Colours (`saveAppColours`, service role, audited as
-- `app_colours_edit`). No new policy, no new grant.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS app_colours JSONB;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_app_colours_shape;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_app_colours_shape
  CHECK (
    app_colours IS NULL
    OR (jsonb_typeof(app_colours) = 'object' AND octet_length(app_colours::text) <= 8192)
  );

COMMENT ON COLUMN public.platform_settings.app_colours IS
  'Admin › Colours (owner 2026-11-12): the app''s colours by JOB — page, band, frame, money, decision, private, toggle, '
  'icon tiles. NULL = the code defaults (apps/web/lib/app-colours.ts APP_COLOURS_DEFAULT, today''s exact values). Read '
  'once per cache window by the root layout (getAppColours) and written as :root tokens; never reaches the guest Event '
  'Hub. Written only from Admin › Colours (saveAppColours, audited as app_colours_edit), which refuses an unreadable set '
  'or two button kinds that look alike.';

COMMIT;
