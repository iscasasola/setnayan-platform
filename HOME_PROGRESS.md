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
1. ✅ Typecheck (`pnpm typecheck` in apps/web — plain tsc OOMs, use the script’s 7 GB flag).
2. ✅ typecheck green; port baseline regenerated (only DetailsGuideHomeCard + Suspense removed — deliberate; Next hrefs are `href:` literals in home-first-screen.tsx so the scan sees them).
3. ✅ Guard `app/dashboard/[eventId]/the-home-leads-with-one-next.test.ts` (6 tests, render harness). Sabotaged 5 ways (2nd Next card · something above it · Edit hidden · glanceCount ignores measured · page passes true) — each went red. Run it with `npx tsx "<path>"` (node --test treats [eventId] as a glob).
4. ✅ Dev lab `/dev/home-lab` (?next=guide|date|papic|ai|plan, ?unread=1, ?hidden=1). Screenshots at 390×844 via Playwright (the Browser pane fails to load the 930 KB dev CSS — ERR_FAILED): scratchpad `home-390-{guide,date,unread}.png`. Lab has no top bar/dock, so the dashboard placeholder shows at 712 px there; in the event layout the first screen ends ~100 px above the bottom edge, under the dock.
5. ✅ pnpm lint, every `node …mjs` CI guard, every `lint:*` script — green (no-card: boxes are `.sn-glass-bare`, no borders). Not run locally: check-maker-js-budget + bundle-size-check (need a production build; no Maker or client code touched). ⏳ unit tests, changelog.
6. PR is a DRAFT with do-not-auto-merge; mark ready only after the above is green. Never merge.

## Gotchas
- `hasOverlays` no longer counts the (removed) guide tile; it now counts `papicNudgeVisible` so the Papic nudge still mounts when it is not the Next card.
- The Next card for `ai` links to `/studio/setnayan-ai`; the offer card (with the buy) still renders below — deliberate.
- `Recommended` badge on Edit your Event Hub is in the approved frame; owner's call whether it stays.
- Day-of and After branches are unchanged (first screen only in the plan phase).
- `a-debut-is-not-a-wedding…test.ts` pins the exact `<SetDateNudge …/>` string — keep it byte-identical.
