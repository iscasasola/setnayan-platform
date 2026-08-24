## 2026-08-24 · fix(budget): the couple's budget target refuses a delegate who was never given it

**W5-C item 0.** Production carries a live, accepted `wedding_planner_external`
on an event with a ₱930,000 target and `checkout: false`. `events_host` carries
`estimated_budget_centavos` and admits ANY accepted moderator, because
`current_moderator_event_ids()` has no area filter — and not one of the surfaces
that PRINT that figure ever asked which areas the delegate holds.

🔑 **Nothing here invents a policy.** `'budget'` has been a first-class delegate
area since migration `20261129000000` — declared, labelled, **defaulted OFF** in
`COORDINATOR_AREAS`, and resolved by `resolveAreaLevel` / the SQL
`moderator_area_level`, which is called correctly in nine other files. This is
the call site it never had. **No RLS, no grant and no view is touched**: the
coordinator legitimately needs that event for seating, schedule, guests and
vendors, so narrowing `events_host` would kill a working feature quietly.

⚠ **AND THE BRIEF UNDERSTATED IT — SHE COULD ALSO CHANGE THE NUMBER.**
`updateEventMatchCriteria` authorises on "member (couple/coordinator) OR accepted
moderator" and wrote `estimated_budget_centavos` through the **admin** client. A
delegate could overwrite the couple's target. Closed here.

🪤 **A fix at one site would not have been a fix.** Three surfaces print the
target and a delegate reaches all three: `/budget`, the **event home tile**
("committed of ₱930,000" — the first screen she lands on), and **Personalization**,
which had no membership gate of any kind and put the figure in an editable box.
The guard's file list is DERIVED from the code, not hand-typed.

🪤 **ABSENT ≠ EMPTY, and getting it backwards would have wiped the target.** The
form no longer posts `budget_pesos` to somebody who may not edit it, and an empty
`budget_pesos` legitimately means "clear my budget" — so the patch now omits the
column when the key never arrived, the same rule `recur_cadence` already follows.

⚖ Fail directions are opposite by design: **fail-OPEN for the owner of the money,
fail-CLOSED for a delegate.** A Supabase read that fails resolves with `{ error }`
and zero rows — identical to "no such row" — so a refusal is returned only when
both facts are known affirmatively. The refused screen wears the Ledger
archetype's **DENIED** state (`DeniedState`, which shipped with zero consumers),
never Empty: on a page about money, "you have none" is a different and worse lie.

🔒 `'view'` never becomes `'edit'` — locked D1, "budget never exceeds view in V1",
stated in the SQL function's own comment in production.

**Proof:** 11 new tests; **7 mutations, every one printed before → after and every
one RED** (gut the dashboard call 1→0 · unconditional budget write 1→0 · drop the
write refusal 1→0 · delete the page's refusal branch 1→0 · route budget through
`resolveAreaLevel`'s fail-open tail · `view`→`edit` · fail-closed on an unread
row). Typecheck exit 0. Full unit suite 9844/9844.

**Reported, not changed:** `/vendors` derives a budget-fit meter and a
within/near/over word from the target without printing a peso. That is a much
weaker signal a planner arguably needs, so it is left alone rather than widened
into this sweep.

SPEC IMPACT: None — this implements an existing locked decision (delegate area
`budget`, defaulted OFF, locked D1) that had no call site on the money screens.
