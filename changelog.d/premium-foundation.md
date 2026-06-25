## 2026-06-25 · feat(marketing): Phase-A premium-UI foundation primitives

Adds two shared GSAP entrance hooks to `_premium.tsx` — **no page consumes them yet**.
They land first so the parallel Phase-A page waves don't collide on this shared file.

- **`useReveal`** — IO-gated staggered rise of `[data-reveal-item]` children
  (opacity 0→1, y→0), `clearProps:transform` so CSS hover-lift survives. Falls back
  to revealing the ref element itself if no children are marked.
- **`useLineReveal`** — SplitText serif line-reveal for any single `<h1>`/`<h2>`,
  `trigger:'view'|'mount'`, `document.fonts.ready`-guarded, decoupled from
  usePanelIntro's one-headline-per-scope limit.

Both inherit the homepage's proven contract: **opacity** (never `autoAlpha`/
`visibility:hidden`) so content stays in the a11y tree · `prefers-reduced-motion`
rests in the final state · `useGSAP`/`gsap.context` cleanup (SSR-safe) · SplitText
reverted on unmount. `useLineReveal` carries an LCP note (don't point `trigger:'mount'`
at an LCP hero headline).

SPEC IMPACT: None. Implements `Premium_UI_Standard_2026-06-25.md` Phase A. No SKU /
pricing / schema / copy / route change.
