## 2026-10-16 · feat(studio-prints): a piece bar, one "On every print" block, short size lines

Owner, 2026-10-16: *"so fix the prints page. so we can easily navigate."* — then approved the prototype
(`Setnayan/prototypes/prints_page_navigation_2026-10-16.html`) verbatim: *"Approved: build the prints page
navigation as shown — piece bar at the bottom, one On every print block, short size lines."* Studio › Prints only.

- **Piece bar (phone only).** Under the Prints form, in the lower third: ‹ · the piece you are on ▾ · ›
  (`studio-prints-bar.tsx`, through the one lazy door `StudioTool part="prints-bar"`). ▾ is the house `PickMenu` —
  a sheet on a phone, sticky group headings ("Your invitation set" · "For the day · free for every event" ·
  "Download the set"), a tick on the current piece, "On every print" first. A pick and ‹ › run the workspace's
  `select(k)` and its editor-column scroll to `[data-details-editor=k]`. The label follows the scroll
  (IntersectionObserver: the piece whose head last passed the top line; the last piece at the very bottom). The
  bar is a sibling under the scroller, so it never covers the last piece or its Save; it pads
  `env(safe-area-inset-bottom)` and steps aside while a field is focused (the keyboard). `lg:hidden`.
- **On every print.** One block at the head of the Prints form (new item `every-print`, Studio only):
  "Event Hub QR code · Always printed", the "Add an NFC sticker spot" switch (its ⓘ kept) and one Save. The three
  per-piece "Always printed" rows (Invitation · Finer Details · Event pass) and the NFC row under Finer Details are
  gone in Studio. Same print words form, same `inc_nfc` field. The Prints tile now opens on this block.
- **Short size lines.** A piece's head line names only the chosen size (`lib/print-head-line.ts`):
  "Calling card · 90 × 54 mm · one per guest", "A5 · 148 × 210 mm", the entrance chart "A2 · one sheet for the
  door". Every size stays in the dropdown.

Guards: `apps/web/lib/studio-prints-navigation.test.ts` (bar only in Studio › Prints on a phone · "Always printed"
once · NFC in "On every print" · head lines name the chosen size), each sabotaged red once.
`prints-tile-draws-every-piece.test.ts` and `studio-screens-follow-the-prototype.test.ts` re-aimed to the ruling.

SPEC IMPACT: None — the decision row already exists (corpus DECISION_LOG 2026-10-16 "STUDIO › PRINTS GETS A PIECE
BAR, ONE 'ON EVERY PRINT' BLOCK AND SHORT SIZE LINES").
