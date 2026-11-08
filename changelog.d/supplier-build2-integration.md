## 2026-11-08 · chore(supplier): Build 2 lanes A·B·C integrated into supplier-1build

Merged B2-C (Billing & receipts), B2-B (Shop · Makers · Portfolio) and B2-A (Clients one screen · Booked QR #34)
with no textual conflicts. Guard fixes on lane A's code: calendar day boxes route their radius through the
`--m-r-sm` token (`rounded-md`), the #34 Quotation sits inside the Services box instead of a second card, and the
quotation line's two cells carry the lines-editor `field-ok` reason. Regenerated the port-control baseline, Ugat
screens, migrations manifest (incl. the already-missing `20271327631190`) and the exposure baseline (ruled #34:
two `vendor_locked_qr_tokens` columns + invoker-rights `vendor_void_locked_qr`). Server actions stay 1237/1237.

SPEC IMPACT: None (integration only; each lane's own fragment carries its spec impact).
