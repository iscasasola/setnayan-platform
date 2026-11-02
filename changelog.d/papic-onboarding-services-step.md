## 2026-07-29 · feat(onboarding): the services step — Papic is already on, Setnayan AI is introduced

Onboarding never told a couple that Papic exists. The wedding flow's Papic carousel and
its "Keep Setnayan AI" card are `PAYWALL_SCREENS`, filtered out since the 2026-06-21 "no
paywall in onboarding" lock; the generic flow *derives* a Papic service list in
`persona-packs.ts` and throws it away; `/onboarding/simple` promises "everything else is
Setnayan's in-app services" and then offers none. Three flows, zero mentions of the
product that creates the memories.

This adds ONE shared informational screen — `app/onboarding/_shared/services-step.tsx` —
mounted after the persona reveal and before `congrats` in all three:

- **Card 1 · Papic.** Already ON and free by the time the couple reaches it (the free pool
  grant and the free dedicated camera are armed at every commit path). It states the
  runway promise in the type's own noun, then shows both products with their live
  ladders: Papic Pool (unlimited cameras, shared shots) and Papic One (a dedicated camera
  with its own QR). No checkout — upgrades live in the studio.
- **Card 2 · Setnayan AI.** Introduced, never given away, and hidden entirely on
  vendor-free types. Mounts the existing `SetnayanAiValue mode="preview"` (#3865) rather
  than re-authoring its nine capabilities.

**Every number is read at request time** — Pool points from `papic_pass_tiers`, One points
from `papic_one_tiers`, every price from `platform_retail_catalog_v2` (active rows only),
the two free allowances from `papic_event_pool_config`, and the photo/clip weights from
the capture-path constants via a new `papicPointCurrencyTerms()`. A rung whose tier row is
inactive, or whose catalog price is missing, *disappears* rather than rendering at a stale
or zero price. `services-step.tsx` is added to the enumerated surfaces in
`papic-copy-guardrails.test.ts`, so CI fails if a literal ever creeps in — it already
caught two in this PR's own comments.

**The Setnayan AI gate is both checks, not one** (BUILD SPEC § 0): `marketplaceEnabled ===
true` AND the type's tier resolves to a SKU. They fail closed on different axes — a
brand-new type defaults to tier C, which *has* a SKU, so the SKU check alone would offer a
vendor-ranking assistant on a vendor-free event. The price comes from
`resolveSetnayanAiTypePricePhp`, the same resolver the studio charges from, so the card
and its destination cannot disagree.

**`style_preferences.interested_services` gets its first reader** — write-only since
#2137. The persona pack's derived list (`papic_guest` → Pool, `papic_seats` → One) now
*orders* the two products, and nothing else: both always render, at their real prices,
with their real free tiers. A derived guess may change what a couple reads first; it must
not change what they are offered.

**Also fixed — /pricing's Papic One tab claimed the wrong free-camera count.** Both the
"Papic One" catalog row and the estimator read
`papic_tier_config.free.seats_per_event` (3). That counts free *shared-pool* seats, which
belong to the other product; Papic One gets exactly ONE free camera, pinned by
`papic_ensure_free_one_camera` to a fixed seat index with two unique constraints behind
it. The copy now says one, states what that camera actually holds
(`free_one_camera_points`, live), and the estimator subtracts one instead of three.
**Estimate delta:** the default 5-camera One estimate goes from `(5−3) × ₱50 = ₱100` to
`(5−1) × ₱50 = ₱200`. The quote goes UP, which is the truthful direction — couples were
being shown a price for two fewer paid cameras than they would actually buy. No price,
SKU, or catalog row changed; PR1 owns the numbers.

Ships flag-dark behind `NEXT_PUBLIC_ONBOARDING_SERVICES_STEP` (documented in
`.env.example`). OFF (default) ⇒ the wedding sequence filters the screen out of
`FLOW_IDS`, the generic wizard's screen array is shorter, and the simple page renders
nothing — every flow byte-identical to today. `PAYWALL_SCREENS` is untouched: this step
takes no money and adds nothing to a cart.

SPEC IMPACT: `Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md` § 4 rows **4** and **5**
are now DONE (were ⛔ NOT STARTED); § 5 open item 3 ("Card 1's free line must describe BOTH
free things") is answered — both the shared pool and the free dedicated camera are printed
from their live admin columns. § 1.3's "`interested_services` is WRITE-ONLY, read by zero"
is no longer true. Open and unchanged: § 5 item 2, the DPO gate on vendor capture — the
card says guests only.
