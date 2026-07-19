## 2026-06-30 · style(home): official Setnayan mark in the homepage nav

Replace the homepage gate's top-left "Home" logo — which carried over the
prototype's 3-dot placeholder (three `<circle>` SVG elements) — with the OFFICIAL
Setnayan mark (`SetnayanMark` from `@/app/_components/setnayan-mark-icon`, the
real filled glyph that paints in `currentColor`). Sized to match the old logo
(20×20, `h-5 w-5`), keeps the `aria-label="Home"` + click→home behavior. The mark
inherits the nav's adaptive color via `currentColor`: WHITE on the dark cinematic
gate (the button's `color:#fff`) and ink (`--hr-ink`) once the nav switches to the
unlocked glass state — the same behavior the 3 dots had. No CSS change needed.

SPEC IMPACT: None (pure UI swap to the canonical brand mark).
