## 2026-06-29 · feat(vendor): Peso-Per-Lead Scorecard (Wave 6 unit economics)

New vendor benefit surfacing per-vendor unit economics — what a cycle costs in
token answers + subscription, measured against booked couples and answered
leads — on the vendor subscription page and an admin platform-wide view.

- **Migration** `20270322391018_peso_per_lead_scorecard.sql` — two SECURITY
  DEFINER reporting functions (no new tables):
  - `vendor_peso_per_lead(p_vendor_profile_id, p_period_days)` — a vendor's OWN
    scorecard for a trailing window. Ownership-gated EXACTLY like
    `unlock_vendor_event` / `confirm_vendor_payment`
    (`vendor_profiles.user_id = auth.uid()`). Returns `SUM(tokens_burned)` from
    `vendor_event_unlocks`, leads answered (count of unlocks), paid-subscription
    PHP from `vendor_subscriptions`, and lifetime `finalized_booking_count`.
  - `admin_peso_per_lead_overview(p_period_days)` — one row per active vendor,
    `is_console_admin()`-gated.
  - Both `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`. Idempotent
    (`CREATE OR REPLACE`). Period clamped 1–730 days. Dry-run verified via
    `BEGIN…ROLLBACK` against prod (functions compile, JOINs run).
- **`lib/vendor-peso.ts`** — reader that calls the RPCs and assembles
  cost-per-booked-couple + cost-per-lead. The ₱/token price is **read from the
  admin-managed `TOKEN_PRICE_PHP`** in `lib/v2/region-token-burn.ts` (NOT
  hardcoded) and multiplied against the token counts the RPC returns, so the
  price has one source of truth. Subscription spend arrives as real PHP.
- **Vendor surface** — `PesoPerLeadCard` on `/vendor-dashboard/subscription`:
  "you spent ₱X tokens + ₱Y subscription this cycle = ₱Z per booked couple."
- **Admin surface** — `PesoPerLeadAdminCard` on `/admin/insights`: platform
  blended ₱/booked-couple + per-vendor table for watching vendor ROI/retention.
- **Behavioral honesty (pilot reality):** token burn-on-answer is *economically
  inert* in the pilot — the `consume_vendor_assets` call on the unlock path is a
  deliberate post-pilot activation (see `region-token-burn.ts`), so
  `SUM(tokens_burned)=0` in prod today. Both surfaces report token spend as **₱0
  and cost-per-lead as ₱0 "until burn-on-answer is activated"** rather than
  fabricating spend or implying free paid-leads. Subscription spend is real.

SPEC IMPACT: None. Reporting-only feature over existing token/subscription
ledgers; no pricing, SKU, schema-rename, or locked-decision change. Token price
and tier prices remain DB/admin-managed and are read, never set.
