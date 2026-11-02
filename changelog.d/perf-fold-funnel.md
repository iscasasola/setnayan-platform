## 2026-07-02 · refactor(vendor): fold Quote-to-Booking Funnel into My Performance + Demand

Consolidates the standalone `/vendor-dashboard/funnel` page (owner "just
integrate this to My Performance as well and the demand radar page"). The
four-stage funnel already previewed on My Performance; this brings over the
unique **by-source breakdown** ("where your bookings / views come from") and
retires the separate page.

- **My Performance (`/vendor-dashboard/performance`)** — now renders the full
  funnel read inline: ROI card + booking-funnel bars + two new **"Where your
  bookings/views come from"** by-source tables (this-year window, min-N floored
  via the shared `FUNNEL_MIN_N`). The funnel preview card was retitled "Your
  booking funnel" and lost its now-dead `Details → /funnel` link.
- **Removed the "Show more/less" collapse** — the old `SectionDisclosure`
  wrapper around ROI + funnel is gone (component deleted); everything on the
  page now shows without a click (owner "remove the collapse, we want everything
  to show").
- **Demand Radar (`/vendor-dashboard/demand`)** — added a clearly-labeled
  **"Your own data"** strip below the (de-identified, market-intel) radar: a
  single "Where your bookings come from" table, visually + textually separated
  so own-attribution never reads as market data.
- **Shared plumbing** — `lib/vendor-funnel.ts` gained `fetchBookedBySource()` /
  `fetchViewsBySource()` + `SourceSlice` type + `humanizeSource`/`SOURCE_LABELS`
  (moved off the old page), and a new server component
  `vendor-dashboard/_components/source-breakdown.tsx` both surfaces reuse. All
  reads stay RLS/ownership-scoped + min-N gated — no behavioral-data regression.
- **Route retired gracefully** — `/vendor-dashboard/funnel` is now a redirect
  stub → `/vendor-dashboard/performance` (no 404 on stale bookmarks). Sidebar
  sub-item, nav-registry slot (`vendor.sidebar.funnel`), and the `Filter` icon
  import removed; bottom-nav keeps `/funnel` in `activeMatch` for the transient
  redirect hop. `VENDOR_TIERS_AND_BENEFITS.md` updated.

Verified: `tsc --noEmit` clean · ESLint clean · nav-icon + bottom-nav lints pass
· `nav-registry-defaults` unit test 8/8 · retired-strings lint clean.

SPEC IMPACT: Vendor IA change — the standalone Quote-to-Booking Funnel page is
retired and folded into My Performance + Demand Radar. Logged at the bottom of
the corpus `DECISION_LOG.md` (2026-07-02 row).
