## 2026-06-25 · fix(a11y): remove nested dialog roles inside plan-card-compare's native <dialog>

Follow-up from the modal-a11y sweep's audit. `plan-card-compare.tsx` renders
three state-gated panels (slot picker, conflict warning, soft-hold-limit
warning) as content INSIDE its native `<dialog>` — but each carried its own
`role="dialog"`/`role="alertdialog"`, i.e. a dialog nested inside a dialog,
which misleads screen readers (they announce a nested modal that isn't one).

Replaced the redundant roles with semantically-correct ones (the native
`<dialog>` already provides the dialog semantics):
- slot picker: `role="dialog"` → `role="group"` (a labeled control cluster)
- conflict + soft-hold-limit warnings: `role="alertdialog"` → `role="alert"`
  (announced when they appear, no nested-dialog antipattern)

This was the one documented loose end after the focus-trap sweep; a full app
scan confirmed it was the only inline `role="dialog"` misuse (confirm-dialog is
a native `<dialog>`, onboarding-shell's sheet is a deferred real overlay).

SPEC IMPACT: None — a11y correctness, no schema/SKU/pricing/flow change.
