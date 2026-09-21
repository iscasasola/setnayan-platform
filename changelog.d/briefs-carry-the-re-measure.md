## 2026-09-22 · docs(handoff): the briefs carry their own re-measure, and one owner decision lands

Re-measured all four dispatch briefs (CTRL-B1…B4, 30 builds) against `origin/main` and the live
production database, one day after they were written.

- **3 of 30 builds are already done**, all in B1 — the fee bill's unreadable read (`169576a6e5`,
  fenced by `money-reads-are-honest.test.ts`), the `no_payer` re-mint (`unbilled-fee-repair`), and
  the waived-booking disclosure plus its receipt email (`booking-fee-disclosure.*`, fenced by
  `the-fee-finds-the-supplier.test.ts` and `the-waived-fee-sends-a-receipt.test.ts`). Struck through
  in place, originals kept in `<details>`.
- **All three closures had anchors that still grep NOTHING.** B1 build 7's anchor `highest_declared`
  returns empty on a tree where the feature shipped in full under other symbols. Recorded in the
  brief, because trusting that zero would have rebuilt a shipped subsystem.
- **B2 build 7's mechanism was wrong.** The autoblock trigger has three guards; prod's three
  `deposit_paid` rows fail guard 1 (`marketplace_vendor_id IS NULL`), not the status guard the brief
  blamed. The trigger's happy path has never run in production, and its failure branch is a bare
  `RAISE WARNING`, so a zero is consistent with three different worlds.
- **B3 build 1 is three surfaces, not one** — the RA 10173 claim also renders twice on `/features`,
  which `features-page-says-what-ships.test.ts` is currently letting through.
- **B3 build 10's prescription was wrong** and would have deleted something true: the two service
  lists read different tables and answer different questions (declared trades vs inquirable rows).
- **B3 build 12 is measured**: no slug-redirect mechanism exists anywhere in the repo.
- **B4's counts moved** — 146 guests, 0 invited, 5 with an email, 0 mobile-only.

**The register's §6 "does an unpaid booking fee remove anything?" was never open.** It was ruled on
2026-09-20 and the mechanism is already built and shipped dark behind `NEXT_PUBLIC_FEE_UNLOCKS_EVENT`
(`lib/event-access-stage.ts`, whose docblock carries the owner's seven items verbatim). Carrying it
as open cost the owner a second answer to a settled question — RULE 0 applies to decisions, not only
to code. The register and merge plan now say so, and record the two genuine deltas from his
2026-09-22 restatement: **reviews and stats**, which the shipped gate does not cover. Turning the
gate on is a flag in Vercel, not a merge.

SPEC IMPACT: `DECISION_LOG.md` — no new ruling; a row is added recording that the 2026-09-20
ruling was re-confirmed, that reviews/stats are a delta, and that the register wrongly carried it as
open. Applied directly in the corpus per the 2026-06-04 standing authorization.
