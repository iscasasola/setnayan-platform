## 2026-06-22 · feat(landing): inline Papic guest camera + tighten indoor-map gate to paid

Two changes to the public event-website page `apps/web/app/[slug]/page.tsx`, both
honoring the owner-locked rule: paid features auto-show in-context when the order
is ADMIN-APPROVED — gate on the active entitlement, never the pending-inclusive
ownership check.

- **PAPIC_GUEST inline (0012).** The guest camera (`PapicGuestCapture`) is now
  mounted INLINE on the identified guest's own landing page, in the day-of/hub
  region next to the face-enroll + live-gallery cards, so it auto-shows when the
  couple owns the active pack — no tap-out to `/papic/guest` required. Gated on
  the existing (correct) `eventPapicGuestActive` active entitlement + a guest
  session; resolves the same per-guest 150-credit quota (`fetchGuestQuota`), the
  one-time UGC-terms flag, and the block short-circuit the standalone route does
  (a blocked guest does NOT get the inline camera). The floating "Be a candid
  camera" CTA + the `/papic/guest` route are KEPT as the QR-scan fallback. The
  gate was already the active gate; only the surface changed.
- **INDOOR_BLUEPRINT gate tightened (0008).** The inline entrance→table seat map
  (shipped in #2012) was gated on `eventOwnsIndoorBlueprint` (pending-inclusive),
  so it could render while the order was still in reconciliation. Switched to the
  paid-only ACTIVE gate `eventSkuActive(admin, event.event_id, 'INDOOR_BLUEPRINT')`
  — the map now shows only after the Setnayan team verifies the payment, matching
  every other paid feature on this page (LIVE_WALL / PANOOD_SYSTEM / PAPIC_GUEST).
  Removed the now-unused `eventOwnsIndoorBlueprint` import (nothing else in the
  file used it).

SPEC IMPACT: 0012 — Papic guest camera now auto-shows inline on the couple's
landing page when the pack is paid + admin-approved (the standalone route +
floating CTA remain as fallbacks). 0008 — the inline indoor-blueprint wayfinding
map is now gated on the paid/approved (active) entitlement, not pending ownership.
