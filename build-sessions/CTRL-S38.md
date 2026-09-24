# S38 · A SIMPLE EVENT, end to end, with the owner driving (birthday / debut / christening)

> **Model: Fable 5.1 · effort: high.** Released by the controller. Mirrors S6, which drove the first wedding.

## Why
The owner's bar is **"the platform genuinely usable for a wedding and a simple event at minimum."** The wedding path was driven end to end today (S6: rosa-ben, inquiry → quote → accept → lock → agree → deposit → confirm, verified by SQL). **A non-wedding event has never been driven.**

## Do
1. **Measure first, read-only.** Which non-wedding event types exist (`events.event_type`, the create-event carousel)? Which does the product treat as first-class (onboarding, guest site, the supplier marketplace, Papic)? Pick the one most couples or families would actually run (likely a **birthday or debut**). Say why.
2. **Write the owner a click-path run sheet**, as S6 did. **The owner does the clicking; you never type credentials.** Accounts: a fresh event on **`testnayan3@test.com`** (couple/host, `is_internal = false`), supplier **`testnayan2@test.com`** (Saysay Host and Band). Never the Google button, and never the owner's own account (`is_internal` passes every paid gate, so a green result there proves nothing).
3. The run: **create the event → guest list plus invitation site → find a supplier → inquiry → quote → accept → lock → agree → deposit → confirm → the guest site on the day** (RSVP, Papic join, song request if the band holds the desk).
4. **Confirm every step by SQL** and print the numbers. Record every place where the wedding assumptions leak into a non-wedding event (wording like "couple", "wedding", "bride"; wedding-only steps; missing pieces).
5. Open small PRs for defects outside files other sessions own (quote/proposal = S5 done; chat = S18 #5614; deposit/payment methods = S19 done). Report everything else to the controller.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S38 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S38 <what>" && { <cmd>; rc=$?; "$L" release "S38 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S38 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
