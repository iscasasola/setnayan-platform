## 2026-06-25 · feat(marketing): premium-UI pass on /download + useProvision/useMagnetic

The DownloadCard "provisions itself" on entry — the page's one signature: the header
settles, the four spec rows stagger up, a single champagne hairline draws left-to-right
across the spec-list top edge (the one gold gesture), and the mulberry button lands last
with a desktop-only magnetic pull. Hero copy + the install ribbon + the two info cards do
quiet `useReveal` rises; the hero H1 gets a single serif line-reveal. No PanelThread.

Adds two SINGLE-CONSUMER primitives to `_premium.tsx`: `useProvision` (card self-assembly
+ a `[data-provision-rule]` strokeDashoffset hairline draw) and `useMagnetic` (desktop
pointer-follow via gsap.quickTo, no-ops on touch / reduced-motion, never swallows the
click). Both inherit the contract: opacity-only (a11y tree intact), prefers-reduced-motion
rests in the final state, useGSAP cleanup. The DownloadCard moved into a `'use client'`
island; page.tsx stays a Server Component (ISR), all data passed as props. The page was
already palette-clean (Tailwind theme classes) — no token migration needed.

SPEC IMPACT: None. Premium_UI_Standard_2026-06-25 Phase A Wave 4. No SKU/pricing/schema/copy/route change.
