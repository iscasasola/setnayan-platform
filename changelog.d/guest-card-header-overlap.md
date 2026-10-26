## 2026-10-26 · fix(guests): the guest card's header stays above its body; the face and a pinned Invite ▾ move into it; Reset beside Delete

Owner, live iPhone (setnayan.com, 2b3132c), one word: **"Overlap"**. Scrolled a little, the card's ticket row slid
under the sticky "GUEST · BRIDE'S SIDE / name / No reply" header, but its **Invite ▾ and ⋯ painted on top of it**,
across its hairline. Cause: the header was `z-index: 2` (since it became sticky, a77b1f0013, 2026-10-03) and Invite / ⋯ have been
`relative z-20` since 0929319821 (2026-09-30) (they lift over a phone row's stretched link). Same stacking context, 20 > 2.
Not #6929 (invite through messaging apps): it changed neither class. And the face peeked out ABOVE the header: a sticky
box sticks inside its scroller's padding, so the header stuck 20px down with the body showing through that strip.

- The header takes the house sticky layer (`--sn-z-sticky`), keeps its opaque paper fill, and the body under it is its
  own stacking context at `--sn-z-base` (`isolation: isolate`) in both frames (phone/tablet sheet, desktop rail), so
  nothing written inside the body can reach above it.
- The header sits flush with the top: its sticky `top` gives back the sheet's top padding (the rail's 20px), and the
  panel inside the sheet no longer takes `.sn-tile:hover`'s 3px lift (a tap holds :hover on iOS).
- 👤 Owner: *"Move profile photo beside the name on the top? Left side"* — the photo/initials (`GuestCardAvatar`, 44px)
  is now the header's `lead`, left of the name; the body no longer draws it over the panel, so the ticket row moves up.
- 📌 Owner: *"Let the invite … button pin to the top when it goes out of screen"* — while the card's Invite is scrolled
  up under the header, a compact Invite ▾ appears in it before ✕: the same `GuestInviteCell` button portalled into
  `InspectorColumn`'s new `pinSlot` (`useHeadPin`, an IntersectionObserver — no scroll math), opening the same sheet.
  Short fade; none under reduced motion. Under 480px it is a 44px round button (send glyph + ▾, named "Invite …") and
  the header's spacing tightens, so "Daniel Ramos" and "GUEST · GROOM'S SIDE" both fit at 390; the full pill above.
- 🔄 Owner: *"So at the bottom, have (RESET) (DELETE)"* — the bottom group is "Reset · Delete", two equal buttons, Reset
  first; visible are the title, "Can be undone" and the buttons; what each does (and that both ask first) is in the ⓘ beside the
  title (`Fold`'s new `tip`, drawn beside the head and inside the fold's one-open scope). Reset asks first (the Delete warning's shape) and offers Undo in the same toast. It clears what the reply
  wrote (measured from `submitRsvp` / `nameTheSeats`): the answer → No reply, meal, dietary, the guest's note, what to
  call them (`display_name` — only the reply writes it on a guest's own row), the photo-tagging answer, the "+1 name"
  mirror, the +1 seats THEY named (back to "+N · TBA", never deleted — the "+N" is their rows) and their songs still
  pending. Keeps the row, the host's info incl. mobile, link + QR, `invitation_sent_at`, and a linked account (unlinking
  rotates the QR — ⋯ › Unlink is that door). +0 server actions: `setGuestRsvp(…, 'pending', { fresh: true })` and
  `restoreGuestRsvpAndSeat(…, fresh)` (the route budget is at its ceiling). Rules in `lib/guest-fresh-reset.ts`.
- `/dev/guests-lab?part=card&frame=panel` draws the card in the real sheet (`InspectorSheetAlone`).

Guards: `guests/_components/the-card-head-sits-above-its-body.test.ts` (sabotaged 4 ways) and
`guests/_components/reset-makes-the-invitation-fresh.test.ts` (sabotaged 2 ways), each red, then restored.
Shots: `shots-2026-10-26/guest-card-overlap/` (390 WebKit + 1280 Chromium, light + dark, before/after).

SPEC IMPACT: the owner's 2026-10-26 rulings (face in the header, pinned Invite, Reset · Delete) are not yet rows in the corpus DECISION_LOG — flagged to the controller, not written from this builder.
