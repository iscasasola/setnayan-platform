## 2026-07-01 · feat(vendors): admin token grant → a specific teammate

Owner 2026-07-01 ("buy"): mirror the buy flow on the Setnayan-staff GRANT screen.
The admin token-grant form (`/admin/vendors/[id]/tokens`) now has a **"Credit to"**
picker — Founder (default) or any teammate.

- Founder → unchanged: the store's expiring earned-voucher wallet via
  `grant_admin_direct_tokens`.
- A non-founder member → their **personal purchased balance**
  (`vendor_member_token_wallets`, never-expire, non-transferable) via new
  `grant_member_purchased_tokens` RPC (migration `20270402296556`). DEFINER-only,
  membership-checked, idempotent on the shared `token_grants_log.idempotency_key`.

`admin_audit_log` records `recipient_user_id` + `recipient_kind`
(`founder_earned` | `member_purchased`). Picker only renders for claimed vendors
with ≥1 non-founder teammate.

SPEC IMPACT: extends the personal-token model (see DECISION_LOG 2026-07-01 +
`project_setnayan_vendor_org_governance` / `project_setnayan_vendor_token_model`).
Note the deliberate asymmetry: founder grants expire (45-day voucher), member
grants don't (personal purchased bucket has no voucher/expiry machinery).
