## 2026-06-26 · feat(papic): complete "Unlock all" — free uncapped Unli cameras + Kwento new-events-only

Follow-up that completes the "Unlock all of Papic" ₱15,000 bundle shipped in
PRs #2267–#2269. Those landed the bundle + Kwento paywall but **explicitly
deferred the per-camera Unli grant** and left the bundle mirror half-wired; the
Kwento paywall also shipped as ALL-events. This finishes both per the owner's
2026-06-26 calls.

**1. The deferred camera grant — free, UNCAPPED Unli cameras.** Owning
PAPIC_UNLOCK is now treated as "all Unli cameras paid":
- `papicUnliUnlockAllActive()` (papic-cameras.ts) ORed into the per-camera
  capture gate in `app/papic/actions.ts` + `app/api/upload/route.ts` (Unli tier
  only · bundle- + refund-aware · fail-closed).
- `provisionUnlockUnliCameras` server action — couples self-provision Unli
  cameras for free (no order/payment), per-submit bound 250, seats stamped to the
  paid PAPIC_UNLOCK order for traceability.
- The Papic-page "Unlock all" card's owned state now renders the free-Unli
  provisioner instead of a static "Unlocked ✓" — so the card's "Unlimited Unli
  cameras" promise is actually delivered.

**2. Kwento → NEW EVENTS ONLY (owner answer this session).** PRs #2267/#2268
gated Kwento for ALL events; the owner asked to grandfather existing couples:
- `events.kwento_free_grandfathered` column + re-run-safe fixed-cutover backfill
  (every event created before 2026-06-27 stays free).
- New `lib/kwento-access.ts` `eventKwentoEnabled()` (grandfathered OR
  eventSkuActive(KWENTO), fail-open) replaces the bare `eventSkuActive('KWENTO')`
  at all three gates: guest POST route, guest composer, couple moderation queue.

**3. Completed the 3-way bundle mirror** the umbrella PR left half-wired:
- `BUNDLE_MEMBERS.papicUnlock` (onboarding-pricing.ts) + a migration that
  CREATE OR REPLACEs `bundles_granting_sku()` with the third bundle's 6 children.
- `lint-entitlement-gates.mjs` generalized 2 → 3 bundles and now reads the
  NEWEST migration defining the function (not a fixed filename).
- 7 new entitlement tests.

Migrations (NOT auto-applied — owner runs `supabase db push`):
`20270304380209_kwento_grandfather_column.sql`, `20270304577448_papic_unlock_bundle_aware.sql`.

⚠ Owner sign-off flagged: Kwento new-events-only reverses the locked "every
service free to use" positioning, but only for events created after the cutover
(no current couple loses it). Kwento price left at the shipped ₱500 (provisional ·
admin-managed). Roll/Ltd cameras are NOT unlocked by the bundle (Unli only).

Verified: typecheck · lint · lint:entitlement-gates (3 bundles) · lint:papic-keep ·
581 unit tests · production build — all green.

SPEC IMPACT: Completes PAPIC_UNLOCK's uncapped-Unli-camera grant + flips Kwento
to new-events-only (grandfather). Logged at the bottom of corpus
`DECISION_LOG.md` (2026-06-26). Pricing admin-managed; figures provisional.
