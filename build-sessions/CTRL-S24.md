# S24 · A page rendered with no styles at all (owner saw it on /vendor-dashboard)

> **Model: Opus 5 · effort: high.** Released by the controller.

## What the owner saw (2026-09-18, ~13:50Z, signed in as testnayan2)
`/vendor-dashboard` rendered as **raw, unstyled HTML**: serif default font, no layout, duplicated text ("SearchSearch events…"), "What's new2", and ghosted text. Owner: **"the website needs to be fixed."**

## What the controller measured
- A minute later, a public page's 4 CSS files all returned **200** (`/_next/static/css/*.css`).
- A production deploy was **Building** at that moment, and ~20 production deploys shipped today (every PR merge triggers one).
- Leading hypothesis (**a hypothesis, not a finding**): **deployment skew**. The HTML came from one build and asked for CSS hashes the next build had replaced, so the CSS 404'd. Next fetches CSS by content hash, and the old build's assets disappear on swap.

## Do
1. **Reproduce or refute** skew before fixing. Check Vercel's settings for this project (**Skew Protection** / deployment retention) with the Vercel MCP tools or `vercel` CLI, read-only. Check the Vercel runtime and request logs around 13:45–13:55Z for 404s on `/_next/static/css/`. If you can't see it, say so; don't guess.
2. If skew: the durable fix is platform-level (**Vercel Skew Protection**) plus an app-side guard, so a page whose stylesheet fails to load recovers (e.g. a one-time hard reload on a CSS/chunk load error) instead of showing raw HTML. Search the repo first (RULE 0) for an existing `ChunkLoadError` or reload handler before writing one.
   ⚠ Turning on a Vercel project setting is an owner action: **write the exact steps for the owner, don't flip it yourself.**
3. If NOT skew: find the real cause (a CSS import removed or moved in a recent PR, a layout that stops including globals, etc.). Check today's merges to `apps/web/app/vendor-dashboard/` and `app/layout.tsx`.
4. Whatever the cause, add an executable guard so it can't recur silently.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S24 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S24 <what>" && { <cmd>; rc=$?; "$L" release "S24 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S24 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
