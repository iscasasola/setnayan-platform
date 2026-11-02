## 2026-06-22 · feat(integrations): OAuth trio is now DB-first / no-redeploy (Integration Console PR3)

Makes the OAuth **client config** of the three dormant OAuth integrations settable without a Vercel redeploy: **Panood YouTube**, **Google Drive** (shared by Papic + Photo Delivery), and **Patiktok TikTok** (path A). The client secret reads DB-first (encrypted), client id/key + redirect URI read DB-first (non-secret), each falling back to its existing env var — byte-identical when the DB is empty. This is the PR3 **mechanism**; the console cards that write these land in PR3b.

- **Migration `20270212398962`** — 3 encrypted client-secret columns on the deny-by-default `platform_integration_secrets` (`youtube_oauth_client_secret_enc`, `google_drive_oauth_client_secret_enc` [shared], `tiktok_client_secret_enc`) + 7 non-secret config columns on world-readable `platform_settings` (client ids/keys + redirect URIs, incl. the distinct `photo_delivery_oauth_redirect_uri`). Idempotent; **no RLS change**.
- **`lib/integrations/registry.ts`** — `OAUTH_SPECS` (column/env single source of truth for the resolver + the PR3b cards). Google Drive modeled as two specs (`drivePapic` / `drivePhotoDelivery`) sharing secret+client-id, differing only on redirect URI.
- **`lib/integration-config.ts`** — `resolveOAuthClientConfig(spec)` (DB-first secret + config, env fallback, uncached; nested try/catch so a missing admin client OR bad ciphertext OR empty column all fall through to env).
- **4 getters → async DB-first**, return shape unchanged: `getYoutubeOAuthConfig`, `getDriveOAuthConfig`, `getPhotoDeliveryOAuthConfig`, `getTiktokOAuthConfig`. TikTok's `ready` shape gained `clientSecret` so the token-exchange callback uses the **resolved** secret instead of re-reading `process.env.TIKTOK_CLIENT_SECRET` directly.
- **~19 call sites flipped to `await`** across `app/api/oauth/*`, `app/api/tiktok/*`, `app/api/cron/oauth-refresh`, `lib/panood-broadcast.ts`, `lib/photo-delivery-release.ts`, `lib/drive-copy.ts`, and 4 studio dashboard pages (two inline `.ready` uses hoisted/awaited).

**Live-neutral:** all three OAuth flows are dormant in prod (env unset → `ready:false`), and DB-empty resolves to the same env values → behavior identical.

**Verified:** `tsc --noEmit` 0 (validates every `await` — a missed one is a `.ready`-on-`Promise` type error); `next lint` clean; completeness sweep shows zero remaining sync getter calls + zero stray client-secret env reads. **3-lens adversarial review (completeness/byte-identical · security/migration · module-graph) — all PASS, zero findings.** All 4 getter libs are `server-only` and confirmed to have no `'use client'` / `scripts/` importer.

**Scope:** PR3b = the OAuth console cards (write the DB values). PR4 = live/revenue (Meta FB auto-publish · Maya · TikTok social token · R2 public URL · VAPID).

SPEC IMPACT: DECISION_LOG row (2026-06-22) + updates memory `project_setnayan_integration_activation_console`. No SKU/spec change.
