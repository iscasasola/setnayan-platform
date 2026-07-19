## 2026-06-25 · feat(dashboard): Phase-C premium entrance — vendor Messages thread list

First (reference) surface of the GATED dashboard premium pass. Adds a shared `RevealList`
client wrapper (`apps/web/app/_components/reveal-list.tsx`) — the ONE narrow dashboard motion
the doctrine allows: a quiet staggered settle of a BELOW-THE-FOLD content list via the shared
`useReveal` hook. Applied to the vendor Messages thread `<ul>` (read-only ThreadListCard rows);
the header + empty-state stay static (the fold is never animated). opacity-only (rows stay in
the a11y tree), IntersectionObserver-gated, prefers-reduced-motion static, clearProps:transform.
page.tsx stays a Server Component (only the wrapper is 'use client').

Reference-first per the Phase C plan: owner eyeballs THIS one before galleries / website / studio
roll. Held as a draft PR — nothing goes live until approved.

SPEC IMPACT: None. Premium_UI_Standard_2026-06-25 Phase C. No SKU/pricing/schema/copy/route change.
