## 2026-07-05 · feat(vendors): connect Instagram + sync posts into the portfolio (inert until Instagram app configured)

Vendors with a Business/Creator Instagram account can connect it via OAuth
(**"Instagram API with Instagram Login"** — Instagram Graph API on
api/graph.instagram.com, **no Facebook Page required**, better for PH vendors)
and manually sync their recent posts into their public profile's unified
Portfolio gallery (alongside `portfolio_r2_keys` + `gallery_video_links`).

**OAuth flow wired (Instagram Login):**
- Authorize → `https://www.instagram.com/oauth/authorize` · `response_type=code`
  · scope `instagram_business_basic`.
- Code → short-lived token → `POST https://api.instagram.com/oauth/access_token`
  (form-urlencoded).
- Short-lived → long-lived (~60d) →
  `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token`.
- Refresh helper → `graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`
  (wired for later; the sync refreshes opportunistically within 7 days of expiry).
- Profile → `graph.instagram.com/me?fields=user_id,username`.
- Media → `graph.instagram.com/me/media?fields=…` (token-scoped, no Page walk).
- **Callback path is UNCHANGED** — `/api/vendor/instagram/callback`.

**Env vars (owner must set both to arm the feature):** `IG_APP_ID` +
`IG_APP_SECRET` — the Instagram app's OWN id/secret (was `META_APP_ID` /
`META_APP_SECRET`; the old Facebook Login for Business flow with
`instagram_basic` + `pages_show_list` and the `me/accounts` Page walk is
removed). `META_IG_OAUTH_REDIRECT_URI` optional override, unchanged.

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
  button (or a "Coming soon" state when the Instagram app is unconfigured),
  connected username + Sync now + last-synced time, synced-media grid with
  per-item show/hide toggle + Disconnect.
- **Public render** — shown IG media added to the unified Portfolio section on
  `/v/[slug]` (photo tiles + video link-outs), keeping the existing style.
- **Fully inert + non-crashing when `IG_APP_ID` / `IG_APP_SECRET` are unset**
  (they currently are in prod): the connect route returns a friendly 503 and the
  UI shows "Coming soon"; the public loader degrades to `[]`.
- **Deferred (follow-ups):** automatic background/periodic sync (v1 is manual
  "Sync now" only); the token is encrypted at rest via the existing
  `lib/encryption` AES-256-GCM helper (no additional at-rest hardening beyond
  that).

SPEC IMPACT: None
