## 2026-10-04 · feat(app): Sign in with Apple (native sheet) + Google through the system browser in the phone apps

B3 of `INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md`; DECISION_LOG
2026-09-30 "…GOOGLE + APPLE SIGN-IN COME TO THE PHONE APPS BEFORE THE APPLE
CHECK" and 2026-10-04 "YES TO ALL" (1). Apple guideline 4.8: Google in the app
requires Sign in with Apple beside it.

The phone app hid Google/Apple because Google refuses sign-in inside an embedded
web view. It now shows both — Apple first — and never opens a provider page in
the web view:

- **Apple on iPhone** — the native Sign in with Apple sheet (in-repo Capacitor
  plugin `SetnayanAuth`, `apps/mobile/ios/App/App/SetnayanAuthPlugin.swift`, no
  npm package). A SHA-256 nonce goes to the sheet; the identity token is
  exchanged with `supabase.auth.signInWithIdToken`; the web view then opens
  `/auth/callback?native=1&next=…`, which runs the SAME landing as every other
  door (RSVP-page terms, vendor intent, the You card) for a session from the
  last five minutes.
- **Google (and Apple on Android)** — the SYSTEM browser:
  `ASWebAuthenticationSession` on iOS, a Custom Tab on Android
  (`…/SetnayanAuthPlugin.java`, no new dependency). `signInWithOAuth` with
  `skipBrowserRedirect` and `redirectTo: setnayan://auth/callback?next=…`; the
  PKCE verifier stays in the web view's cookies, so the existing
  `/auth/callback` exchanges the code. iOS hands the return URL back; Android
  returns through `appUrlOpen` (`native-bridge.tsx`, mapping now in
  `lib/app-url-path.ts`).
- **Who sees which buttons** is one pure rule, `lib/oauth-shell-gate.ts`, read
  by the server (`getOAuthGate` → /login, /signup, /open-shop) and the browser
  (`detect-oauth-shell.ts`). Only a phone build that appends `SetnayanSignIn/1`
  to its user-agent (`capacitor.config.ts`) gets the native row — the binary
  already in people's hands stays email-only rather than show a dead button.
  The web and the desktop app are unchanged.
- The app gains the `com.apple.developer.applesignin` entitlement.

Guarded by `apps/web/lib/native-sign-in.test.ts` (gate per shell, flow per
button, return URL, the shared callback landing, the native plugin registered on
both phones, and 🔒 the provider URL never reaches the web view). Every
assertion sabotaged red → green.

Needs owner setup before it works end to end (PR body): Supabase redirect URL
`setnayan://auth/callback**`; the bundle ID `com.setnayan.app` in Supabase's
Apple provider Client IDs; Sign in with Apple on the App ID; a new app build.

SPEC IMPACT: `INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md` § B3 gets a
"BUILT on rd/native-apple-google-sign-in" status line; DECISION_LOG gains a
2026-10-04 "B3 BUILT" row recording the flows and the owner setup.
