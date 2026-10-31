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
- 🔒 **Accept · Decline stay in Guests (2026-10-31).** Drawn inside Guests (`maker=guests`), each row posts through
  `DecideForm` (`guests/claims/decide-in-place.tsx`) to ONE in-place door, `decideRequestInPlace` (verb in `do`), which
  ANSWERS `{ ok, error }` and never redirects. Done → the row is kept in Guests as "Accepted · just now" (the Requests
  page's own G2 words, `requests-decided.tsx`), and Accept · Decline drop Guests' toast with **Undo**; refused → the
  words in that toast and the row stays a request. Link: kept, said, no Undo (there is no undo for a merge).
- `back()` in `claims/actions.ts` now THROWS; the page's doors (`keepGuestAction` · `removeGuestAction` ·
  `linkGuestAction` · `undoRequestAction`) turn it into `?error=` exactly as before. The page's two Undos share one door
  (`undo` = accepted · declined) — the server-action budget is at its ceiling (1,226), so the in-place door costs nothing.
  Link's two silent returns (target gone; seat held by another account) now say so.
- **⚙ › Requests to join opens in place** on the Guests screen (`OpenRequestsContext`): the sheet closes, the List comes
  forward on Asking to join. Elsewhere (or a helper) the row keeps its link.
- The couple can open Asking to join with nobody waiting: a MEASURED zero draws "Nobody is waiting…" with no extra read;
  an unread count streams the Requests page, which says so itself.
- Guards re-aimed to the bodies (property kept): `a-soft-deleted-guest-releases-their-seat`, `request-key`,
  `seat-links-only-on-purpose`, `a-list-only-event-takes-no-requests`, and the Maker first-load door regex.
- Guard `lib/requests-are-inside-guests.test.ts` (renders the screen).
- ⚠ Stacked on #7055 (`claude/guests-top-row`) — it edits the same screen. Merge after #7055 (merged into `main`
  before 2026-10-31; this branch carries `origin/main`).

SPEC IMPACT: None — builds the approved prototype's "Asking to join".
