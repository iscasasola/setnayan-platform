## 2026-07-16 · docs(privacy): unified privacy notice — sharing + biometric + geo + anti-fraud disclosures

Reconciles the two open privacy-notice PRs into ONE complete, current public notice
(`apps/web/app/privacy/page.tsx` → `setnayan.com/privacy`). Owner (who holds the DPO
function) approved shipping on 2026-07-16. Content-only; no schema/SKU/pricing change.

Supersedes **PR #3299** (`claude/privacy-notice-sharing`) and folds in **PR #2865**
(`feat/privacy-antifraud-disclosure`) so no disclosure is lost:

- From #3299 (base): biometric face-data enrollment surfaces + account-wide-profile-off,
  photo/clip GPS + outbound EXIF strip (drop-if-strip-fails), guest-capture opt-in +
  couple-approval double gate + FaceBlock fail-closed, social featuring (per-artifact
  consent / recap opt-out / post-event-only), minors/dependents & religion never surfaced
  publicly, data-subject rights (`/api/profile/export`, face-forget).
- Folded in from #2865: a single **"Anti-fraud & trust integrity"** section disclosing the
  identity-clustering + fraud-scoring + reversible auto-suspend processing (device/address/
  payment-sender clustering, RA 10173 § 12(f) legitimate interest, § 16(c)/§ 34 automated-
  decision right-to-object, two-person gate on permanent action, internal-only non-PII
  evidence, no IP capture). Placed immediately before "Public Event Summary" per #2865's
  own anchor; no existing section rewritten, no duplication.
- "last updated" is 2026-07-16 across the page.

DPO contact left exactly as-is (`dpo@setnayan.com`) — the dpo@ vs iscasasolaii@gmail.com
question is still OPEN and owner has not decided it.

SPEC IMPACT: Implements item #10 of `Social_Sharing_Followthrough_Build_Plan_2026-07-16.md`
(owner-approved 2026-07-16) and closes the corresponding rows in the privacy reconciliation
gap register (`Privacy_Reconciliation_Home_and_Data_Flows_2026-07-13.md` / memory
`project_setnayan_privacy_reconciliation`) — biometric/geo/social-featuring/guest-consent
PLUS the anti-fraud/trust-integrity transparency gap (DPIA R-08 § 6 / RoPA DPS-12, corpus
`01_Contracts/Anti_Fraud_Privacy_Policy_Amendment_DRAFT_2026-07-08.md`). No schema / SKU /
pricing change.
