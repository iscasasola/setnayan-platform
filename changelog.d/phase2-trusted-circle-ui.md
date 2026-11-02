## 2026-07-05 · feat(vendors): staged Phase-2 trusted-circle vendor badge (flag-off)

Add a reusable `TrustedCircleBadge` async server component
(`app/dashboard/[eventId]/vendors/_components/trusted-circle-badge.tsx`) that
renders a compact "Trusted by your circle" panel — naming explicit 1st-degree
vouchers or the min-N-gated connected aggregate, with an optional review-rating
and near-match context line. Mounted once on the per-service vendor workspace
(`app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`), just above
the existing Marketplace-info block, fed the true `vendor_profiles` id via
`ev.marketplace_vendor_id` (never the `event_vendors` PK).

COUNSEL-GATED · FLAG-OFF · PRODUCTION-INERT. Reuses the existing
`getTrustedCircleVendorSignal` read layer, which is gated by
`NEXT_PUBLIC_PEOPLE_CONNECTIONS` (the shared Phase-2 people-connections flag,
OFF in prod). While the flag is off the signal is `null` WITHOUT any DB read, so
the badge returns `null` and there is zero visible change in production. It also
returns `null` for non-hosts and whenever there's no explicit circle trust. No
flag was flipped; no schema or spec change.

SPEC IMPACT: None.
