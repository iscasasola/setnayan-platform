## 2026-07-30 · test(guard): a kill-switch that nothing checks isn't a kill-switch — pin the flag chokepoint

Closes `WHATS_NEXT_Explore_Marketplace_2026-07-29.md` §5.3, verbatim: *"Hardcoding
`const replan = true` in `shortlist-categories.tsx` (bypassing
`isExploreReplanEnabled()`) breaks **no** test — the full suite stays green."*

A flag-dark feature makes exactly one promise: **flag OFF renders what production
rendered before.** Nothing enforced it. The unit suite runs with the flag unset,
so a branch that stopped consulting the flag tested green in the one state where
it was wrong — and the Explore replan wave shipped ten PRs against that promise.

New `lib/flag-chokepoint-scan.test.ts` — a repo scan, registry-driven, four
properties per flag:

1. **One reader.** `process.env.<FLAG>` appears in exactly one module, its
   helper. A second reader is a second default, and they diverge the day someone
   writes `=== 'true'` beside `!== 'false'`. (Test files excluded — they set the
   var on purpose to drive both states.)
2. **The gates still call it.** The six load-bearing surfaces are named one by
   one — `customer-menu` · `budget-build` · `services-takeover` ·
   `shortlist-categories` · `build-locked` · `build-compare` — so the failure
   says *which* gate went dark. Comments are stripped first, so a docblock
   mentioning the helper doesn't count as asking it.
3. **The pure cores don't.** `bench-sort` · `bench-card-actions` · `your-team` ·
   `plans-panel` receive the flag as a parameter and must keep doing so: a pure
   core that reads the env itself can no longer be exercised in both states in
   one test process. Writing this check is what surfaced that those four only
   *mention* the helper in a docblock — the injection is the design, not an
   omission, and now it's pinned as such.
4. **No hardcoded local.** No file that is supposed to consult the flag may
   assign `replan` a boolean literal. §5.3's exact scenario.

**Mutation-checked** against the reported bug: putting `const replan = true` back
into `shortlist-categories.tsx` turns properties 2 **and** 4 red, and the failure
names the file.

What this deliberately does NOT do: prove that a flag-OFF *render* is
byte-identical. That needs a build with the flag on — CI's job, not a unit test's.
It proves the flag is still the only thing being asked.

Adding the next flag-dark feature to the registry is one entry; it inherits all
four checks.

SPEC IMPACT: None. Closes §5.3 of the handoff (the last of its four open
build/guard items); logged in `DECISION_LOG.md`.
