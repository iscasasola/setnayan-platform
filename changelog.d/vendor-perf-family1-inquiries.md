## 2026-07-01 · feat(vendor): My Performance · Inquiry-handling analytics (Phase B family 1)

Adds the first Phase B own-business analytics family to `/vendor-dashboard/performance`
(Pro tier · `canSeePerformanceAdvanced`, flag-dark). All four reads are
own-business only — every RPC filters to the caller's own `vendor_profile_id`,
so no other business's inquiries are ever visible. Column set was
schema-discovery-mapped and adversarially verified against the shipped
migrations before writing a line of SQL.

**Migration** `20270421213000_vendor_inquiry_analytics_rpcs.sql` — four SECURITY
DEFINER, STABLE, ownership-gated RPCs (gate mirrors `vendor_booking_monthly_series`):
- `vendor_inquiry_reply_stats` — first-reply latency distribution (answered
  count + p50/p90/avg minutes) over `chat_threads.vendor_first_reply_at`.
- `vendor_inquiry_missed` — slipped leads: declined + unanswered-past-SLA
  (`inquiry_status='pending'` AND no reply AND older than an app SLA window) +
  self-reported `inquiry_outcomes.outcome='no_response'` + `vendor_date_waitlist`
  date-conflict queue. Labelled a floor, not a census (SLA is a threshold, not a
  stored state; no_response is opt-in).
- `vendor_inquiry_heatmap` — inquiry arrival by weekday × hour (Asia/Manila).
- `vendor_token_efficiency` — `SUM(vendor_event_unlocks.tokens_burned)` vs
  bookings won (unlocked events that became booked `event_vendors`), and
  tokens-per-won. Uses `vendor_event_unlocks` as the single burn source (not
  also `token_redemptions_log` — that would double-count).

**Reader** `lib/vendor-inquiry-analytics.ts` — bundles the four RPCs (internal
Promise.all), each degrading to an empty shape on error. **Card**
`InquiryHandlingCard` — reply-time tiles + tokens/booking-won + slipped-leads
breakdown + a weekday×time-of-day heatmap; server component, honest empty states.
**Page** — new "Inquiries" section under the Pro gate (skipped for Solo; the
existing Pro teaser already signals the upgrade). The four RPCs are only fetched
when the tier can render the section.

SPEC IMPACT: design doc `03_Strategy/Vendor_My_Performance_Tiering_2026-07-01.md`
updated — family 1 marked SHIPPED, Phase B/C/D feasibility replaced with the
verified matrix (Catalog performance is **blocked on capture**: profile-views +
shortlist are per-vendor, no impressions table — flagged, not faked).
DECISION_LOG row appended.
