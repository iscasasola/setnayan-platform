## 2026-06-30 · feat(home): homepage "Sign in" is now a popup overlay, like the rest of the upper menu

Owner directive: *"login should be like the rest of the upper menu. a popup."*
On the homepage glass nav (`HomeReskin`), Prices / Download / Vendors already
open as overlay popups, but "Sign in" hard-navigated to `/login`. It's now a
fourth overlay, consistent with the other three.

- `app/_components/home/HomeOverlays.tsx` — new `SignInOverlay` + `'signin'`
  added to `OverlayId`. It is a REAL working login, not a mockup: it renders the
  SAME OAuth row (`OAuthButtonRow` / the desktop `DesktopOAuthButtons` loopback
  variant) + email/password form as the `/login` page, wired to the SAME server
  actions (`signInWithPassword`). Happy path (correct credentials or OAuth)
  completes from the popup; a credential error redirects to the full `/login`
  page with its error banner (the action's existing contract) so the overlay
  degrades gracefully. "Stay signed in" defaults checked (matches `/login`).
- `app/_components/home/HomeReskin.tsx` — the "Sign in" `<Link href="/login">`
  becomes a `<button onClick={() => setOverlay('signin')}>`; threads the new
  `oauth` prop to `HomeOverlays`.
- `app/page.tsx` — computes shell-gated OAuth visibility server-side
  (`getClientShell` + `ANY_OAUTH_ENABLED`, same logic as `/login`: web + desktop
  only, hidden on the mobile WebView shell) and threads it down via `oauth`,
  since the overlay is a client component that can't read headers()/cookies().
- `app/_components/home/home-reskin.css` — `.hr-si-*` form chrome scoped under
  `.home-reskin-ov`, matching the greige overlay tokens.

`/login` is untouched and remains the canonical full-page auth surface (deep
links, OAuth callbacks, error states, password reset). The homepage popup is an
additive faster path.

SPEC IMPACT: Logged at the bottom of `DECISION_LOG.md` (2026-06-30). The
homepage reskin is code-canonical per the 2026-06-07 source-of-truth flip; no
iteration `.md`/`.docx` carries the homepage nav behavior.
