## 2026-06-22 · feat(integrations): Maya/PayMaya checkout credentials are now DB-first / no-redeploy (Integration Console PR4c)

The owner can set the Maya automated-checkout credentials (Branch B) from `/admin/integrations` without a redeploy. Branch B is **dormant** in prod (gated on the build-time `NEXT_PUBLIC_MAYA_STATUS=APPROVED` flag, which this PR does **not** touch — activation still needs a redeploy; this PR only moves the credentials).

- **Migration `20270213845820`** — `maya_public_api_key_enc` + `maya_secret_api_key_enc` (BOTH secrets — they form the HTTP Basic-auth pair; the "public" key is a server-only merchant credential, treated as a secret) on the deny-by-default secrets table; `maya_checkout_endpoint` (non-secret config) on `platform_settings`. Idempotent; no RLS change.
- **`lib/integration-config.ts`** — `resolveMayaConfig()` → `{publicKey, secretKey, checkoutEndpoint}`, DB-first / env-fallback (endpoint defaults to the sandbox URL, byte-identical to the route's prior default). Never throws.
- **`app/api/v1/billing/initialize-maya/route.ts`** — Branch B reads come from `resolveMayaConfig()`; the missing-creds 503 guard + the `Basic base64(public:secret)` header are preserved. `MAYA_APPROVED` (build-time gate) untouched; Branch A (manual QR) untouched.
- **`registry.ts`** — `MAYA_INTEGRATION` metadata (column allowlist) + both secret columns added to `ALL_SECRET_COLUMNS` (presence map).
- **`actions.ts`** — `saveMayaConfig` (requireAdmin; each key encrypted + written only when non-blank = keep-current; endpoint http(s)-validated → `invalid_config`) + `clearMayaSecrets`.
- **`_components/maya-card.tsx`** — bespoke **2-secret** card (Maya breaks the single-secret card shape) + a "Payments" console section.

**Live-neutral** — byte-identical to the env reads when the DB columns are empty; Branch B stays dormant. **2-lens adversarial review (payment-correctness · security/UI) — PASS** (lone nit: endpoint written unconditionally = the same prefill-keep contract as the OAuth/Resend config fields; documented). tsc 0 · lint clean. Migration **applied to prod** via pg-direct (`supabase db push` still drift-blocked by parallel-session ledger; columns confirmed live, ledger self-records on the next clean push).

SPEC IMPACT: DECISION_LOG row (2026-06-22) + memory `project_setnayan_integration_activation_console`. No SKU change.
