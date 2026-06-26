## 2026-06-26 · fix(papic): gate guest Kwento composer on KWENTO ownership

Resolves the PR8 follow-up below: the guest capture composer no longer shows the
Kwento "tell the story" prompt when the event hasn't unlocked the paid `KWENTO`
SKU (it would only let the guest type a message that the submission endpoint then
403s `feature_not_owned`).

- `app/papic/guest/page.tsx` resolves `canKwento` via `eventSkuActive(admin,
  event_id, 'KWENTO')` (bundle-aware · admin-approved — mirrors the route gate)
  in the existing `Promise.all` (parallel · only after the PAPIC_GUEST `owns`
  guard) and threads it into `<PapicGuestCapture>`.
- `papic-guest-capture.tsx` gates the Kwento UI on `canKwento`: both capture
  triggers stay in the `idle` phase (never `flash`) when unowned, so the prompt
  never opens — and the three `kwentoPhase`-keyed JSX blocks are gated too as
  defense-in-depth. Scan-to-tag arming is untouched, so tagging still works.
- Net: an unowned event's guest simply never sees the prompt; no behavior change
  when the event owns KWENTO (direct or via a granting bundle).

Verified: web typecheck + next lint + lint:papic-keep all clean.

SPEC IMPACT: None (UX gate mirroring the already-specced KWENTO paywall).

## 2026-06-26 · feat(papic): Kwento paid-to-unlock ₱500 + Photo Wall reprice (PR8)

Owner 2026-06-26: Kwento (the guest "words on a photo" layer) becomes a
paid-to-unlock add-on at ₱500 — reverses the earlier free-words-layer lock.

- New `KWENTO` SKU (₱500, standalone — not in any bundle) in
  `platform_retail_catalog_v2`.
- **HARD GATE** at the submission endpoint `app/api/papic/kwento/route.ts` —
  `eventSkuActive('KWENTO')` (bundle-aware · admin-approved); returns 403
  `feature_not_owned` if the event hasn't bought it. No unlock, no words.
- Couple **BUY surface** on the Papic moderation page: the Kwento queue is gated
  on KWENTO; when unowned, an "Unlock Kwento · ₱500" `InlineCheckoutDrawer`
  (apply-then-pay) replaces it. Photo moderation (hide/report/block) stays free.
- `KWENTO` marked `live` in the build-status map.

Also: **Photo Wall** (`LIVE_WALL`) repriced ₱1,499 → **₱1,000** (owner 2026-06-26).
Already entitlement-gated (`eventSkuActive`) + a MEDIA_PACK child — pure reprice.

FOLLOW-UP (noted, not band-aided):
- ~~The guest capture composer still SHOWS the Kwento prompt when the event
  hasn't unlocked it~~ — RESOLVED, see the `canKwento` gate entry above.
- The "Unlock all" ₱15,000 bundle is still to build: it must grant a per-camera
  Unli ALLOWANCE (not just entitlements), which the entitlement-bundle model
  doesn't cover cleanly — a separate design.

Verified: typecheck + next lint + entitlement-gates + papic-keep + retired clean;
migration applied to prod (KWENTO live ₱500 · LIVE_WALL ₱1,000).

SPEC IMPACT: DECISION_LOG 2026-06-26 (Kwento fully-paid) + `0012_papic.md` header.
