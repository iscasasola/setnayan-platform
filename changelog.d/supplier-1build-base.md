## 2026-11-08 · chore(train): land the PRs the supplier dashboard build sits on

One train branch (`claude/supplier-1build-base`) = origin/main + the merge-first PRs, generated files regenerated once
on the merged tree. Each carried PR keeps its own changelog fragment; this one records the train itself.

Carried, in merge order:
- #7298 badge rewards → gift stock; 1,000+ events = free booking fee (2 migrations)
- #7353 profile photo frame (carries #7351 open-shop sign-up v16–v19 and #7345 logo framer; 2 migrations)
- #7367 bundle maker to the approved design + Gift row (migration)
- #7357 the Thank-You maker moves into Memories
- #7360 → #7362 → #7363 Inspiration in Find · Home lines open what moved · copy sweep
- #7371 seven supplier pages batch their reads
- #7365 Add manually matches the makers-match sheet
- #7377 · #7379 dark-mode guards (mirrored ramp · flipping token)
- #7374 services life cycle — plan hold + stay-on (migration)
- #7336 "From couples" approved grid
- #7359 a held shop name holds its core (migration) — its `NameHold` seated in the v19 wizard's step 1, where #7351 left
  the marker for it
- #7373 an unverified shop is findable until its first inquiry (migration) — merged onto the 2026-11-06 demo-shops
  ruling: `LIVE_SHOP_GATE` = the findable rule alone (demo shops list, marked), `REAL_SHOP_GATE` adds "not a demo" for
  every total; event searches keep the event's own demo scope
- #7366 service card maker + one Gift dropdown (migration; owner kept #7366 over #7383) — `file-upload.tsx` carries
  both #7353's `pills` and #7366's `thumb`
- #7283 papic: retire the per-seat budget, the Unlock pass and PAPIC_SEATS (migration, now ALTER-before-UPDATE)

The #7298 table fix (own commit): the reward table now follows the owner-APPROVED per-step table (8 Nov, "Rewards
yes"): Service cards 3·6·10·20, Inspiration box 10·25·50·100·250 (now measured: approved, live inspiration photos)
and Branches 2·3·5·10 pay Papic 150 at every step; the five firsts (first booking · first review · first 5★ review ·
first Booked Loop · first 1st Pick) pay Papic 150 each — first review measured from trusted reviews; first 5★, first
loop and first 1st Pick drawn but never granted until a counter exists. Every other step re-checked and unchanged.

SPEC IMPACT: the #7298 reward table (`apps/web/lib/badge-rewards.ts`) now matches the approved per-step table in
`SUPPLIER_DASHBOARD_BUILD_PLAN_2026-11-08.md` "Owner answers, 8 Nov (second batch)"; the DECISION_LOG row is the
controller's to write.
