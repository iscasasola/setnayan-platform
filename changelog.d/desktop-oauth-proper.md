## 2026-06-26 · feat(desktop): system-browser OAuth for the desktop app (localhost loopback)

The proper fix behind the stopgap (`desktop-oauth-stopgap`): Google/Apple refuse
OAuth inside the Tauri WebView, so the desktop app now runs consent in the user's
**system browser** and catches the redirect on a throwaway **localhost loopback**
(the standard Tauri desktop-OAuth pattern). Owner-approved "stopgap now + proper
fix" (2026-06-26).

**Native (`src-tauri/`)** — validated with `cargo check` (plugins resolve + compile;
`generate_context!` accepts the config + capabilities):
- `tauri-plugin-oauth` (loopback) + `tauri-plugin-opener` (open system browser).
- `withGlobalTauri: true` so the bundled remote web app can drive them.
- Window UA marker `SetnayanApp` → `SetnayanApp/desktop` so the server can tell the
  rebuilt desktop app from mobile/older shells.
- `capabilities/default.json`: a TIGHT grant — only the oauth start/cancel, opener
  open-url, and event-listen commands, scoped to the `main` window + the
  `setnayan.com` remote URLs. No fs / shell-exec / arbitrary IPC.

**Web (`apps/web/`)** — every bit gated on `window.__TAURI__` + the `/desktop` UA,
so web and mobile login are byte-for-byte unchanged (verified by curl: web → the
server-action row, `SetnayanApp/desktop` → the loopback buttons, plain
`SetnayanApp` → email-only):
- `lib/desktop-oauth.ts` — the loopback orchestration (start → signInWithOAuth
  skipBrowserRedirect → open_url → `oauth://url` → exchangeCodeForSession → next).
- `app/_components/desktop-oauth-buttons.tsx` — the desktop OAuth buttons.
- `app/_components/oauth-icons.tsx` — Google/Apple marks extracted from
  `oauth-button-row.tsx` and shared by both variants (no duplication).
- `lib/request-platform.ts` — `getClientShell()` (web | desktop | mobile).
- `login` + `signup` render the desktop variant on desktop, the web row on web,
  email-only on mobile/older-native.

⚠ **NOT yet end-to-end validated** — the runtime loopback needs a real desktop
build to exercise (I can't run the Tauri app here). Two gates before it works:
1. **Owner config:** Supabase → Auth → URL Configuration → Redirect URLs → add
   `http://localhost:*`. Google Cloud Console needs NO change.
2. **Rebuild:** run `build-desktop`, then swap the `/download` dmg +
   `lib/desktop-release.ts`.

Until the rebuild, the desktop app keeps the email-only stopgap (no `/desktop` UA
→ `getClientShell` = mobile → OAuth hidden), so nothing regresses meanwhile.

SPEC IMPACT: None — adds a desktop auth path; web/mobile auth unchanged.
