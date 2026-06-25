## 2026-06-25 · feat(marketing): premium-UI pass on the homepage FeaturesNarrative

First application of the adopted Premium-UI design doctrine (corpus
`Premium_UI_Standard_2026-06-25.md`): **frontend-design** (taste governor) →
**premium-frontend-ui** (ambition ceiling) → **gsap-skills** (motion engine),
all under the Setnayan constitution (`--m-*` palette, v2.1 brief, locks).

The live homepage's post-hero `FeaturesNarrative` (the 16-feature step-through)
read as "functional rather than premium." Elevated it — additively, the owner-set
4-panel structure, copy, order, and CTAs are untouched:

- **New GSAP motion engine in the repo.** Added `gsap@^3.13` + `@gsap/react@^2.1`
  (first GSAP usage). Isolated in `app/_components/marketing/_premium.tsx` so the
  zero-dependency `_motion.tsx` (Reveal/Blob) stays intact for incidental fades.
- **Signature moment (one, not scattered — the hero owns scrub):** a champagne
  "thread" (`PanelThread`) that stitches each panel, drawn in via `strokeDashoffset`,
  + a Cormorant/serif **line-reveal** on each panel headline via GSAP `SplitText`.
  Supporting content does a quiet staggered rise.
- **Robust + accessible:** entrance gated by `IntersectionObserver` (correct under
  the gated PostHeroReveal + per-step remount; no ScrollTrigger refresh coupling),
  `useGSAP`/`gsap.context` auto-cleanup (SSR-safe, Next 15 / React 19), SplitText
  reverted on unmount, headline never left hidden on failure, transform/opacity
  only, `prefers-reduced-motion` → fully static, thread hidden < 820px (mobile
  stays uncluttered), `clearProps:transform` so card hover-lift survives.

SPEC IMPACT: Logged in corpus `DECISION_LOG.md` (2026-06-25) + new doctrine doc
`Premium_UI_Standard_2026-06-25.md`. No SKU/pricing/schema change. `premium-web-animation`
skill archived (superseded by gsap-skills) — local skill dir only, not repo code.
