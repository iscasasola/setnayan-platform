## 2026-06-25 · feat(marketing): premium-UI pass on /why-setnayan

The signature is the "What you'd otherwise juggle" 3-card row: the three fragmented
"apps" enter SEPARATED (outer two offset ~28px outward + a faint ±1.2° tilt) and
converge into one clean aligned trio in a single GSAP beat via `useSettle` — the
page's thesis made literal. The only bold moment; lives in the argument section, not
the hero. Hero H1 gets a serif line-reveal; other sections quiet `useReveal` rises.

Also did the page's overdue token + gold hygiene (value-equivalent swaps): raw hex →
`--m-*`, dropped the gold-tinted card fills (`#FBF8F1`/`#FBF6EA` → `--m-paper-2` with a
single hairline `--m-orange` border), recolored FAQ dividers to `--m-line`. No
PanelThread anywhere (gold-budget). page.tsx stays a force-static Server Component;
motion lives in a `'use client'` island; metadata + both JSON-LD blocks untouched.
opacity-only (a11y tree intact), prefers-reduced-motion rests pre-settled.

SPEC IMPACT: None. Premium_UI_Standard_2026-06-25 Phase A. No SKU/pricing/schema/copy/route change.
