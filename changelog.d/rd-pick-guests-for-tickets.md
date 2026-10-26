## 2026-10-26 · fix(prints): Pick guests works, on every guest print, and each count line says what its file holds

Owner, on Studio › Prints: *"Why cant i pick specific guests to download and compile?"* → *"And this should apply to all guest related prints."*

- **Event pass "Pick guests" was broken inside the Maker.** The picker sheet (the shared `Sheet`, z-50) was portalled under the
  Maker's `fixed z-[80]` layer. It opened invisibly behind the Maker and scroll-locked the page, so pressing the button looked like
  nothing happened. Measured in `/dev/maker-lab`: the sheet was in the DOM at the screen's size, and `elementFromPoint` landed on the
  Maker. The sheet now has its own `z-[96]` layer, the same as View as ▾. A guard compares the two z values.
- **Pick guests is on every per-guest row**, using the shared `GuestManySheet`. The file rule is one function, `pickedFile` in
  `lib/print-picked-guests.ts`.
  - Event pass: had it; now it works.
  - Digital ticket (new): one .zip of only the ticked guests. `/api/guest/pass-card/all` accepts `guests=` after the same sign-in and
    host gates. Every id is checked against this event's ticket holders. One unknown or declined id refuses the whole zip with 403;
    a malformed or empty list gets 400.
  - Guest QR codes: had it. Its list is now the sheet's own guests, so a guest who can't come can be picked.
  - Table signs & place cards (new): those guests' cards only. `seating/print` accepts `guests=` with the pack's Event Hub Pro
    question. Every id must be a seated guest of this pack (`seatedGuestsOf`). One that isn't refuses the file with 403.
  - Not per guest, so no picker: invitation, entourage, finer details, menu, welcome poster, Our Story poster, event card, the guest
    list registry (one list), the 2D seat plan, the entrance chart, caterer counts and the event QR.
- **Honest count lines, one source per row.** Each row's View as ▾, Pick guests and count line read the list that row's own file is
  drawn from.
  - Digital ticket: it said "199 tickets · one PNG per guest who is coming", but the zip holds everyone who has not declined. It now
    says "199 tickets · 76 coming, 123 not replied yet · one PNG each · .zip". What the zip includes is unchanged.
  - Guest QR codes: "N QR codes · every guest on your list" (`loadQrGuestNames`, the sheet's own `passGuestRows(…, false)`).
  - Place cards: "N place cards · seated guests" (`loadSeatedGuestNames`, the pack's own `seatingUnits`).
- Tests: `lib/pick-guests-on-every-guest-print.test.ts` calls the zip route and the place-card route. Sabotages seen red: zipping
  `read.guests` instead of the pick, and dropping the sheet's layer to z-50.

SPEC IMPACT: None. The Prints rows keep today's shape; the redesign (step 5, Event Hub Settings) can reuse `GuestManySheet` and
`pickedFile` as they are.
