## 2026-06-25 · feat(marketing): premium-UI pass on /for-vendors

The page's signature is the existing interactive VendorDoorScenario — left exactly as
tuned (CSS-transition token travel, aria-live, reduced-motion) per the restraint doctrine;
rebuilding its motor with GSAP would be high-risk/low-reward. Added only a contained
champagne ARRIVAL PULSE on the final beat (additive, off under reduced-motion) + a serif
line-reveal on the section's static H2. Every below-the-fold section (VendorVision,
StackClose, DeepDive, Voices, FAQ, ClosingCTA) gets one quiet fade+rise via a page-level
RevealOnView wrapper — ZERO edits to the bespoke section components. The hero stays static
(LCP), EditorialBand (photo breath) + Footer untouched.

page.tsx stays a force-dynamic Server Component; metadata + JSON-LD @graph untouched.
opacity-only (a11y tree intact); prefers-reduced-motion rests everything visible/static.

DEVIATION (flagged): the plan called for GSAP-driving the scenario token + per-beat
SplitText beat headings; both were deliberately NOT done — the token machine is already
elegant, and per-beat SplitText against the live region is leak-prone (the plan's own
risk note). A frontend-design restraint call: spend nothing where the existing piece
already lands.

SPEC IMPACT: None. Premium_UI_Standard_2026-06-25 Phase A Wave 4. No SKU/pricing/schema/copy/route change.
