## 2026-06-28 · docs(legal): launch-ready Terms of Service (replaces starter draft)

Rewrote `/terms` from the 9-section "starter draft" into a comprehensive,
19-section launch-ready Terms of Service grounded in the live product rules,
for owner + PH-counsel review before a full public launch.

New/expanded coverage: marketplace role + non-party-to-vendor-contracts
disclaimer · 0% commission / pay-vendor-directly / no-escrow · apply-then-pay
+ payment-proof verification · app transaction receipt vs BIR Official Receipt
· refunds (7-day + non-refundable custom/AI deliverables once production
begins) · vendor terms (accuracy, identity masking, subscriptions, real-event
reviews) · content licence + AI-output licensing + owned-catalogue music ·
acceptable use (mandatory non-disableable safety filter) · guest/face-data
scoping → Privacy Policy · RA 10173 · RA 8792 e-signatures · IP · disputes ·
force majeure · disclaimers/limitation of liability · indemnity · 14-day
change notice · governing law (Philippines, Quezon City venue).

Corrected a factual error in the old draft: it claimed "12% VAT is added on
top"; V1 launches NON-VAT (percentage-tax regime per iteration 0026), so the
page now states in-app prices are not subject to 12% VAT.

⚠ OWNER/COUNSEL TODO (flagged in a code comment + PR body, NOT auto-merged):
confirm the operating-entity legal name + DTI Business Name Reg. No. 8267788,
the Quezon City venue clause, the non-VAT tax statement, and the 12-month
liability cap before relying on this at public launch.

Pure content/JSX change to one page; no schema/SKU/pricing/flow change.

SPEC IMPACT: None for the iteration corpus — website legal-page content only.
Tax posture (non-VAT V1) aligns with iteration 0026 (BIR compliance).
