## 2026-07-22 · feat(privacy): DPO-approvable controls for the two vendor AI/data flows

Adds the Vendor AI (auto-reply) and Vendor Deep Search flows to the in-app Data
Privacy control board at `/admin/data-privacy`, so the owner/DPO approves each
before it can run — resolving the two privacy findings from the vendor-pricing
council verdict.

- `lib/data-privacy-controls.ts` — two new `PrivacyControlKey`s (`vendor_ai_autoreply`,
  `vendor_deep_search`) + catalog entries (title/description/category/riskNote).
  New `isDataPrivacyControlActiveWith(admin, key)` client-taking gate variant;
  `isDataPrivacyControlActive` now delegates to it.
- Seed migration `20270912318857_seed_vendor_ai_deepsearch_privacy_controls.sql`
  — inserts both controls `status='inactive'` (fail-closed), `ON CONFLICT DO NOTHING`.
- `lib/privacy-coverage.ts` — coverage entries for both keys, `declaredIn: []`
  (honestly undeclared → they surface as drift until the /privacy notice + ROPA
  cover them).
- Gates: `lib/vendor-autoreply/inbox-hook.ts` (reads through the hook's own admin
  client) and `app/vendor-dashboard/deep-search/actions.ts` — both fail-closed
  until the control is `active`.
- Tests: inbox-hook happy path seeds the control active; new fail-closed case
  proves an inactive control blocks the assistant.

SPEC IMPACT: None (in-app DPO control; the /privacy legal disclosure + ROPA
entries for these two flows remain an owner/counsel action, flagged separately).
