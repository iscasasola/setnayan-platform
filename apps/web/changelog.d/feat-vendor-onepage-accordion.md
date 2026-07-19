## 2026-07-12 · feat(vendor): the 5 hubs become true one-page accordions (tabs → expand/collapse)

Owner directive: "no button hyperlinks · same as profile that expands and
collapses · one page access, everything integrated." The tab strip
(VendorHubTabs) is retired; every folded feature is now a collapsible section
on ONE scrolling page, matching the existing Manage-tiles pattern.

- **New primitives:** `FeatureAccordion` (lazy, `?open=<key>`-driven, one open
  at a time — expanding a section is a soft-nav that renders ONLY that
  section's server body, so its DB queries run on expand, not on page load;
  streamed via `<Suspense>` + `AccordionSkeleton`) and `EagerDisclosure`
  (single section, body rendered eagerly + client-toggled — for hubs whose
  home is too heavy to re-render on expand).
- **My Shop:** home (identity · stats · Manage · verify · services) stays on
  top; Contracts · Proposals · Earnings · How clients pay you · Manpower ·
  More tools fold in below as load-on-expand sections.
- **My Customers:** the pipeline (the ONE month calendar + summary cards + QR +
  list) is the home; Bookings · Clients · Payday · Messages fold in. **Calendar
  dedup (owner):** the separate Calendar section is gone — the grid already
  lives in the pipeline; its edit tools move into a new **"Availability &
  capacity"** section that renders the calendar surface in a new
  `variant="manage"` mode (management forms only, month grid suppressed).
- **My Performance:** the dashboard IS the page; Demand Radar folds in as one
  eager disclosure (re-navigating would re-run the ~25-query overview, so
  eager ≈3 queries wins).
- Legacy `?tab=` deep-links from the old redirect stubs still work (read as an
  alias for `?open=`; `tab=calendar` → Availability, `tab=demand` auto-expands
  Demand). Retired the now-unused `hub-tabs.tsx`.

Follow-up (noted, not blocking): expanding a folded section re-runs the hub's
home loader (soft-nav). Acceptable for a logged-in dashboard; can be cached
with a short-TTL `unstable_cache` on the home loaders if it ever bites.

Verified: tsc + lint clean; all hub + legacy-redirect routes compile and route
without server errors on a local dev run. Logged-in visual = the PR's Vercel
preview.

SPEC IMPACT: corpus DECISION_LOG.md 2026-07-12 (vendor one-page hubs).
