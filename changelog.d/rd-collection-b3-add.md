## 2026-09-24 · feat(home): adding an event opens the real type picker over the board

Step B3 of the owner-approved collection template (DECISION_LOG 2026-09-24, "the template is good"):
the header (+), the dashed "+ New event" tile and the empty state's button open the REAL first step
of create-event — right-hand panel on a desktop, bottom sheet on a phone — instead of leaving the board.

- **Routing (the change to explain):** the launcher layout gains an `@modal` parallel slot.
  `app/dashboard/(launcher)/@modal/(.)create-event/page.tsx` INTERCEPTS a soft navigation from the board
  to `/dashboard/create-event` and renders the create-event page itself — `CreateEventPage` imported
  whole (roster, wedding guard, samahan/alaga reads, error copy, `EventTypePicker`), not a fork — inside
  `CreateEventPanel`. `@modal/default.tsx` renders nothing otherwise. A cold load, refresh or shared link
  of `/dashboard/create-event` is not intercepted and gets the full page exactly as before. No door
  changed its href; closing goes `router.back()` after the exit transition.
- **`SidePanel`** taken from `rd/design-foundation-parts` (its first adopter, as
  `build-sessions/DESIGN-FOUNDATION.md` planned) with its `.sn-side-panel*` CSS and tests, plus one
  additive prop: `phone="sheet"` rises from the bottom below 768px (`sn-sheet-rise`); from 768px it is
  the unchanged right-hand panel.
- `origin/main` merged in (it carries PR #5944's tokens the panel needs — #5944 merged 2026-09-24).
  That brought `lint:no-card`, which flagged the extracted `NewThingTile` (a pressable Link, moved out
  of `page.tsx` by the extraction) — marked `no-card-ok`, and the baseline regenerated DOWN
  (`page.tsx` 6 → 5, total 2182 → 2181).

Tests: `app/dashboard/(launcher)/the-add-flow-opens-the-real-picker.test.ts` (real page imported, no
forked picker, slot rendered + empty by default, sheet on phone, back on close, three doors);
`design-foundation.test.ts` gains the panel's tests (borderless, no held transform, aria-modal via
the hook, reduced-motion exit, the phone sheet). Sabotage (layout drops `{modal}`) went red.

⚠ Not browser-verified: an authenticated board is needed to watch the interception. "Create" still
lands where each type's flow lands today (the new event / its onboarding), not back on the board as a
fresh poster — that is the create action's redirect, left untouched (zero server-action changes).

SPEC IMPACT: None — implements the 2026-09-24 DECISION_LOG row.
