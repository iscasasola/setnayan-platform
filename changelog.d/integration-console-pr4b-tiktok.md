## 2026-06-22 · feat(integrations): TikTok auto-publish token is now DB-first / no-redeploy (Integration Console PR4b)

Completes the social-publish trio (Facebook + Instagram landed in PR4a). The TikTok master-account auto-post token is now settable from `/admin/integrations` with no redeploy. The TikTok auto-post adapter is **dormant** in prod (gated on a token present AND a Content-Posting-API audit), so this is not a live-path change.

- **Migration `20270213540123`** — `tiktok_access_token_enc` (secret, deny-by-default `platform_integration_secrets`, AES-256-GCM). Distinct from the TikTok **OAuth client secret** (`tiktok_client_secret_enc`, PR3 — the per-couple Patiktok flow).
- **`lib/integration-config.ts`** — `resolveTikTokAccessToken()` (DB-first, env-fallback to `TIKTOK_ACCESS_TOKEN`, uncached).
- **`lib/social/tiktok.ts`** — `isTikTokConfigured()` sync→async; `postPhotoToTikTok` resolves the token at entry. NEVER-THROWS preserved.
- **`lib/social/flush.ts`** + **`/admin/social-queue`** — the `ttLive` gate + banner await the now-async check. (Meta's fb/ig gates were already awaited in PR4a.)
- **`registry.ts`** — `SOCIAL_INTEGRATIONS` gains `tiktok_social` (single secret, no config) → renders in the "Social publishing" console section automatically.

**Live-neutral** (byte-identical to the env read when the column is empty; the adapter stays inert until a token is set + the audit clears). tsc 0 · lint clean. Migration **applied to prod** (pg-direct — `supabase db push` is still blocked by transient parallel-session ledger drift; columns confirmed live, ledger self-records on the next clean push).

SPEC IMPACT: DECISION_LOG row (2026-06-22) + memory `project_setnayan_integration_activation_console`. No SKU change.
