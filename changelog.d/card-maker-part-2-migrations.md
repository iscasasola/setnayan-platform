## 2026-11-17 · feat(db): Card Maker HYBRID part 2 — the schema (named pay plans · description + video link · Setnayan's starting What's included templates)

Three migrations, no app code. Waiting for the owner's OK; never applied to prod by hand.

- `20271350884376` — `vendor_pay_plans` (a shop's saved, named pay plans: "Payment Strategies"), `vendor_services.pay_plan_id`, a trigger that keeps a card on its own shop's plan, and `apply_vendor_pay_plan()` (copies a plan's rows onto each named card, the no-show terms on the first). A card keeps its own rows in `vendor_service_payment_schedules`; nothing that reads a schedule changes. RLS Pattern C + admin.
- `20271351531329` — `vendor_services.description` (≤ 1,000) and `video_url` (https only, ≤ 500), both optional; `copy_vendor_service_to_branch` redefined to carry them and the plan.
- `20271351904391` — `service_included_templates` (admin adds, edits and deletes templates per service; every signed-in account reads; a row can never carry a price — CHECK), seeded with a PROPOSAL: one "<service> basics" template for each of 281 services, all `is_proposal = TRUE`. Research notes: `docs/card-maker-part-2/`.
- DB test `a-pay-plan-is-saved-once-and-a-preset-carries-no-price.db.test.ts` (11 cases). Ugat baseline line for `vendor_pay_plans`.

SPEC IMPACT: None — implements DECISION_LOG 2026-11-17 rulings (saved pay plan bf69604a · presets 4906a9a8 · admin templates 7596f63a) and HYBRID map Q3; no ruling changes. The seed is a proposal for the owner, not a decision.
