# S17 · Refund wording: /pay says Refunded, and an event-less refund notice links somewhere

> **Model: Sonnet 5 · effort: low.** DO NOT OPEN until the controller says so. Source: S4's refunds measurement (refunds are built; these are the 2 wording/link gaps).

1. `/pay/[reference]` treats a `refunded` order as settled ("Paid · This one is settled… Thank you"). Make a refunded order say that it was refunded.
2. The `payment_refunded` notification has no link when the order has no event (`ONBOARDING_SERVICES` orders). Give it a destination the couple can actually reach, such as their orders or receipts page. Find where those live first; don't invent one.
Do NOT touch the receipt page. Whether a refunded receipt gets a credit memo or a void mark is an owner/BIR ruling that is still open.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S17 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S17 <what>" && { <cmd>; rc=$?; "$L" release "S17 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S17 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
