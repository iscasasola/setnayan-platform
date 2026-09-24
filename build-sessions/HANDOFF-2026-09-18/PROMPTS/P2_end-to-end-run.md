# P2 · Drive the end-to-end booking run to completion

> **Model: Fable · effort: high.** This is mostly *driving and measuring*, not
> building — but it will surface builds, and you should open PRs for them.

## What this is

The platform's **first complete booking**, driven by the owner through the live
site with you confirming every step by SQL. It is stuck at **step 4 of 6**.

| # | step | state 2026-09-18 |
|---|---|---|
| 1 | couple sends an inquiry | done |
| 2 | supplier sends a quote | done |
| 3 | couple accepts | done — proposal `S89J-474WCSEJN5` = `accepted` |
| 4 | **supplier requests Lock** | `lock_requested_at` IS NULL |
| 5 | couple agrees to Lock | `lock_agreed_at` IS NULL |
| 6 | supplier pays fee · admin acknowledges | `booking_fee_charges` = 0 rows |

The live booking: event `rosa-ben`, supplier **Saysay Host and Band**,
`status = shortlisted`, `total_cost_php = 10170.00`.

## Read `03_END_TO_END.md` first — the owner's lifecycle ruling is load-bearing

In one line: **nothing fires at accept; everything fires when an admin
acknowledges the supplier's booking-fee payment.** Accepting commits nothing on
purpose — the couple is meant to hold several accepted quotes and compare
*"combinations of different vendors."*

Seven things must fire at that single moment. The owner asked
**"check if there are more that should be triggered"** — that check has not been
done. **Do it and bring him the list.**

⚠ One of the seven ends in his own question mark — *"announces to the other
shortlist … (if setnayan AI is activated?)"*. **It is not settled. Ask.**

## The blocker that is his, not yours

`BOOKING_FEE_RAIL_LIVE` is **absent from Vercel Production**. The gate is
two-key, so the fee can never charge and `booking_fee_charges` is 0 for that
reason — not because nobody tried.
```bash
vercel env ls production | grep BOOKING_FEE
```
🔑 **`vercel env ls` says set/not-set and absence is decisive.** Do NOT grep the
production bundle for the flag name — Next inlines the *value* and drops the name,
so you get a confident wrong zero. **Setting it is an owner action. Tell him
plainly that step 6 cannot complete without it.**

## How to verify — SQL, never the screen

```sql
select status, total_cost_php, lock_requested_at, lock_agreed_at,
       deposit_amount_php, deposit_paid_at, contract_signed_at
from event_vendors where event_id = (select id from events where slug = 'rosa-ben');
select count(*) from vendor_lock_proposals;
select count(*) from vendor_contracts;
select count(*) from booking_fee_charges;
```

⚠ **`testnayan1` by email + password, never the Google button.** The owner's own
account is `is_internal` and passes every paid gate — a run on it is a false
green end to end. Standing authorisation: prod test writes are allowed on his own
event provided you restore the state afterwards.

---

## The rules every one of these prompts inherits

- Read `04_TRAPS.md` before running anything. It is not optional reading.
- **Never read code from `/Users/icecasasola`** (~750 commits behind) or the
  primary checkout (1400+ behind). Use `git worktree add --detach /tmp/wt-<name> origin/main`.
  A fresh worktree has no `node_modules` — symlink from a worktree that has them.
- **RULE 0 — find it before you build it.** Run all four searches and paste the
  results into your first reply: `git grep -l` on origin/main, `gh pr list --state open`,
  `git worktree list`, `git log origin/main --oneline -15`.
- **Auto-merge immediately** after `gh pr create`: `gh pr merge <N> --auto --merge`.
  Never ask whether to.
- Add a `changelog.d/<branch-slug>.md` fragment with a `SPEC IMPACT:` line. Never
  edit `CHANGELOG.md` or `STATUS.md` in a feature PR.
- **Never weaken or delete a guard to go green.** If a guard fails against code you
  believe is correct, the usual fault is the guard's *window*, not its assertion.
- **Probe your own runner with a deliberate failure first.** A zero from an
  unproven harness is not evidence. Print the numbers you measured.
- Prune the worktree the moment the PR merges.
- Test as `testnayan1`, **email + password, never the Google button.**
