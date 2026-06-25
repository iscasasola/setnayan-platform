## 2026-06-25 · perf(vendor-payments): batch the per-vendor payment-plan lookup (N+1 → 1)

Reliability/perf sweep finding (decision-free). `fetchPendingVendorPayments` (`lib/vendor-service-payment-schedules.server.ts`) resolved installment labels by firing one `event_vendor_payment_plan` query PER unique vendor inside a `Promise.all(uniqueVendorIds.map(...maybeSingle()))` — N round-trips on the vendor message-thread page. Replaced with ONE batched `.in('event_vendor_id', uniqueVendorIds)` read (now selecting `event_vendor_id` so the rows can be keyed), building the same `planByVendor` map. Behaviour identical — a vendor with no plan row is simply absent from the map, and the existing `planByVendor.get(...)?.get(...)` optional-chain already yields the same null label as the old empty-map path.

SPEC IMPACT: None.
