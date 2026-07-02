/**
 * Client-safe demo-mode cookie-name constants.
 *
 * Deliberately isolated from lib/demo-mode.ts: that module transitively imports
 * lib/supabase/server.ts (→ next/headers), so a CLIENT component importing a
 * constant from it would pull next/headers into the client bundle and fail the
 * build. The client <DemoModeBanner> imports these names from HERE instead.
 * lib/demo-mode.ts re-exports them so existing server-side importers are
 * unchanged. (Perf sweep 2026-07-02, homepage ISR.)
 */

/** httpOnly cookie that actually gates demo mode (set server-side only). */
export const DEMO_MODE_COOKIE_NAME = 'setnayan_demo_mode';

/**
 * Non-httpOnly "presence hint" companion — carries NO security value. It only
 * lets the client-side <DemoModeBanner> know demo mode *might* be on so it asks
 * the server (/api/demo-mode/status) for the authoritative, admin-verified
 * answer. Set/cleared in lockstep with DEMO_MODE_COOKIE_NAME.
 */
export const DEMO_MODE_HINT_COOKIE_NAME = 'setnayan_demo_mode_hint';
