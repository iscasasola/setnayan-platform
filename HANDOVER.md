# HANDOVER — claude/check-a-date (Builder CA, 2026-10-28) — ⏸ PAUSED by the controller

Contract: DECISION_LOG 2026-10-28 "✅📅 CHECK A DATE — APPROVED; BUILD `/v/[slug]/dates`" + the approved prototype
`prototypes/check_a_date_2026-10-28/index.html` (flow + content only — owner: "Also follow our design format templates").

PR **#7007** (DRAFT, label `do-not-auto-merge`, autoMergeRequest null). Worktree `wt-check-date`, branch `claude/check-a-date`.

## Built (all committed + pushed)
- `lib/check-a-date.ts` — pure answer: Not bookable = `buildCustomerCalendarMonth` per schedule (`blocked` all-day closure
  via `lib/not-available.ts`, `locked` hold, `full` at "How many a day"); per service when services sit on different
  schedules; window = this month + 23; words, URLs, resume href, ask line.
- `lib/check-a-date.server.ts` — service-role, window-bounded reads; returns only Not-bookable days; any refused/incomplete
  read → `unreadable` ("couldn't load", never all-Available). Public gate = `shopPageGate` (public only).
- `app/v/[slug]/dates/page.tsx` + `_components/check-a-date-calendar.tsx` — CalendarGrid (kind 31), Sheet steps:
  day → services (SwitchRows) → event (ChosenRow/PickMenu; sign-in via SignInHereLink with date+services in the address;
  none that day → "Start an event on <date>" = `/dashboard/create-event?next=…`) → Send held 5 s with Undo → shipped
  `startServiceInquiry`. Not bookable → Try another date.
- `lib/check-a-date-qr.ts` + third code "Check a date · free" on `/vendor-dashboard/invite` (`qr-codes.tsx` branch).
- Guards: `app/v/[slug]/dates/no-inquiry-reads.test.ts` (108 modules walked; sabotaged red ×2), `lib/check-a-date.test.ts`,
  `lib/check-a-date-qr.test.ts` (jsqr scan-back; sabotaged red). Updated `every-qr-carries-the-strip.test.ts` (3 cards).
- Ugat screens map regenerated; all 33 `scripts/lint-*.mjs` + `check-ugat-screens.mjs` green locally (RADIUS strict too).
- Changelog fragment `changelog.d/check-a-date.md`.

## CI state at pause
- Head `3b0abb111f` — CI runners were queued (17 pending, 0 fail) when paused. The previous head (`33b642f827`) passed
  typecheck, eslint, production build, lighthouse, e2e; its 3 reds (radius, brand title, QR-card count) are fixed.

## NOT done (next steps, in order, when resumed)
1. `gh pr checks 7007` — fix any red from logs (one loop, sleep 120, max 45).
2. Full local unit suite under the lock (label `ca-suite`) — or take the CI shard counts.
3. The browser walk (walk lane, label `walk:ca`): scripts in the session scratchpad `walk/` — `stub.mjs` (fixture
   PostgREST/Auth on **54398**, NOT 54321 which another builder holds), `walk.cjs` (390+375 · light+dark · Chromium+WebKit,
   every control; selectors already updated for SwitchRow/ChosenRow), `run-walk.sh` (next dev on 3871, lab env, no prod).
   Re-create from this description if the scratchpad is gone. (A foreign `fake-supabase.mjs`, PID 81512 since Sep 25,
   also listens on 54398 — pick another port, e.g. 54397, and do not kill it.)
4. Side-by-side shots: prototype shots exist in `shots-2026-10-28/check-date/proto-*.png`; build shots come from the walk.
5. Report to the controller with a CHECK CARD.

## Decisions taken (in the PR body as deviations)
CalendarGrid hatch instead of the prototype's squares · Undo = 5 s hold before send · create-event has no date pre-fill ·
QR mounted on Supplier › QR codes (Shop › Page builder owns the rest) · resumed chats get interests but no date note.
