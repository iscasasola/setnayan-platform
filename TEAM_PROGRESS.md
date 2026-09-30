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

- typecheck clean (0 errors) · lint clean · every CI guard script passes (bundle/maker budgets need a build — CI)
- 12 sabotages, each caught (see PR body) · 390 px shots in ~/Documents/Claude/Projects/wt-phone-team-shots/
- PR #6220 draft, label do-not-auto-merge, auto-merge null

## Next
- full `pnpm test:unit` result → then `gh pr ready 6220` (never merge)

## Gotchas
- Render harness: scratchpad team-harness (tsx --require preload.cjs stubs next/link, next/navigation,
  accordion-lock; globalThis.React; tailwind CLI over the rendered HTML; playwright-core from root .pnpm).
- globals.css gives every <button> min-height 44px — the Lock button was taller than Pay/Nudge links
  until GO_CLASS got min-h-[44px] -my-2.5.
- Bracketed test paths: `npx tsx --test "app/.../[eventId]/..."` runs 0 tests — use `npx tsx <file>`.
- ServicesTakeover's `}: {` props close at column 0 — a `\n}` anchor ends the body early.
- NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED is ON in prod: rows use the bench card's Lock verdict.
