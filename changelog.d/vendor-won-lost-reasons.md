## 2026-06-29 · feat(vendor): Won & Lost Reasons (Wave 6 "Soon" vendor benefit)

End-to-end self-reported inquiry-outcome capture so vendors (and admins) can see
what wins and loses inquiries — and why.

- **Migration `20270324681685_inquiry_outcomes_won_lost.sql`** (RLS at CREATE):
  - `inquiry_outcome_reason_codes` — ADMIN-MANAGED reason taxonomy
    `(reason_code PK, label, applies_to ∈ won|lost|no_response|any, sort_order,
    is_active)`. RLS: authenticated/anon read active rows; admin `FOR ALL` via
    `is_admin()`. Seeded a sensible starter set — the list lives in the TABLE,
    never hardcoded in app code (per `categories_db_not_hardcoded`).
  - `inquiry_outcomes` — one self-reported outcome per inquiry
    `(outcome ∈ won|lost|no_response, reason_code FK, free_text, anchors:
    chat_thread_id / vendor_proposal_id)`. RLS: vendor read/write OWN via
    `current_vendor_profile_ids()`; admin read ALL via `is_console_admin()`.
    One-outcome-per-inquiry enforced by a UNIQUE EXPRESSION INDEX on
    `(vendor_profile_id, COALESCE(vendor_proposal_id, chat_thread_id))`.
  - Two SECURITY DEFINER reporting RPCs: `vendor_inquiry_outcomes_rollup`
    (ownership-gated) + `admin_inquiry_outcomes_overview` (admin-gated).
- **Capture**: `recordInquiryOutcome` server action +
  `InquiryOutcomeCapture` card surfaced on the vendor thread surface in the
  resolved (accepted) and declined (thread-close) branches. Reason options are
  read from the taxonomy table and re-validated server-side.
- **Vendor roll-up**: `InquiryOutcomesRollup` mounted on the vendor Messages
  list — own won/lost/no-response totals + per-reason breakdown.
- **Admin**: `WonLostAdminCard` added beside the existing Peso-per-lead card on
  `/admin/insights` — platform aggregate of outcomes + top reasons.
- **Off-platform honesty**: "won" is labelled everywhere as a vendor SIGNAL,
  not a verified on-platform payment (Setnayan settles off-platform).
- **Deferred**: couple-side one-tap "why you passed" on declining a proposal
  (would complicate the couple proposal flow — parked); a dedicated admin
  reason-taxonomy editor (the table is admin-RLS'd `FOR ALL` and seeded, so it
  is manageable via SQL/admin tooling today — UI editor is a follow-up).

SPEC IMPACT: None (new vendor-benefit surface; no locked SKU/schema/branding
change). Logged here per the relaxed corpus-sync rule.
