# S28 · Honest small fixes on the supplier side (8 items)

> **Model: Sonnet 5 · effort: medium.** Released by the controller. Theme: **make everything connect properly** (owner, 2026-09-18).

Source: `build-sessions/REGISTER-SWEEP-2026-09-18.md` on `main` (the full 456-row sweep, merged in #5590). **Every row is a hypothesis: re-measure it first**, and skip it (saying so) if it is already done. **One PR per item**, in sequence, with one worktree alive at a time. Prune each before starting the next.

- **SUP-51:** `notifyWaitlistSlot()` bypasses `notifyWaitlistForFreedDate`'s "genuinely open" check. Route it through the check, so there's no waitlist ping for a past or booked date.
- **SUP-84:** the admin subscriptions confirm message says "Payment confirmed and the plan activated" even for deferred downgrades. Say what actually happened.
- **SUP-91:** "Editorial & article spotlights" is still `soon: true`. Check whether it's live (LAU-20 approval now works, #5591). Fix the label only if it's true.
- **SUP-97:** delete the callerless `resolveSetnayanAiEventChargeCentavos` (confirm zero callers, including SQL).
- **SUP-98:** the corpus `VENDOR_TIERS_AND_BENEFITS.md` Custom-tier header still says "sign-off pending". Correct it (a corpus edit is authorized; the docx mirror is regenerated per COWORK.md).
- **SUP-50:** `the-venue-respects-privacy.test.ts` has a hand-rolled `strip()`. Switch it to `@/lib/strip-comments`.
- **SUP-45:** the vendor nav label "Performance" truncates at 10px. Fix it without shrinking the text below the legibility bar.
- **SUP-49:** `event-words-mounted.test.ts` `CONSUMERS` misses `supplier-desk.tsx` / `vendor-doorway.tsx`. Widen it, and prove the new entries would catch a regression.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S28 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S28 <what>" && { <cmd>; rc=$?; "$L" release "S28 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S28 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
