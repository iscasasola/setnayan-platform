## 2026-10-04 · feat(app): the ticket's "Save to my account" signs in natively · the app is named Setnayan

Follow-up to the native Apple + Google sign-in (#6330), stacked on it.

**1 · "Save to my account" inside the phone app.** The Save on the ticket /
thank-you / Me / the plus-one's door (`app/[slug]/_components/save-to-account.tsx`)
was a Server Action that redirected to Apple / Google. Inside the app that
redirect left the web view for Safari: the guest signed in THERE and the app
never saw the account. Now, only in a phone build carrying `SetnayanSignIn/1`
(the SAME gate as /login — `oauthGate` in `lib/oauth-shell-gate.ts`, Apple on):

- the page draws the Save through `NativeSaveForm` (new,
  `app/[slug]/_components/native-save-form.tsx`), which calls the SAME action —
  `startAccountSaveAction`, or the plus-one door's `confirmPlusOneName`;
- the action does everything it always did (the guest pass, the Terms tick and
  its cookie, the plus-one's answers, the method the button SAID), then hands
  back `{ native, next }` instead of redirecting (`nativeSaveHandOff`, new
  `lib/native-account-save.ts` — only when the form asked AND the request's own
  user-agent passes the gate);
- the form runs `signInWithProviderNative` (the Apple sheet on iOS, Google in
  the system browser) with that `next` — the SAME `/join/{eventId}/connect` the
  web door returns to. One linking path: the connect route's confirm page still
  asks before any seat binds (DECISION_LOG 2026-09-30 "A SEAT BECOMES AN
  ACCOUNT'S ONLY ON PURPOSE"). After sign-in the guest is back on the same
  event's page.

The web, the desktop app and an older phone build render and post exactly as
before (no native field, plain `<form action>`).

**2 · The app's name.** The iOS sign-in prompt read *"“App” Wants to Use … to
Sign In"* — measured in the simulator: it reads `CFBundleName`, which was
`$(PRODUCT_NAME)` = `App` (CFBundleDisplayName was already "Setnayan"). Set
`CFBundleName` to `Setnayan` in `apps/mobile/ios/App/App/Info.plist`; re-measured,
the prompt reads *"“Setnayan” Wants to Use …"*. `PRODUCT_NAME`, the `App.app`
bundle, the executable, the bundle id `com.setnayan.app` and signing are
untouched. Android's `app_name` / `title_activity_main` were already "Setnayan".

Guard: `app/[slug]/_components/the-app-save-signs-in-natively.test.ts` (8 tests,
5 sabotages red → restored green). `the-arrival-says-what-opens.test.ts` now
accepts the web form's `as WebFormAction` cast on the same one save action.

SPEC IMPACT: None — implements DECISION_LOG 2026-09-30 (native sign-in in the
phone apps; a seat binds only on purpose) on one more door; no decision changes.
