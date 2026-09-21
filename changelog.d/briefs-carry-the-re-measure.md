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

Owner decision recorded: **an unpaid booking fee removes access** (event hub, portfolio, fuller
event detail, gathering and sharing data, reviews, stats) and does **not** pause new inquiries. The
owner's list ends "and more"; the brief and register both say that tail must be closed with the
owner before anything is built.

SPEC IMPACT: `DECISION_LOG.md` — the unpaid-booking-fee access question moves from open to decided.
Applied directly in the corpus per the 2026-06-04 standing authorization.
