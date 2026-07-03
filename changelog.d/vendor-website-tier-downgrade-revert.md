## 2026-07-03 · fix(vendor-website): downgrade/lapse REVERTS premium website features (data kept)

The public `/v/[slug]` page gated the layout on the vendor's live tier but rendered
the content customizations on data-existence, so a downgraded (or lapsed) vendor kept
premium content they no longer paid for AND couldn't remove it (the editor controls
vanish with the tier). Now every premium feature is render-gated on the CURRENT tier,
mirroring the caps the My-Shop editor uses:

- **Solo+ (`canPersonalize`):** About · accent · featured-service order · section toggles.
- **Pro+ (`customWebsiteName`):** hero photo · pinned review · editorials · 2-col layout.
- Below the tier, the feature stops rendering but the **stored data is kept** — a soft
  hide, not a reset — so re-upgrading restores everything instantly (no redo, no data loss).
- The **custom URL is deliberately NOT reverted** (it's a shared permalink; dropping it
  would 404 links already handed out) — routing keeps resolving it.

Also fixes an editor drift from the accent Pro→Solo move: removed "Accent theme" from
the Pro-locked "upgrade to unlock" teaser (it's a Solo control now).

No schema change; no data deleted. Pro/Enterprise render unchanged (no regression).

SPEC IMPACT: downgrade now cleanly reverts the vendor website to the tier baseline
(closes a paywall leak on non-renewal). Logged in DECISION_LOG.md.
