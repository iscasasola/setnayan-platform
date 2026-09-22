## 2026-09-22 · feat(admin): a refund over ₱25,000 takes two admins, per Vendor Agreement § 9.1

**The number was never missing.** `/help` published, live, that "the exact refund threshold is
set in the Vendor Agreement" — and § 9.1 of that agreement states it outright:

| Refund any single transaction **> ₱25,000** | Financial control |
| **Process a refund** ≤ ₱25,000 | Disputes Handler · Payments Handler |

It was also sitting in a comment above `refundOrder` ("refunds > ₱25K is V1.x") since the pilot.
A session nonetheless escalated it to the owner as a number that could not be known here.
⚠ **An absence is a claim about where you looked.**

**The help page misquoted the clause it cited, in both directions.** § 9.1 contains no
"ad-revenue activation", no "force-majeure bulk resolution" and no "blanket policy update" —
those were invented. It omitted five rows it does contain. And it listed "vendor verification
override" as needing two admins when § 9.1 names approving a verification queue item as
*single*-admin authority — the page told suppliers a routine action was double-checked.
🔑 **A citation is not a quotation**; the clause number is what made it credible and what
stopped anyone opening the clause.

What changed:

- `lib/two-admin-promise.ts` — rewritten as § 9.1's nine rows with the thresholds as constants
  (`REFUND_TWO_ADMIN_THRESHOLD_PHP` = 25,000 · `COMP_TWO_ADMIN_THRESHOLD_PHP` = 10,000) and
  `refundNeedsTwoAdmins()`. The boundary is **strict**: at exactly ₱25,000 one admin is enough,
  because § 9.1 grants the Disputes Handler that authority and widening it would take back
  something the vendor signed for.
- `supabase/migrations/20271241619056_…` — `approve_large_refund` added to the
  `admin_approval_requests` CHECK, re-listed **from production** (`pg_get_constraintdef`), not
  from the migration history, which holds an `approve_vendor_subscription` the live constraint
  does not have.
- `app/admin/payments/actions.ts` — `refundOrder` opens an approval above the threshold and
  refunds directly at or below it. The refund body is extracted to one `applyRefund`, so the
  single-admin and two-admin paths cannot grow different side effects; `executeLargeRefund`
  re-reads and re-guards the order rather than trusting a payload up to 72 hours old.
- `app/admin/approvals/actions.ts` — the dispatcher arm. The amount comes from the **payload**,
  never re-read from the order: the second admin approves the number the first one wrote down.
- `lib/help.ts` — the article now states § 9.1's actual list and both figures.
- `lib/contact-addresses.ts` — `SUPPORT_EMAIL` now `live@setnayan.com`. `support@` was published
  for months and **never existed**: the domain's iCloud+ plan caps at three addresses and all
  three were spent (`live@`, `dpo@`, `noreply@`). Owner ruled 2026-09-22. 🔑 **A domain accepting
  mail is not a mailbox existing.**

Guards (each verified by sabotage — removing the gate, drifting the constant, hard-coding the
literal, attributing the refund to the initiator, and opening a second door each turn one red):

- `the-two-admin-promise-is-tracked.test.ts` — the page and the clause list must agree in both
  directions; the figures on the page must equal the constants; the action must hold no literal
  of its own. Its sentence parser now splits on a comma **not inside a number** — `₱25,000` cut
  in half made it report "000 retail" as an untracked promise.
  ⚠ One test here was **replaced**: it used to assert the refund row kept *saying* the threshold
  lived in the contract, a guard against inventing a number. It was doing real work and was still
  wrong — it protected an absence that was a failure to look, and told every session not to look.
- `money-actions-take-two-admins.test.ts` — the gate must precede the refund, the executor has
  exactly one door, and it attributes to the confirming admin. Its reachability check now asks
  whether a file **calls or imports** the symbol rather than merely names it: documenting which
  executor enforces which row had made it report a note string as a second door.
  🔑 **Naming a function is not reaching it.**

⚠ **Four § 9.1 rows remain unenforced and are recorded as such**, not as TODOs — the clause binds
today: the BDO/GCash receiving-account change (arguably the highest-consequence row, since it
redirects every future payment), mid-quarter SKU price changes, non-fraud vendor force-delisting,
and re-publishing a rejected vendor application.

SPEC IMPACT: None. The Vendor Agreement is unchanged — this makes the code and the help page
conform to § 9.1 as already written and signed.
