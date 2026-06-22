## 2026-06-22 · feat(vendor-quality): VendorStatsPanel — vendor-facing performance dashboard

Adds the vendor-facing surface for the quality/rating system: a server component on the `/vendor-dashboard` home page that lets a vendor see their own performance metrics and act on improvement nudges. Follow-on to the `vendor_activity_stats` table (migration `20270110320014`, already in prod, recomputed on every couple review) and the `vendor_first_reply_at` chat column (migration `20270110320018`, also in prod).

**What shipped:**

- **New server component** `apps/web/app/vendor-dashboard/_components/vendor-stats-panel.tsx`
  - Fetches `vendor_activity_stats` via a single `.maybeSingle()` query (graceful null → empty state when no stats row exists yet, e.g. a brand-new vendor).
  - Renders 6 metric cards: Response Rate · Avg Reply Time · Review Score · Booking Completion · Inquiry→Booking · Experience Badge.
  - Quality Score as a full-width colour-coded progress bar (0–100; green ≥75 / amber ≥50 / terracotta <50).
  - Conditional improvement nudges (response rate / reviews / profile completeness) + an anonymous-benchmark placeholder.
  - `platform_health_score` deliberately **excluded** (HQ-internal-only column — never read in this component).
  - Response-time metric reads `avg_response_minutes` (sourced from `chat_threads.vendor_first_reply_at`, migration on main); a cautious "—" fallback when the value is 0 is harmless.
- **`apps/web/app/vendor-dashboard/page.tsx`** — renders `<VendorStatsPanel>` in the profile-exists branch, between the "Upcoming events" strip and the "Recent activity" area, guarded by `profileExists && vendorProfileId`. The `vendorProfileId` is threaded out of the loader's try-scope via `LoaderState` (main does not surface `vendor_profile_id` on the loader state, so the threading is required); `finalized_booking_count` is passed from main's existing `completedStats.full_completed_count`.

No schema changes. No new SKUs. Vendor-only surface — no couple- or admin-facing change.

SPEC IMPACT: `0022_vendor_dashboard/` — the vendor dashboard gains a self-stats panel (vendor-facing surface for `Vendor_Quality_Rating_System_2026-06-17.md`).
