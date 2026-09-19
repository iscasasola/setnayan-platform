## 2026-09-19 · fix(couple): the last couple-facing refused reads keep their reason (S41b · couple 8)

COUPLE-FACING tier of `result-dropped-silently` (S26 baseline, #5625), batch 8:
the sites in files that S41's open batches also touch. There are 58 sites: 54
couple-tier plus 4 other-tier sites in the same files. All are option (a), join
the missing end. Every degrade is deliberate and documented, and each one stays.
A refused read now records `[supabase-error] <file> · <target>` with the error
object instead of taking the absence branch silently.

Files: story editorial data ×10, story spine ×6, the guest page loaders ×4,
your-own-day ×2, entitlements ×4, event-media sweep ×4, live wall ×2, Papic
cameras ×4, Papic One ×4, seating ×4, story arrangement ×2, story cover, photo
delivery drain, supplier night-before email ×2, supplier marketplace info,
delete-actions membership, mood-board render ×3, admin payments ×2, Panood
control.

Stacked on S41's #5650 #5653 #5654 #5656 #5657 #5659 #5660 (no migrations), so
the new lines sit beside theirs. Trial merges with every other open PR touching
these files are clean: #5641 #5642 #5643 #5646 #5652 #5608 #5625 #5655 #5658.

Left out on purpose: 5 sites in `papic-guest-buy-panel.tsx`,
`vendor-papic-grants.ts`, `vendor-photo-challenge.ts` and `vendor-seats.ts`,
which are #5652's files. #5652 fails `lib/the-fee-reaches-the-allowance.test.ts`
("an unread ledger grants nothing" pins `if (error) return null`), so they wait
for that fix. `build-3state-actions.ts` is retired by #5646.

Proof: `lib/couple-reads-keep-their-reason-2.test.ts` executes three floor-plan
readers against a refusing client. Each must keep its degrade and leave exactly
one record carrying the error, and a genuine absence must leave none (6/6).
Deleting any one log line turns exactly one test red. The 195 existing test
files that reference the touched modules pass (2017/2017).

SPEC IMPACT: None
