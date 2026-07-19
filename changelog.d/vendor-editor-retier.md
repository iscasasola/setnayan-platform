## 2026-07-03 · feat(vendor-shop): re-tier the Website editor to the Free/Solo/Pro ladder

Aligns the My Shop → Website editor controls with the tier ladder so the editor
gates match the tier-conditional public layout (#2653).

- **Personalizing is now Solo+** — About · Featured services · Sections are gated
  to Solo and up (`micrositeCan(tier).canPersonalize`). **Free vendors** see a
  "Make this page yours" upsell instead (their page stays live + findable, just
  auto-composed). New `micrositeCan(tier_state)` helper → `{ canPersonalize (Solo+),
  canPremium (Pro+), isEnterprise }`.
- **Pro controls unchanged** — custom slug · hero · accent · pinned review ·
  featured editorials stay Pro+ (`customWebsiteName`).
- **Server backstop** — `updateVendorWebsiteField` gains a SOLO gate
  (`SOLO_WEBSITE_FIELDS`) alongside the existing PRO gate, so the tiering is
  enforced server-side, not just hidden in the UI.

Follow-ups: move **accent** from Pro → Solo (per the ladder — trivial, deferred
to keep this slice low-risk) + the Enterprise cinematic layer. tsc + lint green.

SPEC IMPACT: Website-editor controls re-tiered — personalizing (About/featured/
sections) is Solo+, premium controls stay Pro+. No schema change; reuses tier_state
+ the customWebsiteName cap. Logged in DECISION_LOG.md.
