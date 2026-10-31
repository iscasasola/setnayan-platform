## 2026-10-31 · feat(push): real phone notifications inside the iPhone app (APNs)

Owner, verbatim: *"Yes. The notification on the phone not on the app."* Web Push
never reaches inside the iOS app's WKWebView, so the Capacitor app now gets native
push. Stacked on `claude/rsvp-on-the-phone` (the one push template).

- **[migration]** `20271300404545_push_subscriptions_carry_apns_device_tokens.sql`:
  `push_subscriptions.kind` ('web' | 'apns', default 'web'); `p256dh`/`auth` may be
  null for an 'apns' row (a CHECK keeps 'web' rows whole). RLS unchanged (owner
  policies cover the new rows); erasure unchanged (`push_subscriptions` is already
  purged by `user_id`). NOT applied — the pipeline pushes it.
- **Server channel** `lib/apns.ts` + pure `lib/apns-request.ts`: HTTP/2 to Apple with
  an ES256 provider token signed by the .p8 key from `APNS_KEY_P8` · `APNS_KEY_ID` ·
  `APNS_TEAM_ID` · `APNS_BUNDLE_ID` · `APNS_ENV`. Any missing → a quiet no-op
  (`isApnsConfigured`), like Web Push without VAPID. Same `PushMessage` as Web Push
  (title, body, badge, `url`), `apns-collapse-id` = the template's collapse key
  (`rsvp:<eventId>`), `apns-priority` from its level (`lib/push-levels.ts`), dead tokens
  pruned. The funnel (`lib/push-send.server.ts`)
  sends every notice to both channels; `sendWebPush` now sends only to 'web' rows.
- **The app's Yes**: the same one-time ask on Guests, inside the app, runs iOS's own
  prompt → APNs registration → `savePushSubscription({ apnsToken })` (kind 'apns'; the same action, because the
  server-action budget is at its ceiling). Shown only on a
  build that announces `SetnayanPush/1` and carries the plugin, only while iOS has
  not been answered. `NativePushRouter` (root layout) opens a tapped notification's
  own screen and refreshes an allowed phone's token on launch — it never prompts.
- **iOS project**: `@capacitor/push-notifications@8.1.3` (Capacitor 8; released
  2026-10-02), `cap sync` added it to `CapApp-SPM/Package.swift`; `AppDelegate`
  forwards the device token / failure to Capacitor; `App.entitlements` gains
  `aps-environment`; the iOS user-agent gains `SetnayanPush/1` (iOS only).
- Guards, each sabotaged red then restored: `the-iphone-app-gets-real-push`,
  `apns-request`, `reply-push-ask` (native branch), db
  `an-iphone-token-is-a-push-subscription`.

⚠ Needs the OWNER: an Apple push key pasted into Vercel, and a new app build
(1.0 build 8) through App Review — steps in the PR body. Until both, nothing sends.

SPEC IMPACT: DECISION_LOG row "2026-10-31 · GUEST REPLIES GO TO THE PHONE…" covers
it (corpus b6a95cb1); no new decision.
