## 2026-06-28 · feat(papic): unified hybrid join route (web half)

Added `/papic/join/[token]` — one entry link for every Papic camera QR that
opens the native app directly when it's installed (Universal/App Link) and
forwards into the existing web capture flow everywhere else.

- New route `app/papic/join/[token]/page.tsx`. Resolves the token KIND on the
  admin client (seat → `paparazzi_seats.claim_qr_token`; guest → `guests.qr_token`)
  and forwards to the existing `/papic/claim/[token]` (seat) or `/papic/me/[token]`
  (guest) experiences. No capture UI is duplicated. Honors a `?kind=seat|guest`
  hint, infers it otherwise. Bad/reissued tokens hit a friendly dead-end; no row
  data is ever returned.
- Page-local smart install banner (`AppInstallBanner`) nudging the native app,
  env-gated behind `NEXT_PUBLIC_IOS_APP_STORE_URL` / `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL`
  (degrades to an "available soon" line until the owner publishes). Hidden inside
  the native shell and after a session dismissal. The global site chrome is NOT
  touched.
- Thin interstitial forward (`JoinForwarder` + no-JS `<meta refresh>` + visible
  "Continue" link) so the page stays a valid Universal-Link target and the banner
  paints, while web users still land in the camera fast.
- Scoped `/papic/*` into `apple-app-site-association` (kept the real Team ID
  P95JPDWWB3 + `/dashboard/*`). `assetlinks.json` already covers all URLs via
  `handle_all_urls`; placeholder SHA256 left as-is (needs the owner's release
  keystore).
- New seat-QR helper `papicSeatJoinUrl()`; repointed the couple-side crew QR +
  printable crew-QR pack to it. Legacy `/papic/claim` + `/papic/me` links keep
  working unchanged, so every QR printed before this stays valid.

OUT OF SCOPE (owner-gated): native enrollment / app-store submission, the
Android release keystore SHA256 + Play enrollment, and Apple App Store
submission. No native shell touched — web only.

SPEC IMPACT: None. (No SKU, price, schema, or DB change. Reuses existing seat
claim + guest Limited camera flows. Iteration 0012 Papic — the hybrid join link
is an additive entry point over the already-shipped /claim + /me + /seat routes.)
