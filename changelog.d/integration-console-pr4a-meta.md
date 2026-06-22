## 2026-06-22 · feat(integrations): Meta (Facebook + Instagram) auto-publish is now DB-first / no-redeploy (Integration Console PR4a)

The owner can set the Meta publishing credential from `/admin/integrations` with no Vercel redeploy. ⚠ This is the **LIVE auto-publish path** (FB posting is live in prod), so the resolver is DB-first / env-fallback and **byte-identical when the DB is empty** — today's env-configured posting is unaffected.

- **Migration `20270212791181`** — `meta_page_access_token_enc` (secret, deny-by-default `platform_integration_secrets`, AES-256-GCM) + `meta_page_id` + `ig_user_id` (non-secret config on world-readable `platform_settings`). Idempotent; no RLS change. ONE token authorizes both FB + IG.
- **`lib/integration-config.ts`** — `resolveMetaConfig()` (DB-first secret+config, env fallback, uncached; never throws → env on any failure).
- **`lib/social/facebook.ts` + `instagram.ts`** — `isFacebookConfigured()` / `isInstagramConfigured()` sync→async (await `resolveMetaConfig`); `postToFacebookPage` / `postToInstagramFeed` resolve creds at entry. The `resolvePageAccessToken` cache (keyed by the configured token) is preserved, so token rotation still busts it; NEVER-THROWS contract intact.
- **`lib/social/flush.ts`** + **`/admin/social-queue`** — the live dispatch gate + warning banners await the now-async config checks (TikTok's `isTikTokConfigured` stays sync — that's PR4b).
- **`registry.ts`** — `SOCIAL_INTEGRATIONS` (Meta) + `CREDENTIAL_INTEGRATIONS` union; `getOAuthIntegration` searches the union; `ALL_SECRET_COLUMNS` covers Meta. Added a data-driven `validate` field (`url` / `numeric`) on config fields — redirect URIs validate as http(s), Meta IDs as numeric — replacing the old `redirect_uri`-substring heuristic in `saveOAuthConfig` (review hardening: these flow into live OAuth redirects + Graph URL paths).
- **`/admin/integrations`** — a "Social publishing" card (reuses `OAuthCard`); the config-error banner generalized to `invalid_config`.

**Live-neutral:** Meta posting keeps using the `META_*` env values until the owner enters DB creds. **3-lens adversarial review (live-regression · security · module-graph) — all PASS; no real regression.** tsc 0 · lint clean.

⚠ **Migration apply DEFERRED:** `supabase db push` is currently blocked by transient parallel-session ledger drift (prod ledger has `20270212405352` + `20270212992703`, whose files aren't on `main` yet). The code is graceful without the columns (env fallback + the Meta card stays dormant), so this is safe to merge; the migration applies on the next clean `supabase db push` once the drifted files reach `main`.

SPEC IMPACT: DECISION_LOG row (2026-06-22) + updates memory `project_setnayan_integration_activation_console`. No SKU change.
