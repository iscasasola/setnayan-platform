## 2026-10-08 · fix(nav): no top-bar search inside an event

Owner, 2026-10-08, looking at the round search button with ⌘K inside an event:
"when we enter and event dashboard. i don't think we need search on top anymore".

- `FrontDoorShell` provides its existing `insideEvent` (from `studioEventId`, set
  only by `app/dashboard/[eventId]/layout.tsx`) through a tiny
  `InsideEventContext`; `HomeCommandBar` reads it. A context, not a prop, so
  the two search mounts stay one identical expression (`one-top-bar.test.ts`).
  Inside an event the bar draws nothing and binds no ⌘K listener.
- The events board (`/dashboard`) and every account page keep the search and ⌘K.
- The Guest list keeps its guests box in the top bar: that box IS the list's
  search (owner 2026-09-30) and the page has no other. Flagged for the owner.
- Pages with their own search (Suppliers' category search, Messages, check-in
  desk, pickers) are untouched.
- New test `app/dashboard/[eventId]/no-top-search-inside-an-event.test.ts`.

SPEC IMPACT: None (owner's verbatim instruction recorded here and in the code comment).
