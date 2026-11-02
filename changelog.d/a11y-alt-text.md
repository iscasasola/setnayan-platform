## 2026-06-25 · fix(a11y): descriptive alt text on content images (item 2/4)

App-wide image-alt audit (7-agent fan-out). Of 14 candidates, 9 were real
content-image violations (empty/placeholder alt on meaningful images); the 5
vendor logo/photo cases were confirmed decorative-by-context (vendor name is
adjacent visible text → `alt=""` is the correct WCAG choice, left as-is).

Fixed 11 alts across 8 files (Papic gallery / live-wall / kwento thumbs,
mood-board inspiration, vendor editorial-media ×2, stylist moodboard library,
admin hero-video frames, admin social-queue previews). Also hardened
`editorial-media-studio` from `caption ?? ""` to `caption || "…"` so a missing
caption no longer yields an empty alt. All interpolated fields verified in
scope; diff is strictly alt-only; adversarially verified `ship`.

SPEC IMPACT: None — a11y correctness, no schema/SKU/pricing/flow change.
