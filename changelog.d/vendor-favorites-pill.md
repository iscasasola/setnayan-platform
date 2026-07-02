## 2026-07-02 · feat(vendor-profile): public "saved by N" favorites chip

Adds the favorites pill from the profile-redesign mockup to the hero, beside the
rating chip. Shows the distinct count of couples who follow OR saved this vendor
(reuses the existing `count_saves_for_vendor` RPC, which combines `vendor_follows`
+ `guest_saved_vendors`), read via the service-role client server-side.

Owner default (2026-07-02): **favorites public, viewers vendor-only** — so the
saved count is exposed publicly but view counts stay vendor-only. Min-N floored
(`FAVORITES_MIN_DISPLAY = 3`): a count below the floor stays hidden so a tiny
number never reads as vanity or de-anonymizes (behavioral-data min-N lock).
Fail-soft → 0 (chip hidden). Founder-only marketplace → usually hidden until
saves accrue: an honest empty state.

Completes the four-pill trust cluster from the mockup (rating · events · [viewers
vendor-only] · favorites) and the vendor-website redesign's public-surface items.

SPEC IMPACT: exposes the vendor saved-count publicly (was vendor-only) — owner
default. No schema change (reuses count_saves_for_vendor). See DECISION_LOG.md.
