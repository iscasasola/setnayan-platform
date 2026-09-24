# SCHEDULED · Event menu by moment (the event sidebar / bottom nav / ☰)

> **Owner, 2026-09-24:** *"schedule it with the other builds."* · *"our design is complete for the
> event sidebar."*
> **Status: SCHEDULED, NOT STARTED.** No branch, no PR, no code. Design is owner-approved and
> closed; only the landing slot is the controller's call.
>
> Binding prototype: `build-sessions/prototypes/event_menu_by_moment_2026-09-24.html`
> (zero JS; every row carries a Why panel, and the foot carries the per-row ledger for all 18 rows).

---

## WHERE IT LANDS, AND WHY IT IS NOT FIRST

**It lands AFTER the six PRs now in flight — and it is not a demotion, it is a collision.**

This build merges the two nav trees into one. Six PRs are open against the tree as it stands today:

| PR | branch | touches the nav |
|---|---|---|
| #5913 | `rd/the-public-profile-is-a-website` | no |
| #5932 | `rd/the-route-budget-is-documented` | no |
| #5933 | `claude/the-mark-is-centred` | **yes — `one-shell-event-rail.test.ts`** |
| #5934 | `rd/section-background-kinds` | no |
| #5935 | `rd/event-hub-wears-a-theme` | no |
| #5936 | `rd/dress-code-by-group` | no |

🔑 **Only #5933 overlaps, and it is armed and green.** So the wait is hours, not days — but starting
before it merges means rebuilding the rail on top of a rail that is about to move. Re-measure the
overlap rather than trusting this table:

```bash
gh pr list --state open --limit 40 --json number,headRefName,files \
  --jq '.[] | select([.files[].path] | any(test("customer-menu|customer-nav-config|event-rail|front-door-shell|studio-rail"))) | "\(.number) \(.headRefName)"'
```

## ⏭ ONE PIECE SHOULD NOT WAIT — and it is a bug, not a redesign

> 🐞 `CustomerBottomNav` never passes `websiteEnabled`, so **the planning Hub tab never renders on
> phones.** `one-menu-word-in-all-three-phases.test.ts` passes `websiteEnabled: true` itself, so it
> cannot see this.

This is the house defect in its purest form: a guard that supplies the very input whose absence is
the bug, so the failure and the pass are the same colour. It is independent of the IA change, it is
a few lines, and it is a tab a couple cannot reach today. **Fix it on its own branch, before the
big build, with the test corrected to stop feeding itself the answer.**

## WHAT THE BUILDER MUST NOT REDISCOVER

- **Two trees today, and the answer is ONE, not three.** `lib/customer-menu.ts` feeds the phone bar
  and dock; `customer-nav-config.ts` feeds the desktop rail and the ☰ drawer via
  `event-rail-context.tsx`; and the shell draws *Browse by category* and the Studio group itself
  (`front-door-shell.tsx`, `lib/studio-rail.ts` via `app-rail-shell.tsx`). Merge into one sectioned
  tree. **Adding a third is the failure mode.**
- **Keep every key** (`launch`, `explore`, `studio`, `home`, `guests`, `budget`, `refer`…). They
  drive registry slots, localStorage section state, badges and `hideKeys`, and **fail silently** if
  changed. A new `papic` bar key needs a `customer.bottom-nav.papic` registry default; retire the
  day-of `seats` slot default.
- **Icons cross the server→client boundary as NAMES only** — the `RailFocusIcon` pattern. A
  `LucideIcon` passed from a server layout to a `'use client'` component threw
  *"Functions cannot be passed directly to Client Components"* and **took production down for about
  seven hours on 2026-09-23.** This is the single most expensive mistake available in this file set.
- **Unknown future keys go to the END of the list**, never dropped, so nothing is silently lost.
- **Gate the rail's Seat plan row on `seatingEnabled`** too; today only the day-of tab is gated.
- **Prod `nav_slot_override` has 0 rows** (read 2026-09-24), so code labels are what shows.
  Re-measure: `select count(*) from nav_slot_override;`

## GUARDS THAT GO RED ON PURPOSE

Update them to the new rulings. **Never weaken one to go green** — if a guard is too noisy, raise
its threshold and say so.

`customer-menu.test.ts` · `studio-follows-you-in.test.ts` · `front-door-invariants.test.ts` ·
`studio-menu-adapts-to-event.test.ts` · `studio-rows-are-lit.test.ts` · `one-event-hub-door.test.ts` ·
`the-rail-moves.test.ts` · `one-shell-event-rail.test.ts` *(#5933 touches this one — merge first)*

About 19 tests read the builders. Re-measure rather than trusting the count:

```bash
git grep -l "buildCustomerNavGroups\|buildCustomerMenuTree\|EventRailContext"
```

## OWNER RULINGS, 2026-09-24 — not yet in `DECISION_LOG.md`; this build adds them

1. **"Browse by category" is REMOVED inside an event, not renamed.** *"we already have your team as
   where they search, negotiate and build their suppliers."* It opened `/explore`, the public
   directory that does not know the event.
2. **Papic is the spine.** *"papic is the life source of setnayan. it is where we collect photos and
   make memories."* It sits under Overview in every phase and is a phone tab in every phase.
3. **The Studio heading is dissolved.** Products sit at their moment, marked ✦. This changes the
   *form* of the 2026-08-21 ruling, and that supersession must be written down, not assumed.
4. Papic replaces **Suite** on the planning bar (Suite stays in ☰) and **Seat plan** on the day-of
   bar (Seat plan stays in ☰ and in the strip).
5. **Personalization → Details.** And one word per page: Now→Overview · Seats→Seat plan ·
   All services→Suite · Review→Your Team. Studio's "Event Hub" row and Event Hub Controller become
   **one** row.
6. **One structure for every event type.** *"the other event will change accordingly. since wedding
   has all features."* Existing event-type gating drops the rows a type lacks; an empty section
   hides its heading.

## THE RESULT THE OWNER IS BUYING

**Logo Maker moves from row 26 of 27 (+11 hidden) to row 9 of 21, directly under Mood Board.**
Owner, on the old shape: *"finding the logo maker at the bottom feels so far."* That sentence is the
acceptance test.

## ⚠ THE ROUTE BUDGET APPLIES HERE TOO

Every `"use server"` export is one Vercel route, the hard ceiling is 2,048, and Vercel reports the
count **only when a build fails**. A nav rewrite should add **zero** server actions. If it needs
one, say so in the PR body rather than discovering it in a red production build.

---

*Re-measure every number and every branch name on this page before acting on it. A handoff is not
evidence — including this one.*
