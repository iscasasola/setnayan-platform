## 2026-06-25 · feat(dashboard): Phase-C entrance — couple Website hub card grids

Wrapped the two below-the-fold static card grids on the couple's wedding-website
hub (`apps/web/app/dashboard/[eventId]/website/page.tsx`) in the shared
`RevealList` wrapper for a quiet staggered settle: Grid A (QuickLink — Invitation
& URL / Who can view / Editorial) and Grid B (PhasePart — Save the Date / RSVP /
Event / Editorial). Each card carries `data-reveal-item`; the `QuickLink` and
`PhasePart` components forward the attribute to their root DOM node. Header and
the hero "Launch editor" CTA stay static (fold + primary action). page.tsx
remains a Server Component — only the `RevealList` wrapper is `'use client'`.

SPEC IMPACT: None
