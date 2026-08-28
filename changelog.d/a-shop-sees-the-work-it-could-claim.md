## 2026-08-29 · feat(vendor): crew shifts work — a host can post one, a booked shop can see it and claim it

It was on a list as **one dead read**. Measured against production, it is **five walls**, each alone
enough to make the whole feature silent:

| | |
|---|---|
| 1 | `manpower_gigs.vendor_profile_id` was **NOT NULL in production** while the repo's own `CREATE TABLE` declares it nullable. The model is "an open gig has a NULL vendor" — so **an open gig could not exist**. |
| 2 | **Zero INSERT policies.** The host could not post one. `postManpowerGig`'s comment asserted "the policy model is INSERT-allowed-for-authenticated" — there was no such policy. |
| 3 | **No SELECT policy matched an OPEN gig.** All three vendor reads key on the gig already being the caller's; NULL matches none. |
| 4 | The surface's `event_vendors` gate ran on the vendor's own session, and that table admits no vendor — so the open-gig query **never ran at all**. Fourth site of that bug. |
| 5 | **Zero UPDATE policies.** Nobody but an admin could claim one. |

🔑 **The plan this came from says "not four missing policies, it is a SCHEMA DRIFT."** That is half
right, and the wrong half costs a re-diagnosis: it is the drift **and** the missing policies **and**
the dead gate. Repairing only the drift leaves the feature exactly as silent.

**What ships:** the drift repaired (production made to agree with the repo), a host INSERT policy
pinned to *their own celebration, in their own name, open and pending*, a booked-vendor SELECT
policy for **open, claimable** shifts only, a single-winner `claim_manpower_gig` RPC, and the
surface gate repaired via the same shared helper as the other three sites.

🔒 **Claiming is an RPC, and there is deliberately still NO update policy.** `authenticated` holds
UPDATE on every column, so any policy wide enough to permit a claim is wide enough to let a shop
**rewrite the fee it is about to be paid**. A test proves it cannot.

⛔ **A shop sees work it can TAKE, never a record of what a rival was paid** — once claimed, the
shift leaves every other shop's view. And **a lost race never names the winner**.

⚠ **The replay cannot prove the drift.** `tests/db/` builds from the repo file, which already had
the nullable column, so these tests would have passed before this change too. The drift was measured
against production and the migration **dry-run against production inside `BEGIN…ROLLBACK`** —
post-conditions verified, then rolled back and production confirmed unchanged. Said in the test file
itself, not just here.

🪤 **Two of my own tests were decoration and mutation caught both:** one could not isolate the
open-gig clause (the rival was not booked, so a different gate was doing the work), and one guards a
race a serial test cannot reach — now asserted structurally, with the reason stated rather than
hidden.

🛡 typecheck 0/exit 0 · unit **11,225** · db **1,821** · **11 mutations, all measured, all RED after
the two repairs**. Exposure baseline regenerated: **3 new facts, all this feature, none reaching
`anon`**; the only removed lines are the header counters.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-29 + corrects the crew-shift row in
`WHATS_NEXT_The_Three_Dead_Answers_2026-08-27.md`. Closes the last named-not-fixed item from the
`event_vendors` sweep — that guard's exemption list is now **empty**.
