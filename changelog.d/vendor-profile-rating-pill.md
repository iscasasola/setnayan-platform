## 2026-07-02 · feat(vendor-profile): rating trust chip in the hero

Surfaces the star average + review count as a compact chip in the public
vendor profile hero, beside the experience badge — the two headline trust
signals now cluster at the top (per the approved profile-redesign mockup;
the rating previously appeared only in the Reviews section far below). Reuses
the already-fetched `reviewStats` and the shared `formatStarRating` + warn-star
styling. Respects the Free-tier star gate (`viewerTierCaps.reviewStarsCounted`)
and hides entirely when there are no reviews yet — honest empty state, never a
fake 0.0.

Slice 2 of the vendor-website redesign (2026-07-02). Uses only already-public
data; the "viewers"/"favorites" pills from the mockup are deferred pending an
owner decision on exposing those vendor-only aggregates publicly (they'd need
anon-safe count fns + a call against the behavioral-data min-N lock).

SPEC IMPACT: None — additive UI using existing public data; no schema, no
pricing, no catalog change. See DECISION_LOG.md 2026-07-02.
