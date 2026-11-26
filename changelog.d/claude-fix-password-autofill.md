## 2026-11-27 · fix(ios): the app's sign-in offers passwords saved for setnayan.com

- `apple-app-site-association` now lists the app under `webcredentials`.
- `App.entitlements` claims `webcredentials:www.setnayan.com` beside the existing `applinks`.
- The site half is live on deploy; the app half ships in iOS build 10 (build 9 is already uploaded; CURRENT_PROJECT_VERSION 9 → 10).
- Pinned by `lib/the-app-offers-saved-passwords.test.ts`.

SPEC IMPACT: none (platform plumbing; no copy or UI change).
