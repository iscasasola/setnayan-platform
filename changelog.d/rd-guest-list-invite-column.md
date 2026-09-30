## 2026-09-30 · feat(guests): the Guest list has an Invite column — message + QR per guest, with a first-visit tour

Owner, verbatim: *"the personal QR is found on the guest list. and we would want the table to have that column to copy a message with the link and the photo with it. and instructions on how to use it"*.

- **Invite column** on every guest row of the desktop table, and the same control on the phone's list row. Not on the couple's own rows, nor a guest marked Passed away — the guest card's rule.
  - Phone: one tap opens the share sheet with the message **and** the guest's Digital ticket (the card's Send invite path). An app taking it marks the row Sent ✓.
  - Computer: a small panel — **Copy message** · **Copy ticket** · "Paste the message, then paste the ticket." · **Mark as sent** / Undo. A copy is not a send, so it never stamps by itself.
- **Not a second sender.** `GuestInviteCell` lives in `send-invite.tsx` and uses the same message builder, the same pre-fetched QR file, and the same Sent ✓ writer (`setGuestInvitationSent`, which revalidates the Guest list and Invitation pages so "Not sent yet (N)" falls). The card's `send()` now calls the extracted `shareInvite`, so there is one `navigator.share` in the file.
- The QR PNG is fetched only for rows on screen, only on a touch device (the card fetched on mount; 180 rows would have fetched 180 PNGs).
- `loadInviteSetup` is now read once per Guest list render (the open card reuses it) instead of only when a guest was open.
- 🎫 **It hands over the Digital ticket, not the bare QR** (owner 2026-09-30: *"so what will show is not QR Code. it will be the Digital Ticket"* · *"we do not copy the QR Code, we copy the Digital Ticket"*). The share sheet attaches the guest's ticket PNG (`PASS_CARD_ROUTE?guest=<id>`, the couple's chosen style — the same image "Save my ticket" gives), for the column AND the guest card's Send invite (`useQrFile` → `useTicketFile`; the card's "Download QR" → "Download ticket"). Desktop: **Copy ticket** (image on the clipboard, file fallback; a guest who replied they can't come has no ticket and is told so). The default message now reads "Here's your ticket for the event (attached) — it opens our Event Hub anytime, and it's your pass at the door."; with nothing attached, "Your ticket for the event is on that page too — …". `qrAttached` → `ticketAttached`. The port-controls baseline drops `/api/website/qr/guest/[seg]` from `/guests` on purpose (regenerated).
- **Instructions:** `customer_guest_invite_v1` MiniTour (4 slides) on the Guest list, plus an (i) on the column header.
- Guards: `the-invite-column-is-the-cards-send.test.ts` (both rows draw it · couple/Passed away get none · it reuses SendInvite's pieces · page reads once + mounts the tour · no "email"); `the-header-fits-its-own-cell.test.ts` gains a fixed-pixel budget (144px) because the % ceiling cannot see a px column.

⚠ PR #6175 adds `customer_guest_list_v1` to the same page. Whichever merges second should give one of the two `after=` so two tours never stack on one first visit.

SPEC IMPACT: None
