## 2026-07-03 · feat(vendor-page): Enterprise cinematic hero (flagship layer, tier ladder)

The top of the Free/Solo/Pro/Enterprise website ladder — the **Enterprise
"Flagship"** cinematic hero on `/v/[slug]`.

- When a vendor is **Enterprise** AND has chosen a hero photo, the hero renders
  **full and cinematic** — a tall image with a bottom scrim and the studio name
  (serif italic, cream) + a service·city kicker + tagline + an **Inquire Now** CTA
  overlaid on it. The identity block below suppresses the now-duplicate name.
  Gated on `asVendorTier(tier_state) === 'enterprise'`; every other tier keeps the
  standard banner + identity block untouched (fail-safe — no hero photo → standard
  banner even for Enterprise).

Remaining Enterprise polish (follow-up slices): gold stats ribbon · awards strip ·
editorial spotlight treatment · video/YouTube portfolio (item I). tsc (my file) +
lint green.

SPEC IMPACT: `/v/[slug]` gains an Enterprise-only cinematic hero (name overlaid).
No schema/pricing change (reuses tier_state). Completes the visible layer of the
tier ladder alongside #2653 (tier-conditional layout) + #2658 (editor re-tiering).
Logged in DECISION_LOG.md.
