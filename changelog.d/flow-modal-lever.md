## 2026-06-20 · feat(ui): shared useEscapeKey hook + 3 modal conversions — modal lever (flow wave E)

The user-flow audit found many overlays missing Escape-to-dismiss (a keyboard/accessibility dead-end) or hand-rolling the same keydown listener inline (~22 modal findings). This adds the single shared hook every modal/sheet/popover should use, and converts the first batch.

- **`apps/web/lib/use-escape-key.ts`** (new) — `useEscapeKey(onEscape, active=true)`. One overlay = one call; pass `active=false` to suspend mid-submit.
- **Converted 3 overlays** (all custom — not native `<dialog>`, which gets Esc for free):
  - `_components/ceremony-type-modal.tsx` (audit HIGH "missing Escape") — `useEscapeKey(onClose, !pending)`.
  - `app/_components/requirements-modal.tsx` (shared per-category inquiry editor) — `useEscapeKey(onClose, !isSubmitting)`.
  - `studio/supplies-marketplace/_components/cart-drawer.tsx` — `useEscapeKey(onClose)`.

Foundation + 3 conversions; the rest of the per-modal sweep follows incrementally, and a `useFocusTrap` companion is a separate follow-up.

Verified: hook created; all 3 modals import + call it (suspended mid-submit where a pending guard exists); all files pre-flighted clear of open PRs. tsc/lint/build via CI.

SPEC IMPACT: design-system/UX only. Flow wave E. Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`.
