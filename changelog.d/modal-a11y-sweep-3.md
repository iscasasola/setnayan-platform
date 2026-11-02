## 2026-06-25 · feat(a11y): focus-trap modal sweep (batch 3/4)

App-wide modal focus-management sweep (follow-up to #2134's `useModalA11y`).
Wires `useModalA11y` (focus-in + Tab trap + focus-restore + Esc + scroll-lock)
into vendor-workspace overlays:

- `dashboard/[eventId]/vendors/_components/accordion-build.tsx`
- `dashboard/[eventId]/vendors/_components/cancel-booking-button.tsx`
- `dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx` (CompareSheet)
- `dashboard/[eventId]/vendors/invite-modal.tsx`
- `dashboard/[eventId]/vendors/[vendorId]/workspace/_components/quote-bridge.tsx`

Mid-submit guards preserved via `onClose` wrappers; calm-default focus
(e.g. "Keep the booking") preserved via `initialFocusRef`. Left out:
`category-search-overlay.tsx` (layered Esc — filter sheet closes before the
overlay) and `shortlist-categories.tsx` (delegates to the shared
RequirementsModal); both handled separately.

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
