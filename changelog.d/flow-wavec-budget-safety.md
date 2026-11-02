## 2026-06-20 · fix(budget): confirm-before-delete + payment amount can't crash the page (flow wave C)

Two user-flow defects on the budget itemization card (`app/dashboard/[eventId]/_components/vendor-itemization-card.tsx`, rendered on both `/budget` and the vendor workspace), from the product-wide user-flow audit:

- **Delete had no confirmation (HIGH).** "Delete line item" and "Delete payment" fired instantly on a single tap — an irreversible mis-tap removed budget rows / logged payments with no undo. Both now use the shared `ConfirmForm` (the established lever-A confirm dialog: focus-trap + Esc + brand voice), with plain-English consequence copy ("It's removed from this vendor's budget — you can add it back anytime." / "The running total updates…").
- **Payment amount could crash the whole page (MED).** The three `amount_php` number inputs had `min={0}`, which lets the browser submit `0` — but the server (`parseRequiredMoney`, `v <= 0`) throws, and with no error boundary the throw bubbled to the **root** boundary (whole-app crash). Changed `min={0}` → `min={0.01}` on all three so the browser blocks the zero before it reaches the throwing action. (Labels already had `required` + `maxLength={64}` matching the server, so this closes the remaining common crash trigger at the source.)

Source-level fixes (the shared component), so both the budget page and the vendor workspace are covered without a budget-only error boundary.

Verified: 3× `min={0.01}` (0 remaining `min={0}`), 2 balanced `ConfirmForm` wraps + import, 0 bare delete `<form>`. tsc/lint/build via CI. Pre-flighted: no open PR touches this file.

SPEC IMPACT: none — bug fix only. Flow wave C (uncontended surfaces). Audit/backlog: `02_Specifications/UI_UX_Polish_Remediation_2026-06-20.md`.
