## 2026-06-25 · feat(a11y): focus-trap modal sweep (batch 2/4)

App-wide modal focus-management sweep (follow-up to #2134's `useModalA11y`).
Wires `useModalA11y` (focus-in + Tab trap + focus-restore + Esc + scroll-lock)
into dashboard `_components` overlays:

- `dashboard/[eventId]/_components/ceremony-type-modal.tsx`
- `dashboard/[eventId]/_components/new-manual-vendor-modal.tsx`
- `dashboard/[eventId]/_components/plan-card-lock.tsx`
- `dashboard/[eventId]/_components/switch-vendor-confirm.tsx`

Mid-submit Esc guards (`!pending`) preserved via the `onClose` wrapper;
original first-field/cancel-button focus preserved via `initialFocusRef`.
`event-switcher.tsx` deliberately left out — it's a non-modal anchored
menu/popover plus a separate confirm dialog; handled separately.

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
