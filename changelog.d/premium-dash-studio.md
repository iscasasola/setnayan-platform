## 2026-06-25 · feat(dashboard): Phase-C entrance — couple Studio app rows

Wrap each per-section App-row list in the couple's Studio launcher
(`apps/web/app/dashboard/[eventId]/studio/page.tsx`) in the shared `RevealList`
so the below-the-fold rows settle in with the quiet, IntersectionObserver-gated
opacity entrance. Additive wrapper swap only (`<ul>` → `<RevealList as="ul">`,
className preserved); page stays a Server Component, no copy/IA/route/logic change.

SPEC IMPACT: None
