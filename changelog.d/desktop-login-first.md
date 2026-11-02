## 2026-06-25 · feat(desktop): Tauri shell boots into login, not the marketing brochure

The macOS/Windows Tauri desktop wrapper loads the live site, but landed on the
public marketing homepage like a fresh browser visitor. The desktop app is a
signed-in surface for existing account holders, so it should boot straight into
the product.

Reused the owner-locked 0052 "native-app login-first entry" already serving the
Capacitor mobile shell instead of inventing a new path: added the `SetnayanApp`
user-agent marker to the desktop webview via `app.windows[].userAgent` in
`src-tauri/tauri.conf.json` (a full macOS-Safari UA + the marker, mirroring how
`apps/mobile/capacitor.config.ts` appends it). The existing middleware then:

- bounces an **unauthenticated** launch from `/` → `/login`, and
- sends an **already-signed-in** launch (session persists in the WebView) → `/dashboard`,

skipping the brochure entirely. No middleware logic change — only its comments
were updated to record that the Tauri desktop shell is now a second source of
the `SetnayanApp` marker (it sets no client-type cookie, relying on the UA).

Takes effect only after a fresh `build-desktop` run + reinstall — the redirect
behavior is baked into the binary's webview config, and desktop builds are
manual-only (workflow_dispatch) since 2026-06-20.

SPEC IMPACT: None — applies the existing owner-locked 0052 native-shell design
to the desktop wrapper; no schema/SKU/pricing/flow change.
