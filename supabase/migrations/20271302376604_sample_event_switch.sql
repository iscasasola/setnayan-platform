-- sample_event_switch
-- ============================================================================
-- THE MARIA AND JOSE SAMPLE IS BUILT DARK — the one switch (owner GO 2026-11-02,
-- corpus SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md + RELEASE_LIST_DARK_LAUNCHES.md).
-- ============================================================================
-- The signed-out `/sample` door (and everything later slices hang under it)
-- opens for everyone only when this switch is TRUE. While it is off, internal
-- (§10a `users.is_internal`) accounts still see it, so the owner can walk it
-- before he flips it — "go" is a flip, never a redeploy.
--
-- TRI-STATE, the `setnayan_ai_paywall_enabled` precedent (20270209911535):
--   • NULL  → defer to the server-only SAMPLE_EVENT_ENABLED env var, which is
--             unset everywhere — so the DEFAULT is OFF.
--   • TRUE  → open for everyone (DB overrides env).
--   • FALSE → closed for everyone but internal accounts (DB overrides env).
--
-- Non-secret feature flag → the world-readable platform_settings singleton.
-- Read by apps/web/lib/sample-event/switch.ts (resolveSampleEventEnabled);
-- written only by the admin switch (app/admin/settings/actions.ts
-- setSampleEventSwitch), which clears GLOBAL_SETTINGS_TAGS.platformSettings.
--
-- The sample itself is NOT in the database: /sample serves fixtures keyed to
-- one non-castable id (lib/sample-event/snapshot.ts). Nothing here grants
-- anonymous access to any table, and no RLS policy changes.
--
-- Idempotent.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS sample_event_enabled BOOLEAN;

COMMENT ON COLUMN public.platform_settings.sample_event_enabled IS
  'The Maria and Jose sample (/sample) dark-launch switch. Tri-state: NULL = defer to the SAMPLE_EVENT_ENABLED env var (unset = off); TRUE = open for everyone; FALSE = off. Internal accounts see the sample while it is off. Non-secret feature flag; world-readable like the rest of platform_settings.';
