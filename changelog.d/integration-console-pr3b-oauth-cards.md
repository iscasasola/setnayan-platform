## 2026-06-22 · feat(integrations): OAuth console cards — set YouTube / Drive / TikTok from /admin/integrations (Integration Console PR3b)

The write UI for PR3's OAuth plumbing. The owner can now set each OAuth client's secret + config from `/admin/integrations` with no Vercel redeploy.

- **`lib/integrations/registry.ts`** — `OAUTH_INTEGRATIONS` card metadata (the column allowlist) + `getOAuthIntegration()` + `ALL_SECRET_COLUMNS` (unions the simple-secret + OAuth secret columns).
- **`app/admin/integrations/actions.ts`** — `saveOAuthConfig` / `clearOAuthSecret` (requireAdmin-gated; id + columns validated against the registry allowlist; secret encrypted, written only when non-blank, never echoed; redirect URIs validated as http(s) URLs → invalid input redirects to an error banner, no write).
- **`app/admin/integrations/_components/oauth-card.tsx`** — generic OAuth card (masked secret field + config text fields + per-provider guidance; clear-secret form is a sibling, not nested).
- **`app/admin/integrations/page.tsx`** — renders one card per OAuth integration; `settingsRes` reads `'*'` on the world-readable `platform_settings` (no secret there) to pre-fill config fields; an `?error=invalid_redirect_uri` banner.
- **`lib/integration-config.ts`** — `getSecretPresenceMap` now covers the OAuth secret columns via `ALL_SECRET_COLUMNS` (returns booleans only — ciphertext never enters the render tree).

No migration (columns shipped in PR3 `20270212398962`). **Live-neutral:** all three OAuth integrations remain dormant until the owner enters credentials; resolvers stay DB-first / env-fallback.

**Verified:** `tsc --noEmit` 0 · `next lint` clean. **2-lens adversarial review (security/data-flow · UI/forms) — PASS.** Findings addressed: redirect-URI validation added; the env-value-persisted-on-save behavior is kept **for parity with the shipped Resend card** (per reviewer); the per-card cast hoisted.

SPEC IMPACT: DECISION_LOG row (2026-06-22) + updates memory `project_setnayan_integration_activation_console` (PR3b shipped; PR4 = live/revenue remains). No SKU/spec change.
