## 2026-06-25 · feat(a11y): focus-trap modal sweep (batch 1/4)

App-wide modal focus-management sweep (follow-up to #2134's `useModalA11y` /
#2139's Sheet primitive). Wires `useModalA11y` (focus-in + Tab trap +
focus-restore + Esc + scroll-lock) into hand-rolled overlays that declared
`role="dialog"`/`aria-modal` but managed no focus:

- `_components/app-store/choose-plan-sheet.tsx`
- `_components/requirements-modal.tsx`
- `_components/vendor-packages/lock-modal.tsx`
- `admin/connection-logs/connection-logs-client.tsx` (InspectModal)
- `components/billing/ManualCheckoutModal.tsx`
- `explore/_components/filter-drawer.tsx`
- `tour/budget/_components/tour-budget-planner.tsx` (TiltEditor)

Each replaces a bespoke Esc/scroll-lock effect (or adds the missing trap) with
one hook call; existing mid-submit Esc guards and close-button focus targets
preserved via the `onClose` wrapper / `initialFocusRef`.

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
