## 2026-11-23 · feat(supplier analytics): the Supplier Store drawing's new graphs, 12 of 13

The Supplier Store drawing (`prototypes/supplier_store_graphs_badges_2026-11-23/`; DECISION_LOG 5a8c6bf3 "every graph reads a real table", 022681cf "every graph is free") adds 13 graphs to the one Analytics carousel. **12 are built.** Each is the shipped `GraphCard` tile: honest read, faded Example when there is nothing yet, "Couldn’t load." when the read is refused. Each sits at the END of `CARD_ORDER` and is marked New.

- **Built:**
  - New followers (`vendor_follows`)
  - Saved by guests (`guest_saved_vendors`, counts only)
  - Your most viewed photos (`vendor_portfolio_photo_view_days`, only photos still on the page)
  - When couples ask (`vendor_inquiry_heatmap`)
  - Inquiries you missed (`vendor_inquiry_missed`)
  - Booked value (the section's own `vendor_booking_monthly_series`, never read twice)
  - Paid and still owed (the payday read → `moneyPicture`, Clients › Money's own picture)
  - How far ahead couples book (`vendor_lead_time`)
  - What you celebrate (`vendor_completed_events` → `eventsByKind`)
  - Reviews month by month (`vendor_review_monthly`)
  - Your stars, part by part (`vendor_reviews` part ratings)
  - Reviews you replied to (`vendor_review_coverage`)
- **Not built: Albums opened.** No data yet. `vendor_album_opens` keeps only the shop's own people's last open, not couples' opens. It needs a per-couple album-open counter.
- **Honest single reads:** `fetchInquiryMissed`, `fetchInquiryHeatmap`, `fetchLeadTime`, `fetchReviewCoverage`, `fetchReviewMonthly` and `readVendorCompletedEventTypes` return null when the read is refused. The older bundles fold a refusal into an empty shape. The bundles and the single reads share one row mapper each. `heatGrid` has one home (`lib/vendor-inquiry-analytics.ts`).
- **Files:**
  - New: `lib/vendor-store-graphs.ts` (pure words and buckets), `lib/vendor-store-graphs.server.ts` (reads, one `Promise.all`) and `performance/_components/store-graphs.tsx` (the cards).
  - `FIXED_WINDOW` takes the 8 fixed-window graphs' labels.
- **Guards:**
  - `lib/vendor-store-graphs.test.ts`
  - `performance/the-store-graphs-are-honest.test.ts`
  - the CARD_ORDER pin in `shop/analytics-is-the-carousel.test.ts`, which now includes the 12.
- No migration, no table, no server action.

SPEC IMPACT: None. This builds the approved drawing on existing tables. "Albums opened" waits for a counter.
