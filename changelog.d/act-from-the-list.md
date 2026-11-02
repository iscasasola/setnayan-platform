## 2026-08-04 · feat(admin): settle a queue item from the work list, without leaving it

The owner's original ask, from the admin simplification: *"a faster way to respond to quick actions needed instead of them making jump to a new page."*

Open a row on `/admin/work` and the actual waiting items appear underneath it. A pending payment can be confirmed right there.

### Three kinds of queue — the distinction IS the design

| Kind | Treatment | Why |
|---|---|---|
| **Fact** | one click | The money arrived or it did not. Payments ships first. |
| **Judgement** | **no button at all** | Disputes · fraud · user reports · integrity watch · AI abuse · erasure requests · force majeure. A fast button invites a wrong call at speed on exactly the queues where being wrong costs most. |
| **Needs details** | a form, later | Payouts records a transfer the admin made **by hand** and needs the method **and** the reference. One click would invent them or save a record nobody can reconcile. |

A judgement queue **shows its reason where the buttons would be** — silence reads as an unfinished feature; the sentence teaches the rule.

A queue with no peek renders exactly as before. Adding one is opt-in, so a new queue can never inherit a half-built action surface.

### Mechanism

`?open=<queue>` — URL-driven, the convention `?lane=` set earlier today. The feed stays a **Server Component**, it works with JS off, an opened queue is bookmarkable, and only the named row pays for a query.

**The money logic is not duplicated.** `approvePayment` ends in `redirect('/admin/payments')` — right for that page, and exactly the jump the owner asked to remove. It already had a non-redirecting half (`approvePaymentCore`, which returns its outcome for the batch path); the list calls that and revalidates in place. One core, two entry points, so the list can never drift from the page.

A refusal (a shortfall — the payment does not cover the order) bounces back to **the same list view**, lane and open-row intact, with the reason. The admin never lands somewhere else to find out why a row did not clear.

### The guard earned its keep

All three column names in the first draft were wrong — `amount_centavos`, `method`, `reference_code` against a table that has `amount_php`, `channel`, `reference_number`. `lib/security/select-column-scan.test.ts` caught every one. **A Supabase select naming a phantom column returns an error, not a crash**, so this would have shipped as a drawer that was silently always empty.

Verified: unit suite **6,483 pass / 4 fail** — the same four pre-existing `@electric-sql/pglite` module failures on unmodified `origin/main` · lint clean · zero typecheck errors in the changed files.

⏭ Next: the remaining fact queues (verify, approvals, reviews, completions), then the payouts form.

SPEC IMPACT: None — no new rule; one existing action gains a second, non-redirecting entry point.
