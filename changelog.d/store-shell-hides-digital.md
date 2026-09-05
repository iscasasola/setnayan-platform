## 2026-09-05 · fix(store-shell): the App Store shell shows no paid digital feature, and no cookie prompt (App Review 2026-06-30 · 3.1.1 · 5.1.2)

App Review rejected iOS build 1.0 (1) on 2026-06-30 (submission `7f67da83`) on
three guidelines. This PR is the code half of the resubmission; the other half
is owner-side in App Store Connect (demo account + deletion screen recording in
Review Notes, App Privacy answers) and is listed in the PR body.

**3.1.1 via 3.1.3(b) — hiding the BUY button was not enough.** PR #2180
(2026-06-25) made the checkout drawer an inert chip on native, mid-review, and
Apple still rejected: *"the app accesses digital content purchased outside the
app … but that content isn't available to purchase using In-App Purchase."* A
feature bought on the web still WORKED in the app. Owner decision 2026-09-05
(over "build IAP now" and "argue"): until IAP ships (v1.1), the store shell is
planning + guests + real-world supplier bookings only.

- `lib/store-shell.ts` (new, pure): `isStoreShellSignals(ua, clientType)` —
  true ONLY for the Capacitor shell. 🔑 **Not `isCapacitorClient` and not
  `getRequestPlatform()`**: both match the desktop Tauri UA
  (`SetnayanApp/desktop`), and the latter answers `'ios'` for a macOS .dmg
  that Apple never reviews. `STORE_SHELL_HIDDEN_ADDON_KEYS` = every PAID
  catalog entry plus every entry with a `serviceKey` (a free-looking tile that
  sells an upgrade). `isStoreShellWebOnlyPath()` = those keys' Studio homes +
  `live-studio-control` + `editorial-pro` + `/orders/new` + `/checkout` +
  `/papic/order/*`.
- `middleware.ts`: on the store shell, a web-only path → 307 to `/web-only`.
  Extends the existing native marketing bounce; catches deep links,
  notifications and dashboard tiles the hub filter cannot.
- `studio/page.tsx`: `surfaceOk` drops hidden keys on the store shell.
- `app/(shell)/web-only/page.tsx`: "not in the app" — deliberately names no
  website, price or purchase (the #2180 no-steering posture).
- `lib/request-platform.ts`: `isStoreShellRequest()` server wrapper.
- **Web / PWA / desktop: byte-identical.**
- Free planning tools that merely EMBED the inert drawer (Save the Date, Indoor
  Blueprint, Seating, Mood Board, the supplier workspace) stay open. Residual
  review risk acknowledged: a save-the-date film bought on web still plays in
  the app. If Apple presses on it, the next lever is adding those pages to the
  gate — one line each in `STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS`.

**5.1.2(i) — the cookie banner read as tracking.** Apple's remedy for an app
that does not track is to *remove the prompt*. `cookie-consent-banner.tsx`
never renders inside the Capacitor shell and writes no choice; since
`analyticsAllowed()` is false while undecided, PostHog never initialises there
either. Desktop keeps the banner (not store-reviewed). We do not track: PostHog
is first-party, consent-gated, no ad/broker sharing — the App Privacy answer is
"Data Not Used to Track You".

**5.1.1(v) — account deletion.** Already shipped 2026-06-11 (`Delete my
account` → `requestAccountDeletion`, profile page, admin-completed ≤24h; Apple
permits a processing window). The reviewer's screenshot is the sign-in page —
they never got in. No code change; the fix is a demo account + a physical-device
screen recording of the flow in Review Notes (owner).

**Tests** — `lib/store-shell.test.ts` (10): shell-vs-desktop from the REAL
`capacitor.config.ts` and `tauri.conf.json` values; hidden set derived from the
catalog (a new paid add-on fails here); route gate covers every hidden key;
every `page.tsx` that imports `InlineCheckoutDrawer` is gated or on a named
free-tool allowlist.

SPEC IMPACT: DECISION_LOG row 2026-09-05 — store shell = planning + guests +
supplier bookings only until IAP (v1.1); desktop exempt; cookie prompt removed
in-shell. Updates the 2026-06-25 "hide in-app digital checkout" posture, which
Apple has now measured as insufficient.
