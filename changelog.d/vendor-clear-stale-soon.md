## 2026-07-01 · fix(vendor-benefits): clear 4 stale "Soon" flags for already-shipped features

A code-grounded audit of the 20 vendor "Soon" benefits against origin/main found
four that are fully built, reachable, and in use today — the overlay was
mislabeling them "Soon". Cleared the flags so the pop-up tells the truth:

- **Automated bookings** — the accept→priced-`event_vendors`→milestone-snapshot
  pipeline ships (`respond_vendor_proposal` + `finalizeVendor`); bookings /
  proposals / funnel routes are live.
- **Change-order trail** — migration `20270320861005` ships the
  `vendor_change_orders` propose→accept/decline state machine that settles into
  `event_vendor_line_items`, wired to both the vendor Clients route and the
  couple workspace.
- **Day-of run-of-show & handover** — migration `20270321980372` ships the
  advanceable run-state timeline + `booking_handovers` deliver/acknowledge loop.
- **Featured in Real Wedding Stories** — public `/realstories` showcase with
  credited-vendor chips deep-linking to `/v/[slug]`, plus a vendor "Featured in
  Real Stories" surface with backlink share.

SPEC IMPACT: none — a copy/flag correction; no schema/SKU/price change. The full
20-feature reconciliation (4 live / 1 dormant / 7 partial / 8 not-built) is logged
in the corpus decision-log for the follow-on build waves.
