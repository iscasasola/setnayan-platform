## 2026-11-17 · fix(home): the day-of broadcast card never says "Coming soon" over a failed read, and loses a switch that saved nothing

From the couple-dashboard audit:

- `app/dashboard/[eventId]/page.tsx` › `broadcastCardRead` caught a thrown read and returned `undefined`. The card reads `undefined` as "feature off" and drew the pre-P3 stub — **"Coming soon · No broadcast yet"** — on the event day, over a read that never answered. The catch now logs and hands the live card an unmeasured read (`broadcastsMeasured: false`), which already says *"We couldn't load recent broadcasts right now."*
- The stub's **"Receive broadcasts on this device"** checkbox lived in `useState` only: ticking it saved nothing and reached nothing. Removed.

Guard: `app/dashboard/[eventId]/day-of-broadcast-never-says-coming-soon-over-a-failure.test.ts` — both tests sabotage-checked (red on `origin/main`).

SPEC IMPACT: None

### And Home's orders reads are measured

- `_components/event-dashboard.tsx` read pending orders with `?? []` and never looked at the error. A refused read dropped the **"Settle a payment"** row silently — the board could then say *"Nothing needs a decision right now"* — and with the paid read also refused, **"Your services"** said **"0 orders · Nothing ordered yet"** to a couple who had paid. Both reads are now measured (`servicesMeasured`): the badge prints "—", the tile says it couldn't load, and the board shows a "couldn't check for payments" status line instead of its all-clear. It is a line, not a board row, so "N open decisions" stays a count of real decisions.

Guard: `app/dashboard/[eventId]/home-orders-reads-are-said.test.ts` (3 tests, red on `origin/main`). The 98 neighbouring Home guards stay green.
