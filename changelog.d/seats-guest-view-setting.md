## 2026-11-01 · feat(seats): how guests see their seat · the card shows it · Guide me · booths on the guest map (S1d)

Owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH VIEW DOES" items 2–5. **Guest-facing — held for the owner's OK.**
- **Seats ⚙ "How guests see their seat"**: Both (default, 2D map first — today's behaviour) · 2D map · 3D walk, beside
  "Show guests their seats early" (the shared ChosenRow). New column `event_floor_plan.guest_seat_view`
  (migration `20271302002155_guest_seat_view.sql`, ALTER only — no write beside it, the 55006 lesson).
- **The guest's seat page** (`/[slug]/find-seat`) draws what the choice says (`lib/guest-seat-view.ts › seatViewParts`):
  2D → the map, no walk; 3D → "Walk to your seat" is the way in, no map (the map stays when there is no 3D room);
  Both → as today.
- **The host's guest card** (Seat Plan fold) shows that guest's seat the same way — their table lit, Seat N, tap for
  full screen (the house Sheet), the 3D way in = the host's Guide me for them. Read when drawn, a refusal said.
- **Guide me** in the view-only 3D room: pick a seated guest, watch them walk from the entrance to their seat
  (`seatApproachPath`, the walk-in's own route). Nothing saved. `?guide=<guest>` starts it from the card.
- **Booths on the guest's 2D map**: booked suppliers' booths (`readGuestBooths` — read only behind the seat gate,
  public business identity only), a tap opens the 3D walk's supplier card.
- One dispatcher `guests/seat-view-actions.ts › guestSeatView` (set · preview); server-action CEILING 1226 → 1227.
Guard: `lib/a-guest-sees-their-seat-the-hosts-way.test.ts`. Lab: `/dev/guests-lab?part=seatview&view=both|2d|3d`.

SPEC IMPACT: None — builds DECISION_LOG 2026-11-01 "SEATS: WHAT EACH VIEW DOES" (new column recorded here).
