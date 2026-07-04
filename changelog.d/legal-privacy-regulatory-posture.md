# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · docs(legal): privacy "Regulatory posture" updated to the live ICASA sole-proprietorship

The Privacy page's "Regulatory posture" paragraph still described Setnayan as pre-launch: *"currently operating in a closed pilot phase (approximately 5–20 households)… Personal Information Controller is the platform owner under personal name (DTI Business Name and BIR registration pending; targeted before public launch on December 1, 2026)."* That is stale — the DTI trade name has been registered and the platform is publicly operating.

- **`apps/web/app/privacy/page.tsx`**: the pilot/pending paragraph is replaced with the as-built entity facts — operated by **ICASA**, a sole proprietorship registered with the DTI under the trade name **"SETNAYAN SOFTWARE DEVELOPMENT SERVICE"** (registered 2026-06-25, national scope); because a sole prop has no legal personality separate from its proprietor, the RA 10173 Personal Information Controller is the proprietor, who also holds the DPO function (`dpo@setnayan.com`); BIR registration is under the proprietor's existing TIN; NPC registration is stated as still to be filed. Owner-confirmed disclosure choices (2026-07-04): identify by **trade name only** (proprietor's personal name not printed), describe the platform as **publicly launched** (pilot framing dropped), NPC **not yet filed**. The "last updated" date bumped 2026-06-17 → 2026-07-04. Cross-border-transfers paragraph in the same section left unchanged.

Accuracy pass covered all five legal pages (`/privacy`, `/terms`, `/refunds`, `/cookies`, `/acceptable-use`); the other four were already factually current (0% commission, BDO/GCash rails, 7-day refund window, NSFW-always-on, PostHog opt-out) and were not re-dated, since bumping an unchanged page's date would misrepresent an update.

SPEC IMPACT: None — the entity/registration facts were already decided and recorded (DECISION_LOG + launch-bootstrap-entity memory, 2026-06-15 / 2026-06-25). This only brings the public Privacy copy in line with the already-canonical entity.
