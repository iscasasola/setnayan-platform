# TEAM_PROGRESS — phone Suppliers page, was "Your Team" (rd/phone-your-team)

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

- Renamed "Suppliers" (owner 2026-10-01) on this page; floating team chip RETIRED (nothing floats
  at the bottom) — file deleted, mount + html.teamchip-docked removed, retirement guard, baselines regenerated
- agreed-total guard: readEventVendorsMeasured registered as the page's entry
- CI on 2924d57c8: every guard + typecheck + lint + unit tests green (DB replay was still running at handoff)
- PR #6220 marked ready; label do-not-auto-merge; auto-merge null. NEVER merge.

## Next
- Nothing to build. If CI's DB replay / e2e on the final head goes red, investigate that step only.
- Owner-facing open points in the PR body (Nudge = opens the conversation; ⋯ labels are the pinned
  section labels; no deposit amount shown because none is stored).

## Gotchas
- Render harness: scratchpad team-harness (tsx --require preload.cjs stubs next/link, next/navigation,
  accordion-lock; globalThis.React; tailwind CLI over the rendered HTML; playwright-core from root .pnpm).
- globals.css gives every <button> min-height 44px — the Lock button was taller than Pay/Nudge links
  until GO_CLASS got min-h-[44px] -my-2.5.
- Bracketed test paths: `npx tsx --test "app/.../[eventId]/..."` runs 0 tests — use `npx tsx <file>`.
- ServicesTakeover's `}: {` props close at column 0 — a `\n}` anchor ends the body early.
- NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED is ON in prod: rows use the bench card's Lock verdict.
