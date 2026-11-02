## 2026-09-18 · fix(live-wall): display-session cookie shares the guest-session secret resolver

`setWallDisplayCookie` / `readWallDisplayCookie` in `apps/web/lib/live-wall.ts`
had its own inline `getSecret()` reading `GUEST_SESSION_SECRET` /
`SUPABASE_SERVICE_ROLE_KEY` directly, duplicating the fallback logic already
centralized in `resolveGuestSessionSecret()` (`apps/web/lib/guest-session.ts`) —
including its min-length check and the one-line-per-process warning when the
service-role key is doing double duty as a signing secret. Now calls the
shared resolver.

SPEC IMPACT: None.
