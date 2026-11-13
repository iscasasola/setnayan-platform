## 2026-11-13 · fix(quotes): a demo-rule refusal says why instead of "please try again"

A demo shop (SetnaProd, `vendor_profiles.is_demo = true`) quoting a real event (`events.is_sample = false`) was refused by
`demoBookingRefusal` in `gateVendorProposalThread` — correctly — but the refusal returned `code: 'failed'`, and the chat
send action dropped the core's `message`, so the supplier saw "Couldn't send that quote. Please try again." A retry can
never pass the rule. Now: new `SendProposalError` `demo_scope` (gate + the `refuse_demo_cross_booking` trigger backstop
via `demoRefusalFromDbError`), notices `proposal_demo_shop` / `proposal_demo_event`, API route answers 422; the draft
insert and draft→sent flip failures now log their Postgres code.

SPEC IMPACT: None
