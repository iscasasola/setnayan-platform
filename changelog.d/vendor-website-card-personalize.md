## 2026-07-02 · refactor(vendor/shop): Website card panel = personalize, not a second link/preview

On `/vendor-dashboard/shop` ("My Shop"), the **Website** card's inline panel
duplicated exactly what the Hero card at the top of the page already shows — the
public address, a **Copy link** button, and an open-live button ("View as couple"
in the Hero, "Open live" in the panel). Owner: the Website card should show
**personalization**, not the link/preview that already lives at the top.

Reworked `WebsitePanel` (`apps/web/app/vendor-dashboard/shop/page.tsx`):

- **Removed** the redundant URL `<code>` + Copy link + "Open live" (all still
  present in the Hero — the single source for address + preview).
- **Added** a "personalize your page" list of quick-edit rows, each deep-linking
  to the exact editor surface that shapes the public microsite: Logo, Headline
  (tagline), Portfolio, Services & pricing, Business details. Every row points at
  a real field — the microsite is generated from `vendor_profiles`, so no control
  is fabricated. The "Edit everything on your profile" catch-all stays at the
  bottom (it is not in the Hero, so not a duplicate).
- Status line kept (Live/Draft badge) with copy nudging toward personalization.

Supporting change in `apps/web/app/vendor-dashboard/profile/page.tsx`: wrapped the
Logo, Tagline, Portfolio, and identity (Business name) fields in `id="edit-logo"
/edit-tagline/edit-portfolio/edit-details"` `scroll-mt-24` anchors so the panel's
deep-links land on the right field (the logo/portfolio `FileUpload` fields had no
native `id`). Distinct `edit-*` ids avoid colliding with the inputs' own ids.

SPEC IMPACT: None (UI refinement to a shipped surface). Logged as a decision row
at the bottom of `DECISION_LOG.md` for traceability of the "Website card =
personalization" intent per the My Shop rework track.
