## 2026-06-29 · feat(vendor-stats): wire vendor_activity_stats recompute invocation (Soon-benefits P1)

Prerequisite **P1** of the "Soon" vendor-benefits build plan
(`03_Strategy/Vendor_Benefits_Soon_Build_Plan_2026-06-29.md`). The recompute
itself (`recomputeVendorActivityStats` / its fire-and-forget wrapper
`triggerVendorActivityRecompute`, `apps/web/lib/vendor-activity.ts`) and the
`vendor_first_reply_at` feed (migration `20270110320018`) were already shipped —
the missing piece was the **invocation**. Wired `after(() =>
triggerVendorActivityRecompute(vendorProfileId))` (cron-free per the no-pollers
lock; runs post-response, swallows its own errors) at the five transitions that
actually move the stats:

- **First vendor reply** — `sendChatMessageCore` (`apps/web/lib/chat-send.ts`),
  the exact moment `avg_response_minutes` / `response_rate_pct` become
  computable. Shared by the web action AND the native send route, so both paths
  refresh.
- **Inquiry accept** — `acceptInquiry` (`apps/web/lib/chat-actions.ts`).
- **Booking status change** — `updateVendorStatus`, `finalizeVendor` (→ first
  `contracted` FINALIZED state), and the `revertVendorToConsidering` downgrade
  (`apps/web/app/dashboard/[eventId]/vendors/actions.ts`), all gated on a
  `marketplace_vendor_id` so only platform-linked bookings recompute.

Gap-check note: the review path (`vendors/[vendorId]/review/actions.ts`) was
already wired, so P1 was partially done; this completes the responsiveness +
conversion signals. Unblocks First-Look Window (Wave 2) and the Data &
Analytics group (Wave 6), which read this table. No schema, no UI, no new deps.
Typecheck clean.

SPEC IMPACT: None — activates an already-specified table
(`vendor_activity_stats`) via existing functions; no schema/SKU/pricing/flow
change.
