## 2026-11-14 · fix(layers): RW-146 the Offer Maker no longer closes itself a second after it opens

The Offer Maker swaps its loading screen for the loaded one. Both hold the phone's Back through `useBackCloses`, which
marked ONE history entry with a bare `true`; the old screen's deferred clean-up then saw "our entry" on top, stepped
back, and the popstate closed the NEW screen (its onClose dropped `?maker`). Each layer now marks the entry with its own
id, a layer that finds another's mark takes it over (`replaceState`, never a second push), and only the current holder
steps back through it — so every screen swap in every Maker keeps its layer open. Nested layers and the ✕ / Back paths
behave as before.

Guard: `apps/web/lib/the-layer-back-is-owned.test.ts` (the exact swap sequence, then the hook's wiring).

SPEC IMPACT: None.
