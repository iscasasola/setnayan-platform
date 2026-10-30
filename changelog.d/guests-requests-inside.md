## 2026-10-30 · feat(guests): requests to join open inside Guests — Asking to join, in place (slice 11)

R4 slice 11 (HANDOVER: *"Requests inside Guests"*; prototype `SHOW` — "Asking to join" is a Show of the List, Accept ·
Decline in place, with Undo). Until now the Total card's door and the ⚙'s row left Guests for `/guests/claims`.

- **Rule 0 — nothing redrawn:** the List draws the SHIPPED Requests page in place — `guests/claims/page.tsx` with
  `maker=1`, the very way the Event Hub Maker already draws it (every Accept · Decline · Link revalidates and stays put,
  each with its Undo). Streamed with the page for the couple while someone is asking (or the address asks,
  `?gshow=requests`) — no extra reads otherwise.
- **Doors:** the Total card's door opens it in place (no navigation; its address stays the Requests page for a new tab or no script);
  the List's ⇅ offers **Asking to join · N** inside Show, right after its last choice, with the one ✓ in Show
  (`guestsFilterMenu`'s new `showExtras`); any other Show / Group / Sort pick goes back to everyone. Without the body
  (not the couple) the door is the Requests page, as before.
- Asking → a slim head "Asking to join · N" with **Everyone** (back to the list), then the requests.
- The ⚙'s "Requests to join" row still opens the Requests page (unchanged).
- Guard `lib/requests-are-inside-guests.test.ts` (renders the screen).
- ⚠ Stacked on #7055 (`claude/guests-top-row`) — it edits the same screen. Merge after #7055.

SPEC IMPACT: None — builds the approved prototype's "Asking to join".
