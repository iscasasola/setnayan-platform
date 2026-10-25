## 2026-10-20 · perf(app): one save, one server render — no `router.refresh()` after an action that already revalidated

Owner: *"we want all pages to load at its fastest."* A server action that calls `revalidatePath` / `revalidateTag`
already answers WITH a fresh render of the page it was pressed on (Next 15: any revalidation sets
`pathWasRevalidated`, and the action handler renders the current page into its answer, which the client router
applies to what is on screen). 102 of the app's 189 `router.refresh()` calls ran right after such an action, so the
page was drawn twice per save. On Guests that is every read the page makes, twice.

Measured in `/dev/guests-lab` at 375 px (the lab's server renders are now counted: dev log `[one-render]` and
`data-lab-render` on the card's panel). Before: a field edit = 1 render, its Undo = 2 renders (the action's, then the
refresh's). After: 1 and 1. The edit's own render also showed the old belief written beside several of these refreshes
("revalidatePath marks the cache stale; it does not push fresh props into a component already on screen") does not
hold on Next 15.5: the card's server-drawn marker moved 2 → 3 with no refresh at all. Those notes are corrected
where they stood (put-away card, event card menu, the supplier Lock).

- **Removed: 102** — guests, budget, event details, launcher, schedule, day-of, access requests, seating, studio,
  suppliers, Event Hub, admin (categories, pricing), supplier dashboard. No action was changed: every one of these
  already revalidated.
- **Kept: 80, each with a reason on the line above it** (`// one-render: keep (<reason>) — <why>`): batched 32 (the
  Maker's `lib/maker-refresh.ts` and the guest add queue — writes that deliberately revalidate nothing, one render
  after) · fetch 14 · realtime 10 · retry 7 · no-revalidate 7 · after-failure 5 (a refused or unanswered write
  re-reads what was really kept — every "a failed save stays visible" path is untouched) · other-frame 2 · auth 1 ·
  navigation 1 · client-write 1.
- **Unsure: 7**, kept exactly as they were: six 3D seat-plan bulk operations whose `seatResyncRef` must be armed
  before the render lands, and one supplier "ask" path not traced.

Guard: `apps/web/lib/a-save-renders-once.test.ts` (reader: `apps/web/lib/one-save-one-render.ts`, test-only) — no
refresh may follow a server action that revalidates (resolved through imports, local wrappers, `useActionState`, and a
context/prop by the action's exported name), unless it is on a failure branch or handed to the batcher; every kept
refresh carries a reason from a closed list that must fit what the code does; the unsure count may only fall.
`a-card-press-answers-in-place.test.ts` no longer asserts the bench's fallback refresh (it was the double render).

Not changed (worth a follow-up): Budget and Seating also re-read on their own realtime echo of the user's save, so a
save there can still draw twice — once from the action, once from the realtime refresh ~0.4 s later.

SPEC IMPACT: None.
