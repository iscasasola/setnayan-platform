# The end-to-end run, and the owner's lifecycle ruling

## 🔑 THE RULING — verbatim, and it is load-bearing

> **"Plan should only fill at lock. not when accepted. accepting it allows the
> user to test different builds properly."**

> **"combinations of the different vendors"**

> **"when lock and they have the complete handshake and the vendor pays us the
> booking fee. budget planner should fill up the quotation."**

> **"remember, they only proceed to deliver the free papic credits (if there is),
> lock on the vendor schedule, finalize location and date (if ever it locks to a
> final place or date for the event), adds to the budget planner, and records 1
> locked customer for the vendor. upon the vendor paying their booking fee. also
> announces to the other shortlist of the vendors (each event of different users)
> how many vacancies that are left (if setnayan AI is activated?)"**

> **"this means, it becomes final once we approve that we received their payment.
> that is when everything triggers."**

> **"they can do updates and must be reaccepted. so they can negotiate of the
> benefits."**

## What that means, in one line

**Accepting a quote commits NOTHING.** A couple may hold several accepted quotes
side by side and compare *combinations of different vendors* — that is the
feature, not a gap.

**Everything fires at ONE moment: when an admin acknowledges that the supplier's
booking fee was received.** Not at accept. Not at lock-request. Not when the
supplier claims to have paid.

## The seven things that must fire at that single moment

1. deliver the free Papic credits — **if there are any** (the booking used for
   this run offered none, so this branch is untested)
2. lock the vendor's schedule for that date
3. finalize the event's location and date, **if** the booking is the thing that
   fixes them
4. add the quotation to the budget planner
5. record **1 locked customer** for the vendor
6. announce remaining vacancies to the other vendors on that event's shortlist
   — *"if setnayan AI is activated?"* — **the owner ended this one with a question
   mark. It is not settled. Ask before building it.**
7. *(the owner asked: "check if there are more that should be triggered" — that
   check has not been done. Do it and bring him the list.)*

## Where the run actually stopped

| # | step | state |
|---|---|---|
| 1 | couple sends an inquiry | ✅ |
| 2 | supplier sends a quote | ✅ |
| 3 | couple accepts | ✅ proposal `S89J-474WCSEJN5` = `accepted` |
| 4 | **supplier requests Lock** | ❌ `lock_requested_at` IS NULL |
| 5 | couple agrees to Lock | ❌ `lock_agreed_at` IS NULL |
| 6 | supplier pays fee · admin acknowledges | ❌ `booking_fee_charges` = 0 rows |

The live booking: event `rosa-ben`, supplier **Saysay Host and Band**,
`status = shortlisted`, `total_cost_php = 10170.00`.

## A trap that already cost this session a wrong answer

A session reported *"the budget is empty after accept"* — it had queried
`event_vendor_line_items` (0 rows). **The budget reads
`event_vendors.total_cost_php`**, which held `10170.00` all along.

🔑 **Find the writer of the number on the screen before declaring it missing.** A
rendered number's second writer is usually a server action.

## Verify each step with SQL, never with the screen

```sql
select status, total_cost_php, lock_requested_at, lock_agreed_at,
       deposit_amount_php, deposit_paid_at, contract_signed_at
from event_vendors
where event_id = (select id from events where slug = 'rosa-ben');

select count(*) from vendor_lock_proposals;
select count(*) from vendor_contracts;
select count(*) from booking_fee_charges;
select count(*) from orders;          -- 6 at handoff, four paid and receipted
```

## Who to run it as

⚠ **`testnayan1`, by email + password. NEVER the Google button.**
The owner's own account `iscasasolaii@gmail.com` has `is_internal = TRUE` and
**passes every paid gate**, so a run on it is a false green from end to end.

Standing authorisation (2026-09-16): **prod test writes are allowed on the
owner's own event, provided the state is restored afterwards.**
