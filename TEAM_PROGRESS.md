# TEAM_PROGRESS — phone Your Team (rd/phone-your-team)

Worktree: ~/Documents/Claude/Projects/wt-phone-team · branch rd/phone-your-team · PR: (see `gh pr list --head rd/phone-your-team`)

## Done
- lib/your-team-rows.ts — pure row derivation (+ test, 17 cases)
- lib/event-vendors-read.ts — measured team read (+ your-team-read-is-honest.test.ts)
- vendors/_components/team-rows.tsx — server component rows (Couldn't load / empty / rows)
- services-takeover.tsx — visible title + ⋯ (TeamMoreMenu: Budget + section jumps), teamSlot,
  Find a supplier button, find area hidden below lg until opened; team chip hidden while closed
- page.tsx — measured read + early "Couldn't load" return, teamRowList from existing maps
- vendors/your-team-phone-first.test.ts — (a)(b)(c) guards; pillar-parts.test.ts updated

## Next
- typecheck · lint · every CI guard · unit tests (bracketed: `npx tsx <file>`)
- sabotage-check each guard; 390 px screenshot from a render harness (never a real account)
- PR ready (do-not-auto-merge label; never merge)

## Gotchas
- Bracketed test paths: `npx tsx --test "app/.../[eventId]/..."` runs 0 tests — use `npx tsx <file>`.
- ServicesTakeover's `}: {` props close at column 0 — a `\n}` anchor ends the body early.
- NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED is ON in prod: rows use the bench card's Lock verdict.
