## 2026-07-04 · feat(marketing): Custom vendor tier public surface + Enterprise 100 km reach sweep

PR-D of the Custom vendor tier launch — the public marketing surfaces for the
owner-signed §11 Custom rate card (VENDOR_TIERS_AND_BENEFITS.md).

- **Top-nav Prices menu → Custom plans deep-link.** Added a "Custom plans for
  vendors →" link inside the shared marketing Prices overlay
  (`app/_components/home/HomeOverlays.tsx`), beside the existing "See full
  pricing →" CTA, pointing at `/for-vendors#custom`. Nav registry / navicon
  chokepoint untouched (this is an overlay link, not a new top-nav button).
- **/for-vendors ✦ Custom section is now real + linkable.** The Custom tier card
  in `vendor-tier-ladder.tsx` gets `id="custom"` (scroll-margin for the fixed
  glass nav), benefits-forward copy for the signed reality (Everything in
  Enterprise automatically + branch/reach/seat/slot/portfolio/token/domain dials,
  "from ₱8,999 per 28 days", account manager + QBR), keeps the "Talk to us"
  contact CTA, and adds a secondary "Already a vendor? Build your plan" link →
  `/vendor-dashboard/subscription`.
- **Enterprise "nationwide" → "reach up to 100 km" sweep** (owner re-capped
  Enterprise reach at 100 km 2026-07-04; nationwide now sells in Custom):
  `vendor-tier-ladder.tsx` (Enterprise benefit + header comment),
  `HomeOverlays.tsx` (Vendors overlay legend), `vendor-benefits.ts` (Enterprise
  reach benefit + Custom teaser tagline). Non-tier brand copy ("suppliers
  nationwide" in `layout.tsx`) left untouched.

SPEC IMPACT: None — implements VENDOR_TIERS_AND_BENEFITS.md §11 public surface.
