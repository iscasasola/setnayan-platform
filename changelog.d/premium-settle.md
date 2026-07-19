## 2026-06-25 · feat(marketing): useSettle primitive (Phase-A Wave-3 foundation)

Adds `useSettle` to `_premium.tsx` — no page consumes it yet. The shared
"scattered fragments resolve into one clean layout" gesture: each
`[data-settle-item]` declares a start offset (`data-settle-x/y/rotate`, optional
`data-settle-opacity`) and the hook settles it to its natural CSS position on
IntersectionObserver enter. Covers Wave-3's two consumers — `/why-setnayan`'s
3-card converge and `/papic`'s photo-tile settle — so it lands first to avoid a
shared-file conflict between those two parallel page PRs.

Inherits the foundation contract: transform/opacity only, start state set
synchronously before paint (no flash), `clearProps:transform` so hover survives,
`prefers-reduced-motion` rests items already-settled, `useGSAP`/`gsap.context`
cleanup (SSR-safe).

SPEC IMPACT: None. Premium_UI_Standard_2026-06-25 Phase A. No SKU/pricing/schema/copy/route change.
