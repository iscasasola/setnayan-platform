## 2026-11-10 · feat(plans): the plan tables tell the truth (Build 6 Lane J)

Owner, 10 Nov: *"update the full FREE vs VERIFIED vs SOLO vs PRO vs ULTRA for suppliers on the for suppliers page and
here update FREE vs PLUS vs PRO if there are any changes"*.

- **/for-suppliers and /for-coordinators get the full side-by-side table** (Free · Verified · Solo · Pro · Ultra),
  one component (`supplier-plan-table.tsx`) drawn from one pure module (`plan-table-data.ts`). Every cell reads the
  code that enforces it: the six limits through the plan sheet's own `limitOf` / `limitWords` (Build 5 Lane B), seats
  and the waiting list through the flag-aware `allowance` (so it prints what the actions allow while the plan paywall
  is off), features from `TIER_CAPS`, the tools unlock from `SPECIALIZED_TOOLS_*`, gift vs list price from the new
  `tierPaysGiftPrice` (the server read now asks it too), Deep Search and the chatbot from the SKU each plan is charged,
  and only the locks the app ENFORCES (`LOCKS[k].server !== null`) — a ruled lock with no gate yet joins by itself
  the day its gate lands. Every peso is `getVendorPrices().bySku` (new) — nothing typed.
- "Bigger than Ultra? Add more." lists all six Ultra add-ons (it listed two), on both pages.
- **False claims fixed:** an unverified shop is findable until its first inquiry (both pages said "not in search yet" /
  "Only Verified shops are shown") · the /for-suppliers structured data still described Solo/Pro/Ultra with the
  pre-4 Nov caps · the front door's Event Plus card sold themes, own music, a web address, an entrance animation and a
  smaller mark that a Plus order does not unlock · Event Pro promised "No Setnayan marks" while two Hub pages still
  print one · the plan cards typed their credit counts and the free-credit number (now `included_papic_credits` and
  the live free grant) · "Event Hub Pro" (retired name) on /pricing, /features and the logo page · /features sold
  Setnayan AI on its own, described suppliers as "Free profile, optional paid tier" with "reply-only chat", had no
  Coordinator, said "4-in-1 Event Hub" and an unqualified "zero commission, always".
- /features gets the owner's light `user-select: none` on its sections only (text stays in the HTML, robots untouched).
- Guard: `app/for-suppliers/supplier-plan-table-tells-the-truth.test.ts` (8 tests; two sabotages measured red).

SPECIFIC NON-CHANGES: no catalogue row was written (production read with SELECT only); no migration.

SPEC IMPACT: one `DECISION_LOG.md` row, 2026-11-10 "PLAN TABLES REDRAWN FROM THE LIMIT CODE" — records that the
tables print only enforced limits/locks, that Event Plus grants only Setnayan AI + its credits today, and the price
rows listed for the owner (no price decided). The row text is in the PR body; this session could push only to its
platform branch, so the controller appends it to the corpus.
