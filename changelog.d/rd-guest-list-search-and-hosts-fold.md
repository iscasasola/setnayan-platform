## 2026-10-01 · feat(guests): the top bar searches the Guest list · Hosts pieces fold into the guest card · the parts row goes · "Who can reply?" on the first visit (F2)

- **The top bar searches this event's guests** (owner 2026-09-30, DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS; … THE TOP BAR SEARCHES GUESTS"). `lib/search-scope.ts` gains a `guests` scope ("Search guests", one step out = your events); on `/dashboard/<id>/guests` the shared bar is a real box driving the roster's `?q=` (`guests-top-search.tsx`, reusing `LiveSearch` verbatim), keeps the escape row with what was typed, and takes ⌘K back. The page row is Add only (add box + Filter + Sort); after the event the add box still waits behind "+". `guests-search.tsx` deleted.

SPEC IMPACT: None
