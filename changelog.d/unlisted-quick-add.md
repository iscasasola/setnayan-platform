## 2026-09-21 · feat(guests): keep an unlisted guest the quick-add way

Owner: *"did you add the search and the option of adding a quick add text box? same function as the
quick add on the guestlist."*

- **Keep on my list** is now one line in the guest list's quick-add grammar — `Shey Ferriol bride
  #Barkada ninang +2` — prefilled with the name they typed on joining. Underneath, a live preview of
  what the line means (name · side · role · #groups, marking a new one · "+2 seats beside them"),
  read by the same function the server uses (`readKeepLine` → `parseGuestInput`), so the preview is
  the save.
- The grammar names only a few roles, so a **Role** pick stays for the rest (Bridesmaid, Candle
  sponsor…); when made it wins over the line. An unoffered hint falls back to Guest, as the capture bar
  does; an unoffered PICK is refused; Bride/Groom are never offered.
- The server: name parts incl. title / middle / suffix; `#groups` found or made on the guest's side
  (`quickCreateGroup`); `+N` saved and its seats made beside them (`syncExtraSeats`).
- Replaces the name/side/role/group form from #5839 (the search picker and the unlinked-only filter
  stay). Stacked on #5838 (seats) and #5839.
- Verified in a browser with the real component: prefilled "Shey" → Shey · Both sides · Guest; the full
  line → Shey Ferriol · Bride's side · Principal Sponsor (Ninang) · #Barkada · #Choir · new group · +2;
  a Role pick overrides; no Bride option; posts exactly `line` + `role`. Tests
  `lib/unlisted-guests.test.ts` (6).

SPEC IMPACT: None
