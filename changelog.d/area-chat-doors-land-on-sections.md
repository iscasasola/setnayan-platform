## 2026-09-19 · fix(chat): every door off the one chat box lands somewhere else — the lock link opens the bench, the profile button opens the brief (AREA-CHAT)

#5614 made a bare landing on the supplier's client page and on the couple's
workspace a CHAT landing (redirect to the thread). Walked as the real person on
origin/main + #5614 with the relationship-workspace flag ON (it is, in
production), three doors FROM the thread page looped back onto it:

- the customer rail's **"Full customer profile"** linked the bare client route —
  now `?tab=details`, the shell tab that holds the full brief;
- the accepted quote card's **"🔒 Ask <shop> to lock"** and the sent-quote page's
  **"Go ask <shop> to lock"** both linked the bare workspace route — a page that
  holds **no Lock control** (`git grep "AccordionLockButton\|finalizeVendor("`:
  the one lock path mounts on the Vendors page, in the bench row and in "Your
  team", nowhere under `workspace/`). Both were a dead end from the day they
  shipped; after #5614 they reloaded the quote. Now `lib/lock-door.ts` —
  `coupleLockDoorHref(eventId, category)` — opens the bench on the pick's own
  category tile via the shipped `?open=<tile>` contract, and both pages import
  it rather than each deriving a destination.

Also: both shells painted `initialTabId="chat"` — a LINK tab, never selectable —
so `?tab=details` painted Quote on the server and switched after hydration; they
now pass the tab the URL names.

Guards: `lib/lock-door.test.ts` executes the rule over every enum category;
`lib/every-door-off-the-frame-lands-elsewhere.test.ts` counts the doors;
`the-accepted-page-shows-the-next-step`, `a-revised-quote-must-be-accepted-again`
and `one-chat-box-everywhere` evolved from "the workspace route" to "the lock
door", with the reason in each.

SPEC IMPACT: None.
