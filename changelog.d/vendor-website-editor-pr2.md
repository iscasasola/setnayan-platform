## 2026-07-02 · feat(vendor-shop): wire the Pro website controls — slug · hero · accent (PR2)

Turns the PR1 locked "Pro customization" teaser into real editable controls for
Pro/Enterprise vendors (gated on `tierCaps.customWebsiteName`; Free vendors keep
the locked teaser + Upgrade nudge).

- **Custom address (slug)** — editable inline in the Website editor with a live
  `host/v/…` preview; reuses `parseSlug` + the existing Pro gate; friendly copy
  on the slug-collision error.
- **Hero photo** — pick any of your portfolio photos (or "Automatic") to lead
  the public page as a banner. Server validates the key is one of the vendor's
  own `portfolio_r2_keys`. Rendered on `/v/[slug]` above the identity block.
- **Accent theme** — 6 curated presets (champagne default · clay · sage · dusty
  blue · plum · teal), NOT a free hex picker. Retints the microsite's accent
  ramp via inline `--color-terracotta{,-600,-700}` overrides scoped to the
  vendor `<article>` (Setnayan header chrome keeps the site accent). Preset key
  stored; ramp lives in code (`MICROSITE_ACCENTS`) so it's tunable without a
  migration.

`updateVendorWebsiteField` gains the three Pro fields behind a server-side
`PRO_WEBSITE_FIELDS` gate; slug edits revalidate both old and new public paths.
Shop loader resolves portfolio thumbnails for the hero picker. No schema change
(columns landed in PR1). tsc + lint green locally.

SPEC IMPACT: Pro website customization now functional (slug/hero/accent).
Accent = curated presets. Gating reuses `tierCaps.customWebsiteName` — no
SKU/pricing change. Logged in corpus DECISION_LOG.md. PR3 (editorials section) +
PR4 (pinned review + public awards) follow.
