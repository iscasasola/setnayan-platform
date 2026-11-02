## 2026-07-11 · fix(billing): Custom vendor tiers lapse on non-renewal

Custom vendor plans never auto-lapsed on non-payment, so every Custom-tier
entitlement — including the new Enterprise Vendor API `api_access` grant and the
composed caps overlay — persisted past the paid 28-day cycle until an admin
manually intervened. Root cause: pay-activation stamped the window only on
`orders.expires_at`, never on `vendor_profiles.tier_expires_at` (left NULL), and
the canonical lapse sweep `sweep_vendor_tier_expiry` (a) only handled
`pro`/`enterprise` and (b) had no runtime caller at all.

Three-part fix:

1. **Stamp the lapse anchor** (`lib/sku-activation.ts`) — the custom pay-activation
   hook now writes `vendor_profiles.tier_expires_at = now+28d`, the same value it
   already writes to `orders.expires_at`. This alone makes API access lapse
   immediately: the gate (`resolveApiVendor` / `userOwnsActiveEnterpriseVendor`)
   already denies a caller whose `tier_expires_at < now` inline, on every request.
   The comp/off-platform lever (`activateCustomPlan`) is deliberately left
   untouched — its NULL expiry is the intentional "never lapses" signal for
   white-glove deals.

2. **Extend the canonical sweep** (new migration `…_custom_plan_lapse_sweep.sql`,
   CREATE OR REPLACE) — `sweep_vendor_tier_expiry` now includes `custom` in the
   past-due guard and, for a lapsed custom vendor, demotes its ACTIVE
   `vendor_custom_plans` row to `lapsed` (the caps overlay + api_access grant both
   key on `status='active'`). Downgrade-only, idempotent, `FOR UPDATE`-serialised
   against concurrent renewal. NULL `tier_expires_at` never lapses.

3. **Wire the orphaned sweep** (`app/vendor-dashboard/layout.tsx`) — the tier sweep
   had no caller, so no tier ever auto-reverted (pro/enterprise included; the app
   relied purely on inline expiry checks). Now invoked post-response via `after()`
   — same non-blocking, cron-free pattern as the token-expiry sweep beside it —
   gated to sweepable paid tiers so free/verified vendors skip the no-op RPC. This
   reverts `tier_state` + demotes the plan so `fetchEffectiveCaps` and every bare
   `tier_state='custom'` reader stop granting Custom ceilings after lapse.

Net: API access hard-lapses immediately (inline gate); tier_state + caps reconcile
on the vendor's next dashboard load. Prod has 0 custom vendors, so no live
exposure. Behaviour change surfaced for sign-off: wiring the sweep also makes
lapsed **pro/enterprise** tiers auto-revert `tier_state` on dashboard load
(previously stale-until-reactivation) — a correctness improvement, not custom-only.

SPEC IMPACT: Custom (and effectively pro/enterprise) tier lapse is now enforced,
not just inline-checked. Closes the api_access-persists gap from the Enterprise
Vendor API review (2026-07-11). DECISION_LOG row appended.
