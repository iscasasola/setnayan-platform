## 2026-11-06 · fix(promote): Shop › Promote is the approved designs — QR codes as one list, one door piece in Prints, the Prints sheet as prototyped

Owner, 6 Nov 2026: *"why do you build but not create the actual look of the prototypes … what is the use of our prototype?"* This change builds the three approved designs as drawn.

- **QR codes are one list (Option B, approved 6 Nov, `qr-list-proto`).** The one-code "Which code ▾" dropdown is gone. Each code has a row: name, what a scan does, a small QR and ›. Tapping a row opens the code's sheet, which holds the shipped `QrCard` (Share · Copy link · Download · Write to NFC).
  - **Shop › Promote** lists Check a date · Shortlist · My page · Reviews (Reviews is new to the list).
  - **Customers › QR codes** lists Booked · one-use and Crew for an event, with a "per event" mark, in the same row and sheet.
  - On Promote, each sheet ends with **"Put it on…" › Door print · Prints**. That hands the chosen code to the Prints sheet: it opens on the door piece, or on the gallery, with that code (`promote-bridge.tsx`).
  - New: `invite/_components/qr-code-list.tsx`.
- **One door piece.** The cream door-sticker fold under QR codes (`door-sticker.tsx:DoorSticker`) is deleted. The door piece is the approved Ink & gold door print in Prints. `lib/door-sticker*.ts` and `/api/vendor/door-sticker` are left in place but are no longer called from any screen (flagged in the PR).
- **The Prints sheet is the 5 Nov prototype + the 6 Nov content prototype.**
  - Head: ‹ back · title · **Save all**. Save all is a zip of the seven print files from the same renderer (`/api/vendor/prints?piece=all`, `lib/supplier-prints-zip.ts`).
  - **YOUR FACTS**: Shop name · Line · Verified seal · Rating · Badges, then On your prints ▾.
  - **HOW IT FITS** is a visible line again.
  - **Design ▾ and QR ▾ are in the thumb dock** at the sheet's foot. They used to be at the top.
  - #7332's deltas are kept: no prices, and prints work on every plan.
  - The Your badges piece is kept: DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL" puts the badge print inside Prints.
- **`Sheet`** gains optional `head` / `foot` slots, used for a pinned header and a pinned dock.
- **Guards:** five guards that pinned the dropdown or the sticker were retargeted, not deleted. The new guard is `shop/promote/promote-is-the-prototype.test.ts`. The port-controls baseline was regenerated for the three routes this change touches.

SPEC IMPACT: None — builds approved designs.
