## 2026-06-25 · feat(a11y): focus-trap modal sweep (batch 4/4)

App-wide modal focus-management sweep (follow-up to #2134's `useModalA11y`).
Wires `useModalA11y` (focus-in + Tab trap + focus-restore + Esc + scroll-lock)
into schedule / sponsors / budget / supplies / vendor-dashboard overlays:

- `dashboard/[eventId]/budget/_components/budget-allocation-planner.tsx` (TiltEditor)
- `dashboard/[eventId]/schedule/_components/emcee-script-button.tsx`
- `dashboard/[eventId]/schedule/_components/prep-item-controls.tsx`
- `dashboard/[eventId]/sponsors/_components/add-sponsor-modal.tsx`
- `dashboard/[eventId]/sponsors/_components/invitation-template-modal.tsx`
- `dashboard/[eventId]/studio/supplies-marketplace/_components/cart-drawer.tsx`
- `vendor-dashboard/bookings/_components/vendor-prep-add.tsx`

Mid-submit guards preserved via `onClose` wrappers; original label/close-button
focus preserved via `initialFocusRef`; unrelated effects (draft re-seed, input
auto-focus) left intact.

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
