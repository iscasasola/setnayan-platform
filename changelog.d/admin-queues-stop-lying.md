## 2026-08-17 · fix(admin): the four queues that said "all clear" over a read that never ran

`/admin/approvals` · `/admin/fraud` · `/admin/force-majeure` · `/admin/budget-planner`. These are the four where being wrongly reassured costs the most, and all four were reassuring.

Supabase **resolves with `{ error }`** instead of throwing, so a rejected read arrives as `data: null`, `?? []` makes it an empty array, and the page states the absence as fact:

| surface | what a refused read said |
|---|---|
| `/admin/approvals` | *"No approvals pending. Set na 'yan."* — on the four-eyes queue whose ONLY job is that a second admin looks before something irreversible executes. It also capped the decision history at **10** and never said so. |
| `/admin/fraud` | *"No open fraud signals."* under a **green tick**, on the desk that bans businesses. Its `scores` read did not bind `error` at all. |
| `/admin/force-majeure` | said BOTH things at once — an error alert, and *"Nothing in this view."* three inches below it. |
| `/admin/budget-planner` | *"Not enough data yet. Insights appear here once enough couples have saved budget plans."* — a claim about customer behaviour, from a query that may never have run. |

### 🔑 THE TABLE IS NOT WHERE THE LIE LIVES — and the lane brief was wrong about this

On `/admin/fraud` and `/admin/approvals` the `<table>` is the **audit trail at the bottom**; the queue itself is a `<ul>` of cards. **Converting the table would have fixed the trail, left the reassuring sentence exactly where it was, and ticked the file off the bill.** `ErrorState` is not table-specific, so the card lists use it directly. Written into the archetype's docblock, because the brief I wrote told other sessions to convert the table and move on.

### The privacy claim was the worse half

`fetchAllocationAggregates` returned `suppressedBelowMinN: false` on a refused read — asserting **nothing had been withheld for k-anonymity** when nothing had been read at all. A false "nothing was hidden" is a different and more serious statement than a false zero. The loader now carries `measured`, both failure paths return one shared value so a caller cannot treat one as data and the other as absence, and the page can only make that claim when it counted something. Single caller, verified.

Also: two audit trails **vanished entirely** on a refused read (`audit.length > 0`, `decided.length > 0`), removing the enforcement and decision history from surfaces that ban businesses and gate irreversible grants. Both now always render and let the archetype pick the state.

### Fails toward the caveat

A refused LABEL read does not change the row count, so the table cannot see it — but the page must:

- `/admin/fraud` — the **evidence** read was swallowed, so a refused query rendered every card with **no evidence chips at all**: a flag that looks raised on no basis. Now says so, and says not to confirm fraud from that state.
- `/admin/approvals` — a four-eyes request whose target reads as a raw id is not safe to approve.
- `/admin/budget-planner` — both settings reads fed an **editable form**; refused, an admin sees an empty form and saving it would replace the real bands with nothing.
- `/admin/pax-changes` — 🛑 **FOUND BY THE NEW RULE IN A FILE I SHIPPED TO PRODUCTION YESTERDAY.** Both name lookups destructured `{ data: … }` with no error bound, so a refused lookup rendered every row's supplier and wedding as "—" on a dispute-mediation trail. The row count was honest; the labels were not.

### The guard got two new rules, and one of them cried wolf

**A blanket ban on `?? []` was both too blunt and too weak.** Too blunt: a label lookup legitimately falls back to an empty list. Too weak: on `/admin/fraud` those label reads were swallowed entirely and a rule examining only the primary read passed it. ⇒ The invariant is not "never coerce", it is **"never coerce a read whose failure nothing can see"** — every `X.data ?? []` must have `X`'s error bound.

Second rule: the **destructure-and-rename** form (`const { data: us } = await …` then `(us ?? [])`) never writes `us.data`, so the first rule could not see it. That form found **three real instances in code that had merged an hour earlier** (two genuine label swallows in the studio surfaces, now bound).

🪤 **AND IT CRIED WOLF ON THE THIRD.** `demo-vendors-surface`'s unbound read ends in `return isAdminProfile(profile)` — a refused read yields null, yields false, and **DENIES**. That is the correct failure mode. Narrowed with a reasoned exemption naming why, because a guard that cries wolf teaches you to skim past the one time it is right.
⚖ **The distinction is not "is the error bound" but WHAT AN ABSENCE MEANS: absence that RENDERS as data is the defect; absence that DENIES is the fix.**

### Verification

11/11 guard assertions · **8,572 unit tests** · typecheck clean · port lint passes. Six mutations, occurrence count printed before → after on comment-STRIPPED source (the number the guard actually sees), every one RED, restored from an explicit backup copy and re-verified green. Committed before mutating.

The merge conflict in the shared guard file was resolved by the published protocol — union on `CONVERTED`, and the bill **re-derived by measuring** rather than hand-picked — and lane C's 11th assertion, which pins `CONVERTED` to the measured set, is what proves the resolution rather than my memory of it.

⚠ **NOT OBSERVED.** `/admin` sits behind a login, so every claim here is test-proved and hand-measured, never seen on a screen. Do not upgrade it to "verified live".

SPEC IMPACT: None — internal admin surfaces, one shared loader, no schema, no migration.
