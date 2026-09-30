# HOME_PROGRESS — rd/phone-home-simple (phone Home, frame 1 "Home")

Base: `origin/rd/train-2026-09-30-midnight` (PR #6211 was OPEN on 2026-10-01).
Design: `Setnayan/prototypes/phone_app_simple_2026-10-01_fable.html` frame 1 · DECISION_LOG "THE SIMPLE PHONE APP — APPROVED".

## Done
- `apps/web/lib/home-first-screen.ts` — pure: `pickHomeNext` (order guide → date → papic → ai → plan = the order page.tsx already stacked its nudges), `glanceCount/glanceDays/glanceMoney` ("—" when unread, never 0).
- `app/dashboard/[eventId]/_components/home-first-screen.tsx` — server component: cover · ONE Next card · Edit your Event Hub (always) · 3 numbers · Paid/Still owing · "See all" (#home-all). Phone: min-h one screen so nothing else is above the fold.
- `details-guide-home-card.tsx` — the tile became `readHomeGuide()` (it is always the Next card when it exists).
- `page.tsx` — guests read is now `fetchGuestsByEventMeasured` (always); money read = budget page's Paid/Owed core, gated by `resolveBudgetVisibility`; plan branch renders first screen then `<div id="home-all">` EventDashboard. The picked nudge is not drawn twice below.
- `event-dashboard.tsx` — only `export`ed `daysUntil` (pinned by a-finished-event-reads-as-finished.test.ts).

## Status — FINISHED 2026-10-01 (base now `main`; origin/main merged in after #6211 merged)
1. ✅ `pnpm typecheck` (apps/web — plain tsc OOMs; the script's 7 GB flag is needed).
2. ✅ Port baseline regenerated on the merged tree (removed only `DetailsGuideHomeCard` and `Suspense`, deliberately; the Next links are `href:` literals so the scan sees them).
3. ✅ Guard `app/dashboard/[eventId]/the-home-leads-with-one-next.test.ts` (6 tests) — sabotaged 5 ways, each red.
4. ✅ `/dev/home-lab` + 390×844 screenshots (Playwright; the Browser pane can't load the dev CSS).
5. ✅ pnpm lint, every CI `node …mjs` guard, every `lint:*` script; full `pnpm test:unit` 21,091 tests / 0 fail; bracketed Home/budget test files run one by one, all 0 fail. No existing Home test broke.
   Not run locally: check-maker-js-budget and bundle-size-check (they need a production build). This change adds no client code and does not touch the Maker.
6. ✅ `changelog.d/rd-phone-home-simple.md` (SPEC IMPACT: None).

## Round 2 — "Your services" (owner 2026-10-01: "how about papic? and sai? … let's add it")
- ✅ One compact row under Paid/Owing, above See all: Papic (`resolvePapicHomeTile` readiness → "On · N photos" / "Free camera ready" / "Not added" / "—") and Setnayan AI (`isSetnayanAiActiveForEvent` under the resolved paywall → "On" / "Try it" / "—"). Hidden in the store shell (both in STORE_SHELL_HIDDEN_ADDON_KEYS); the service that is the Next card is left out. The Papic Next card is now also withheld in the store shell (its page is web-only there).
- ✅ Guard extended (10 tests); 6 more sabotages each red.
- ⏳ typecheck/lint queued behind the heavy lock; screenshots to refresh.

## Gotchas
- `hasOverlays` no longer counts the (removed) guide tile; it now counts `papicNudgeVisible` so the Papic nudge still mounts when it is not the Next card.
- The Next card for `ai` links to `/studio/setnayan-ai`; the offer card (with the buy) still renders below — deliberate.
- `Recommended` badge on Edit your Event Hub is in the approved frame; owner's call whether it stays.
- Day-of and After branches are unchanged (first screen only in the plan phase).
- `a-debut-is-not-a-wedding…test.ts` pins the exact `<SetDateNudge …/>` string — keep it byte-identical.
