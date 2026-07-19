## 2026-07-02 · feat(vendor-shop): pinned review — Pro website control (PR3)

Adds the "Pinned review" Pro control to the My Shop → Website editor and wires it
onto the public `/v/[slug]` page.

- Editor: a Pro-gated picker (radio over the vendor's reviews · "None (newest
  first)" default) using the `microsite_pinned_review_id` column (from PR1).
  Empty state when the vendor has no reviews yet.
- Public page: the chosen review floats to the top of the Reviews section
  (best-effort — reorders within the loaded review window; a stale/foreign id
  no-ops, so there's no cross-vendor leak and no extra fetch).
- `updateVendorWebsiteField` gains `microsite_pinned_review` behind the same
  `PRO_WEBSITE_FIELDS` gate. Shop loader fetches up to 20 reviews as picker
  options. No schema change (PR1 column).

Editorials + public award-badge surfacing are intentionally NOT built here — see
SPEC IMPACT.

SPEC IMPACT: Pinned-review Pro control shipped. **Deferred (owner-surfaced):**
(1) the net-new public *editorials* section + its picker — `loadVendorFeaturedStories`
returns `[]` for everyone until real consented published stories exist (~Dec
2026), so building the section now adds per-request query cost for an empty
result; the editor shows an honest "appears once a couple publishes their story"
note. (2) Public *award-badge* surfacing (top-pick / most-booked) — those are
percentile-based across the vendor pool (meaningless while the marketplace is
founder-only) and would add a cross-vendor computation to every public page load;
the page already shows the Verified + experience badges, and the editor shows the
earned-badges display (PR1). Both are ready to build when they'd actually render
something. No SKU/pricing change. Logged in corpus DECISION_LOG.md.
