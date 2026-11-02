## 2026-06-30 · feat(vendor/crm): import an outside client is now FREE

Owner lock 2026-06-30: importing/syncing an off-app client is **free** — it's the
free CRM on-ramp + viral acquisition engine (maps the whole wedding's vendor
roster in; the couple gets free wedding-management), not a revenue line. Retires
the 1-token import fee, which was also the only Free-tier token sink.

- New migration `20270303000000_external_client_import_free.sql` — `CREATE OR
  REPLACE FUNCTION public.import_external_client(...)` with the
  `consume_vendor_assets_per_voucher` 1-token burn removed. Block insert,
  ownership/pool/date validation, and the `{status:'ok', block_id, …}` return
  shape are byte-identical; `tokens_burned` is now always 0. Because nothing
  burns, the RPC can no longer RAISE `INSUFFICIENT_WALLET_BALANCES`.
- `lib/vendor-tier-caps.ts` — `importCustomerTokenCost` set to 0 on all five
  tiers (field kept for matrix shape; it was never read for gating).
- `calendar/actions.ts` — `importExternalClient`: dropped the dead
  `INSUFFICIENT → no_tokens` branch (now `save_failed` only); doc comments
  updated.
- `calendar/page.tsx` + `clients/page.tsx` — UI copy "· 1 token" / "Costs 1
  token" → "free"; removed the now-unreachable `no_tokens` notice + its "Get
  tokens" link.

Scope note: the separate connection/resync 1-token burn (`unlock_vendor_event`,
shown on the messages surfaces as "accepting costs just 1 token") is a different
mechanism and is intentionally left unchanged — only *import* was made free.

SPEC IMPACT: Vendor token model — import is no longer a token sink (Free tier now
has no token sink). Logged in DECISION_LOG.md (2026-06-30) + memory
project_setnayan_vendor_token_model / project_setnayan_vendor_import_crm_workstream.
