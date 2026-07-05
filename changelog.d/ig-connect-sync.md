## 2026-07-05 · feat(vendors): connect Instagram + sync posts into the portfolio (inert until Meta configured)

Vendors with a Business/Creator Instagram account can connect it via OAuth
(Instagram Graph API v21.0 · Facebook Login for Business) and manually sync
their recent posts into their public profile's unified Portfolio gallery
(alongside `portfolio_r2_keys` + `gallery_video_links`).

- **New migration** `20270518447173_vendor_instagram_connect_sync.sql` — three
  RLS-enabled tables (RLS at `CREATE TABLE` time):
  `vendor_ig_connections` (one per vendor; access token AES-256-GCM encrypted +
  withheld from the `authenticated` role by column-level GRANT — status only is
  vendor-readable), `vendor_ig_media` (synced posts; images re-hosted in
  `setnayan-media` R2, videos link out; `show_on_profile` toggle; public read of
  shown rows on published vendors), and `vendor_ig_oauth_state` (CSRF nonce,
  service-role only). "Vendor owns their rows" pattern mirrors
  `vendor_services_owner`.
- **OAuth routes** `GET /api/vendor/instagram/connect` + `/callback` mirror the
  panood-youtube flow: CSRF `state` nonce, code→long-lived-token exchange,
  encrypt-at-rest, upsert. Access tokens are never sent to the client, logged,
  or placed in an error message; callback errors are generic codes only.
- **Sync action** `syncInstagramMedia()` — never-throws, caps at latest 20,
  dedupes on `ig_media_id`, re-hosts images to R2, opportunistic token refresh.
- **Vendor UI** — "Instagram" card on `/vendor-dashboard/profile`: Connect
  button (or a "Coming soon" state when Meta is unconfigured), connected
  username + Sync now + last-synced time, synced-media grid with per-item
  show/hide toggle + Disconnect.
- **Public render** — shown IG media added to the unified Portfolio section on
  `/v/[slug]` (photo tiles + video link-outs), keeping the existing style.
- **Fully inert + non-crashing when `META_APP_ID` / `META_APP_SECRET` are unset**
  (they currently are in prod): the connect route returns a friendly 503 and the
  UI shows "Coming soon"; the public loader degrades to `[]`.
- **Deferred (follow-ups):** automatic background/periodic sync (v1 is manual
  "Sync now" only); the token is encrypted at rest via the existing
  `lib/encryption` AES-256-GCM helper (no additional at-rest hardening beyond
  that).

SPEC IMPACT: None
