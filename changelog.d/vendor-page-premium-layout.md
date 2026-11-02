## 2026-07-02 · feat(vendor-page): premium desktop layout — 2-column + sticky Inquire rail; retire Follow/Save → Inquire Now + Share (slice 1)

First slice of the `/v/[slug]` premium redesign (owner: "build the premium
layout"). Done additively + carefully — the page's gating / anonymity / SEO
logic is untouched.

- **Desktop 2-column** — widened the article (`max-w-3xl` → `max-w-5xl`) and split
  the content into a main story column + a **sticky "Inquire" rail** on the right
  (rating · Inquire Now · Share · at-a-glance: city / events / years). Collapses
  to the single-column stack on mobile.
- **Action row (item F)** — retired the old **Follow / Save-to-picks** row (and its
  `FollowGate` / `SaveVendorButton` / `isFollowingVendor` plumbing +
  `initialFollowing` / `isAlreadySaved` reads) in favour of **Inquire Now**
  (scrolls to the composer, `#get-in-touch`) + **Share** (native share sheet →
  clipboard fallback, new `share-button.tsx` client component). On mobile these
  sit in the identity block; on desktop they live in the sticky rail.

Next slices (not in this PR): cinematic hero overlay, service-card grid, awards
strip, editorial polish. tsc + lint green.

SPEC IMPACT: `/v/[slug]` public layout — desktop 2-col + sticky Inquire rail;
Follow + Save-to-picks retired from the vendor page (Inquire Now + Share replace
them). No schema/pricing change. Logged in corpus DECISION_LOG.md.
