## 2026-11-16 · fix(supplier-plans): plan purchase audit — four faults on the buy-a-plan path

Traced a Verified supplier buying Plus / Pro / Ultra end to end (`build-sessions/PLAN-PURCHASE-TRACE.md`) and fixed
the four pure-code faults found, each held by a guard that goes red without its fix:

- **A reject that changed nothing said "rejected".** `reject_vendor_subscription` is a zero-row UPDATE on an
  already-paid plan; `/admin/subscriptions` now reads the row back and only announces (banner + supplier notice) a row
  that is really `rejected`. 🔒 `app/admin/subscriptions/a-reject-that-changed-nothing-says-so.test.ts`
- **A plan confirmed or refused at /admin/subscriptions was still payable.** Its order stayed `awaiting_payment`, so
  `/pay/<ref>` drew a live QR. `planAwarePayableStatus` lets the plan row's final verdict settle or close it.
  🔒 `lib/a-confirmed-plan-is-not-payable-again.test.ts`
- **A lapsed plan kept its search reach.** Couple search sized reach and the true-name reveal off raw `tier_state`;
  the lapse sweep is login-driven, so an ended Ultra stayed nationwide. Search now reads `liveTierState`.
  🔒 `lib/search-reads-the-live-plan.test.ts`
- **Plus was called "solo"** in the admin and supplier plan notices and the admin fallback label — now `planWord`.
  🔒 `lib/a-plan-is-named-the-same-everywhere.test.ts`

DB proof on the replay: `tests/db/a-verified-shop-can-buy-a-plan.db.test.ts` (chosen → paid → active → lapses, for all
three plans). Two owner questions are open in the trace (one confirm desk + receipts; a warning before a plan ends).

SPEC IMPACT: None — no rule changed; two open owner questions recorded in the trace file.
