## 2026-06-26 · refactor(papic): retire the ₱2,999 crew-pack surfaces — per-camera is the single model (PR5)

The per-camera Papic buy (PRs 1–4, #2246) shipped alongside the legacy flat
₱2,999 `PAPIC_SEATS` crew-pack, so the Studio page AND the `/about` detail page
showed two contradictory prices at once. This reconciles them to one model
(owner-authorized 2026-06-26: "OK" to retire the crew pack).

- Studio `papic/page.tsx` — the top "Your photo crew · 5 seats / Get the crew
  pack · ₱2,999" CTA is now a plain link to the camera roster (`/crew`); the
  "Section 2 · seat status" card drops its ₱2,999 heading + flat-price copy. The
  per-camera "Add cameras" picker is the single buy surface.
- `/studio/about/papic` — a new data-driven `variablePricing` catalog flag on
  the Papic entry suppresses the flat "Get · ₱2,999" label (→ "Get") and the
  "Buy what you need" single-price row; the live per-camera Roll/Unlimited rates
  live on the feature's own surface. The "Free to try" chip + the owner→tool
  redirect (still keyed on `PAPIC_SEATS`) are unchanged.
- Public `/pricing` à-la-carte — the two per-camera rate rows (Roll ₱30 +
  Unlimited ₱100) collapse into ONE "Papic Cameras · from ₱30/camera" entry, so
  the public catalog reads as the per-camera model instead of two raw rows. The
  raw rows stay in the SEO JSON-LD `@graph` (real ₱30 + ₱100 for extraction),
  and both per-camera SKUs are marked `live` in the build-status map (they were
  defaulting to `not_built` → PreOrder).

The free taste stays the shipped 3-seat sampler (8 photos + 2 clips) — reworded
for consistency, numbers unchanged (the "5 / 5+1" figures remain provisional
dials for the holistic pass).

Known follow-up (tracked, not band-aided): the `SamplerRetentionCard` expiry
nudge still offers a ₱2,999 "upgrade to full Papic" — an edge surface that only
appears when free-sampler photos are expiring. Reframing it to the per-camera
buy is a deliberate sampler-upgrade redesign, deferred so it isn't half-done.

Verified: typecheck + next lint + papic-keep + entitlement-gates +
retired-strings all clean.

SPEC IMPACT: None new — the per-camera model is the corpus canon
(`0012_papic/Papic_v2_Pricing_and_Funnel_Strategy_2026-06-26.md` + DECISION_LOG
2026-06-26). The ₱2,999 `PAPIC_SEATS` SKU stays in the catalog (not deleted) —
it is simply no longer surfaced as a couple buy path.
