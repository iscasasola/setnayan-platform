## 2026-07-03 · feat(vendor): "Your services" restructured to the v20 prototype — 3 tabs, browse-at-rest coverage

Owner: *"we had a prototype. follow that."* The shipped surface had kept the
pre-prototype 4 stacked disclosure sections; the finalized v20 prototype
(recovered verbatim from the session transcript) is ONE card with THREE tabs.
This lands that structure.

**New `ManagerTabs`** (`_components/manager-tabs.tsx`) — prototype tab chrome
(paper track, active tab = white + gold border); panels stay mounted (hidden)
so form state, `#svc-…` anchors and server-action results survive switches.
Tab landing: `?requested` → Tools · open-add/off-peak/any existing services →
Service cards · brand-new vendor → Coverage (coverage-first).

**Tab 1 · Coverage** (`coverage-panel.tsx` reworked):
- **The browse IS the surface** — search bar + 3-per-row card drill
  (parent → branch → leaf) + breadcrumb, always visible; the "Add coverage"
  toggle gate is gone. Leaf → "Add this coverage?" confirm (event types +
  faiths) unchanged.
- **"Your coverage" grouped by parent** (v20): folder header + removable leaf
  pills (pill shows its card count; click opens the Serves editor; × deletes
  with confirm). Parents N-of-cap counter kept.

**Tab 2 · Service cards** — the existing list + fast-card editors (pricing
bases · brackets · inclusions · discounts · media, P3a–3c) plus the off-season
nudge, moved from the old first section.

**Tab 3 · Tools** — specialist tools + request-a-category, unchanged content.

**Removed per the prototype** (owner's own prototype-session calls):
- The **tier banner** (*"remove the definition of our tier"*) — `TierBanner` /
  `TierStat` deleted; tier caps still gate everything server-side.
- The standalone **"Explore card preview" section** (*"remove explore preview …
  when we create a service card, we want to see the exact card"*) — its
  review/badge/display-name reads dropped (lighter page), orphaned
  `explore-card-preview.tsx` deleted. The WYSIWYG preview returns INSIDE the
  card form as the next slice.
- `ManagerSection` (the stacked-disclosure wrapper) deleted.

Verified: tsc (0) · next lint (0) · lint-nested-forms (pill delete-forms are
valid siblings) · prod build.

SPEC IMPACT: None beyond the already-approved redesign (DECISION_LOG
2026-07-02/03) — this aligns the shipped structure with the owner-locked v20
prototype. Remaining v20 gaps: in-form live card preview · downpayment-to-
reserve field · refinement chips on the fast form.
