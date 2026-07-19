## 2026-07-01 · feat(vendor-dashboard): rebuild the Overview page to the finalized prototype

Rebuilt `/vendor-dashboard` (the vendor Overview root route) to the finalized
6-menu-shell prototype, in the editorial `--m-*` palette. The Overview is now a
DECISION SURFACE — "What needs you today — <weekday, date>." — instead of the
prior stat-tile board. Every number is wired to a LIVE source (no mockup sample
values); where a source has no vendor-readable path yet, the section renders a
clearly-labelled empty state rather than a fabricated figure.

- **"What's new" decision feed (centrepiece).** One card per act-on-now item,
  each with a left color accent + action buttons:
  - New inquiry — pending `chat_threads` (`fetchVendorThreads`, vendor RLS). The
    ◎N Accept cost is the customer's event-location band via
    `regionBurnTokens(events.region)` (`lib/v2/region-token-burn`). `[Accept ◎N]`
    posts to the existing `acceptInquiry` server action (burns the region-banded
    unlock); `[Decline]` posts to `declineInquiry`. Both `return_to=/vendor-dashboard`.
  - Lock request — `event_vendors` rows with `deposit_recorded_at` set +
    `deposit_acknowledged_at` NULL (admin-scoped to the vendor's own
    `marketplace_vendor_id`; event_vendors is couple-RLS). `[Confirm lock]` posts
    to the existing `vendorAcknowledgeDeposit` action; `[View]` deep-links the
    client brief.
  - New 5-star review — `vendor_reviews` with `rating_overall=5` +
    `vendor_reply` NULL (`fetchReviewsForVendorWithCouple`). `[Reply]` deep-links
    `/vendor-dashboard/reviews#reply_<id>`.
  - Delivery delay flagged — `booking_handovers.status='disputed'` (vendor-read
    RLS). `[Open]` links the client brief. Fail-soft if the table is absent.
- **Amber note** — the token-cost-follows-event-location explainer (◎2 Batangas,
  ◎3 NCR · "You only spend when you Accept.").
- **"Ongoing" open tasks** — checkbox rows + label + due chip ("Awaiting you N
  days") + "Open ›". Sourced from unanswered pending inquiries + unconfirmed lock
  requests + `draft` `vendor_contracts` still to send.
- **"Upcoming schedules" · Next 5 · Open calendar** — the next 5 booked events by
  date from `vendor_schedule_pool_bookings` (`fetchVendorPoolBookings`), enriched
  with place (venue else region `display_label`) + the vendor's primary service
  category. Date-block + couple + place·category + "in N days".

New: `lib/vendor-overview.ts` (server-only data assembly, all reads fail-soft),
`app/vendor-dashboard/_components/overview-sections.tsx` (presentational
sections). The role-aware agent/no-profile landings are preserved. The retired
stat-tile Overview's deeper surfaces (customer mix · shortlist radar · journal)
stay reachable from the 6-menu sidebar + `/more`.

Verified: `pnpm run typecheck` (clean), ESLint on all 3 changed files (0
errors), `lint:navicon` + `lint:retired`, and a full production build (exit 0 ·
`/vendor-dashboard` compiles as a dynamic route).

SPEC IMPACT: None. (Prototype fidelity + live-data wiring only — no pricing, SKU,
schema, or product-decision change. Reuses existing queries, RPCs, server
actions, and the region-band token-cost helper.)
