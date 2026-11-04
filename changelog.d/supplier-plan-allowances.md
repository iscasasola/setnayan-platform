## 2026-11-04 · feat(plans): supplier plan allowances + branches per plan — the owner's numbers, read from `TIER_CAPS`

Owner 2026-11-04, DECISION_LOG "SUPPLIER PLAN ALLOWANCES" (*"pro reach 100, ultra nationwide · main categories solo 2
pro 8, ultra unlimited · service cards free 1, solo 3, pro 10, ultra unlimited · team seats 0,1,5,20 · waitlist
0,0,1,5 · website applies to solo as well"*; corrected the same day: *"team seats ultra 15 only"*) and "BRANCHES PER
PLAN" (*"branches 0,0,3,10"*). Free·Verified / Solo / Pro / Ultra; Custom in lockstep with Ultra.

- `lib/vendor-tier-caps.ts` `TIER_CAPS`: reach Pro 50→100, Ultra 100→nationwide (`Infinity`); categories Solo 1→2,
  Pro 3→8; cards per category Free·Verified 3→1, Pro 5→10; seats Pro 3→5, Ultra 10→15; waitlist Verified 1→0,
  Solo 1→0, Pro 3→1; own web address Solo false→true; NEW `branchesIncluded` 0·0·0·3·10; NEW `premiumPage` (the Pro
  page parts, split off `customWebsiteName` with its old values so Solo gets the address, not the Pro page).
  `MIN_SERVICES_PER_LEAF` retired. Stale `calls` capability + `canUseCalls` + `lib/thread-calls-rule.ts` removed;
  `resolveThreadCallsEnabled` no longer reads a plan.
- Migration `20271307996183`: `vendor_tier_limit` waitlist arm → 0/0/0/1/5/5, new `branches_included` key;
  `vendor_branches.included_in_plan`; trigger `enforce_included_branch_allowance` (refuses a row that BECOMES a live
  included branch past the plan; existing rows untouched).
- Branches: Pro/Ultra add included branches with no fee/order (`createBranch`), status reads `active`; only Ultra may
  buy more (`canBuyExtraBranches`, through the plan switch). Branch picker on Pro too (`planHasBranches`).
- Grandfathering: every cap is counted only on a NEW add (cards, categories, seats, waitlist picks, included
  branches); a shop above a lowered number keeps what it has.
- Copy reads `TIER_CAPS`: /for-suppliers matrix (+ Branches included · Extra branches · Waiting list · Own web
  address rows), Free/Solo/Pro/Ultra benefit lists, Plan screen lines (+ branches; "Comes with Solo"), Your page plan
  lines + the address ◆ naming the plan from the table, llms.txt tier table, /v/[slug] own address on Solo+ and
  "· serves nationwide" for Ultra. "In-app video & audio calls" card removed from /for-suppliers.
- Tests updated with the ruling cited; new `tests/db/vendor-plan-allowances.db.test.ts`.

SPEC IMPACT: the DECISION_LOG rows "SUPPLIER PLAN ALLOWANCES" and "BRANCHES PER PLAN" (2026-11-04) are the spec; the
first row still reads "team seats 0,1,5,20" — the owner's same-day correction to 15 needs recording there. Custom
pricing (`lib/vendor-custom-pricing.ts` `CUSTOM_BASE` seats 10 / reach 100 + a priced nationwide add-on) is NOT
touched — left to the price PR, flagged for the owner.
