## 2026-11-14 · fix(event-dash): the couple's event dashboard round — one date story, celebrant follows step 1, one tap one step, Send says why, one row per service, the deal pill is the supplier's (CYC-02 · 03 · 04 · 07 · 15 · OWN-02 · RW-278 · F-W2-23)

From W1's full booking cycle and W2's sweep (13–14 Nov):

- **CYC-03** The header said "No date yet" while Suppliers said "1 date · Dec 19". `withPickedDate` / `readEventDate`
  now read one well-formed picked day as the date for every event type (`onePickedDay`). That is the owner's 14 Nov
  wedding rule, extended to birthdays and other person-date types. Two or more picks stay options. Nothing stored changes.
- **CYC-02** The celebrant field now follows "Who are we celebrating?". Before, a value the flow had filled in from
  the account was kept as if it were typed (`lastDerived` in `generic-onboarding.tsx`).
- **CYC-04** Two forward steps within `FORWARD_HOLD_MS` (450 ms) count as one tap, so "Pick a look" can no longer be
  skipped unseen after "Use a theme picture for now".
- **OWN-02** With no event picked, Send says "Pick which event this is for first." instead of doing nothing. After
  "Start a new event", the commit writes the new event into the way back (`?ievent=`, `withNewInquireEvent`), and the
  sheet opens with that event picked. This covers the generic flow only; the wedding shell is held by #7605.
- **CYC-07** "Which services?" compares service keys by their words (`serviceKeyStem`, RW-167). A sign-up key in an
  older spelling (`lights_and_sound` beside cards in `lights_sound`) no longer adds a 4th row.
- **RW-278** The "🧾 Send a deal" pill (menu row and chip) is shown to the supplier only. The couple's ＋ keeps
  "Deal or meeting".
- **CYC-15** (a) The category name may shrink (`min-width:0`), so the unread badge no longer rides over "1 quote in".
  (c) "Not included: …" from the service card is hidden once the couple has a recorded price, because the quote's own
  lines are the truth.
- **F-W2-23** The guest card's camera pill is capped at half the row, so "Their camera" no longer wraps one word per
  line.

Guard: `lib/the-event-dash-round-holds.test.ts`, run red against origin/main. Two existing tests now follow the new
rules: `one-picked-date-is-the-date.test.ts` and `deal-waits-for-a-quote.test.ts`.

SPEC IMPACT: None. Rules applied consistently, with no new decision. Root-caused but not built, and raised for a call:
CYC-05 (the shop's own `event_types` is wedding-only), CYC-15b ("New to Setnayan" is the owner's 0-review word),
CYC-16 (owner 2026-10-28 said yes to the member's name), F-W2-26 / F-W2-22 (locked rulings) and F-W2-19.
