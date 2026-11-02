## 2026-06-25 · fix(checkout): a11y label association + copy/keyboard polish

Verified UX/a11y pass on the pricing→checkout flow (read off `origin/main`,
cross-checked against the `ui-ux-pro-max` skill's high-severity `ux`/`web`
rules). The flow already passes most rules via existing locks (global
`:focus-visible` ring, `SubmitButton` loading/aria-busy, `role="alert"`/
`role="status"` flashes, dialog semantics, QR alt text). Contained fixes:

- **`inline-checkout-drawer.tsx`** — the "Reference number" `<label>` had no
  `htmlFor` and its input no `id`/`aria-label` (screen readers announced a bare
  textbox). Now associated via `useId()`. The "Payment screenshot" orphan
  `<label>` (no `for` target) is replaced by passing `label` to `FileUpload`,
  whose dropzone input is already `htmlFor`-associated — matches the
  order-detail page convention. Added `autoComplete="off"` on the one-off
  transaction-reference input.
- **`inline-checkout-drawer.tsx`** — voucher helper text claimed "8 characters"
  while the field is `maxLength={16}`; dropped the incorrect count (copy now
  just states case-insensitivity). Fixed the matching stale header comment
  ("max 8 chars" → "max 16 chars").
- **`orders/[orderId]/page.tsx`** — added `inputMode="decimal"` to the
  amount-paid input for the right mobile keypad.

Note: the systemic modal focus-trap / initial-focus / focus-restore gap (G2)
is intentionally NOT in this PR — it's an app-wide shared-primitive change
shipping as a separate follow-up.

SPEC IMPACT: None — a11y/copy polish, no schema/SKU/pricing/flow change.
