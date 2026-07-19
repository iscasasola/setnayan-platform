## 2026-07-02 · feat(vendor-shop): editorials on the public vendor page + "feature up to 3" control

Wires the vendor's Real-Story editorials onto the public `/v/[slug]` page and adds
the Pro "Featured editorials" picker to My Shop → Website. Ready-and-waiting: the
public section **auto-hides until a real published story exists** (owner-approved
"build it now, ready-and-waiting").

- **Public page** — new "Featured in Real Stories" section (after Portfolio): the
  vendor's booked weddings a couple has PUBLISHED + consented to showcase
  (`loadVendorFeaturedStories` over `fetchVendorPoolBookings` event ids), ordered
  **featured-first** (`microsite_featured_editorial_ids`), capped at 3 — the lead
  story renders as a wide spotlight, the rest as cards. Each links to the couple's
  story at `/[slug]`. Respects the `editorials` section toggle; fail-soft +
  auto-hidden when the list is empty (which is every vendor today until real
  consented stories exist ~Dec 2026).
- **Editor** — "Featured editorials" is now a real Pro control (multi-select, up
  to 3) over the vendor's own published stories, with an honest empty state.
  Replaces the PR3 "coming soon" note.
- **Plumbing** — `microsite_featured_editorial_ids` now read by
  `fetchVendorMicrosite` (`featuredEditorialIds`) + written by
  `updateVendorWebsiteField` (`microsite_featured_editorials`, PRO-gated, cap 3).
  Shop loader exposes the story list as picker options. No schema change (the
  column landed in PR1).

SPEC IMPACT: Editorials ("Real Stories") now surface on the public vendor profile
(previously vendor-dashboard-only) + a Pro featured-editorials picker. Cards are
text-forward (couple · city · date · link) — story cover/OG images are a follow-up
(not in the `VendorFeaturedStory` shape). Auto-hidden until published stories
exist. No SKU/pricing change (reuses the Pro website cap). Logged in corpus
DECISION_LOG.md.
