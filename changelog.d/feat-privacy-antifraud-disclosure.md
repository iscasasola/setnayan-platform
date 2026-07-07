## 2026-07-08 · feat(privacy): disclose anti-fraud / trust-integrity processing on /privacy

Adds an **"Anti-fraud & trust integrity"** section to the public privacy policy page
(`apps/web/app/privacy/page.tsx`) disclosing the identity-clustering + fraud-scoring +
automated vendor-suspension processing that shipped live 2026-07-07 (DPIA R-08 / RoPA DPS-12).

Covers: what/why (device/address/payment-identity clustering to de-duplicate fake reviews &
bookings), lawful basis (RA 10173 § 12(f) legitimate interest, no new collection), automated-
decision disclosure + the right to object/appeal via the Help Center or DPO (§ 16(c) / § 34),
and what we do NOT do (no IP capture, internal-only, non-PII evidence, never sold/shared/used
to rank). References the existing DPO section rather than hardcoding a contact email.

Closes the **DPIA R-08 § 6 transparency gap** — the processing has been live without a published
notice.

> ⚠ **DRAFT / do-not-merge** until DPO + external PH counsel sign off — publishing a privacy
> disclosure is a legal/public act. Auto-merge intentionally NOT enabled.

SPEC IMPACT: Corresponds to the corpus draft `01_Contracts/Anti_Fraud_Privacy_Policy_Amendment_DRAFT_2026-07-08.md` (Setnayan-specs). No schema / SKU / pricing change.
