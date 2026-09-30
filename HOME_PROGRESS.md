# HOME_PROGRESS — rd/phone-home-simple (phone Home, frame 1 "Home")

Base: `origin/rd/train-2026-09-30-midnight` (PR #6211 was OPEN on 2026-10-01).
Design: `Setnayan/prototypes/phone_app_simple_2026-10-01_fable.html` frame 1 · DECISION_LOG "THE SIMPLE PHONE APP — APPROVED".

## Done
- `apps/web/lib/home-first-screen.ts` — pure: `pickHomeNext` (order guide → date → papic → ai → plan = the order page.tsx already stacked its nudges), `glanceCount/glanceDays/glanceMoney` ("—" when unread, never 0).
- `app/dashboard/[eventId]/_components/home-first-screen.tsx` — server component: cover · ONE Next card · Edit your Event Hub (always) · 3 numbers · Paid/Still owing · "See all" (#home-all). Phone: min-h one screen so nothing else is above the fold.
- `details-guide-home-card.tsx` — the tile became `readHomeGuide()` (it is always the Next card when it exists).
- `page.tsx` — guests read is now `fetchGuestsByEventMeasured` (always); money read = budget page's Paid/Owed core, gated by `resolveBudgetVisibility`; plan branch renders first screen then `<div id="home-all">` EventDashboard. The picked nudge is not drawn twice below.
- `event-dashboard.tsx` — only `export`ed `daysUntil` (pinned by a-finished-event-reads-as-finished.test.ts).

## Next (wrapped 2026-10-01 at the account's handoff limit — NOTHING below has run yet)
1. Typecheck (`pnpm -C apps/web exec tsc --noEmit` under heavy-lock) — the WIP has NOT been typechecked.
2. Regenerate `apps/web/scripts/port-control-baseline.json` (it lists `DetailsGuideHomeCard`, now gone; add `HomeFirstScreen`).
3. Guard test (e.g. `app/dashboard/[eventId]/home-first-screen.test.ts`): (a) exactly one `data-home-next` card in HomeFirstScreen and it is the first thing in the plan branch; (b) `data-home-edit-hub` rendered unconditionally; (c) glanceCount(…, false) / glanceMoney(null) === "—" and page.tsx passes `guestsMeasured`. Sabotage each.
4. Dev lab `app/dev/home-lab/page.tsx` (NODE_ENV production → notFound, like details-lab) rendering HomeFirstScreen on fixtures; screenshot at 390×844.
5. Lint + every CI guard + unit tests from apps/web (bracketed paths one file at a time); `changelog.d/rd-phone-home-simple.md` (SPEC IMPACT: None).
6. PR is a DRAFT with do-not-auto-merge; mark ready only after the above is green. Never merge.

## Gotchas
- `hasOverlays` no longer counts the (removed) guide tile; it now counts `papicNudgeVisible` so the Papic nudge still mounts when it is not the Next card.
- The Next card for `ai` links to `/studio/setnayan-ai`; the offer card (with the buy) still renders below — deliberate.
- `Recommended` badge on Edit your Event Hub is in the approved frame; owner's call whether it stays.
- Day-of and After branches are unchanged (first screen only in the plan phase).
- `a-debut-is-not-a-wedding…test.ts` pins the exact `<SetDateNudge …/>` string — keep it byte-identical.
