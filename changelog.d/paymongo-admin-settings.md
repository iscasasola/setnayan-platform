## 2026-07-23 · feat(admin): PayMongo credentials — admin-uploadable, applied live

An admin card at `/admin/integrations` to paste the PayMongo keys, stored encrypted
and resolved **DB-first** so they apply **live with no redeploy** (owner ask). Mirrors
the existing Maya credential pattern exactly.

- **Migration `20270917976646`** — `paymongo_secret_key_enc` + `paymongo_webhook_secret_enc`
  on the deny-by-default singleton `platform_integration_secrets` (AES-256-GCM via
  `lib/encryption.ts`; RLS unchanged — service-role-only).
- **`lib/integrations/registry.ts`** — `PAYMONGO_INTEGRATION` (column allowlist) +
  the two columns added to `ALL_SECRET_COLUMNS` (presence map).
- **`lib/integration-config.ts`** — `resolvePaymongoConfig()`: DB-first, per-decrypt
  try/catch, env fallback (`PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET`),
  UNCACHED so a just-pasted key takes effect next request.
- **`lib/paymongo.ts` + `app/api/webhooks/paymongo/route.ts`** — read via the
  resolver instead of raw `process.env` (`isPaymongoConfigured` is now async).
- **Admin card + actions** — `paymongo-card.tsx` (two masked, never-echoed secret
  fields, blank = keep) + `savePaymongoConfig` / `clearPaymongoSecrets`
  (`requireAdmin`, encrypt, upsert to id=1). Card shows the webhook URL to register.
- **`/admin/integrations/page.tsx`** — renders the card next to Maya.

⚠ Credentials make the **rail** work live; the fee still won't ENFORCE until the
booking-fee flags are on (`NEXT_PUBLIC_BOOKING_FEE_ENABLED` + `_RAIL_LIVE`) — a
follow-up can fold that into the same card as a toggle. `tsc` clean; migration
doctor healthy. Stacked on the PayMongo core (#3575).

SPEC IMPACT: None (implements admin-managed PayMongo credentials). DECISION_LOG 2026-07-23.
