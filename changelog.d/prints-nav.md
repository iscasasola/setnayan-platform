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

## 2026-10-16 · feat(prints): every "download all" is Event Hub Pro; one guest's pass stays free; the Event pass offers every guest's pass

Owner, 2026-10-16: *"where can i see all the event Passes for print? i only saw a sample of the event pass. don't know where the
print file is"* — then the ruling (corpus DECISION_LOG "PRINTS: ONE AT A TIME IS FREE — EVERY 'DOWNLOAD ALL' IS EVENT HUB PRO"):
*"Yes — Whole set (PDF) and Every guest's pass (PDF) become Pro. Each piece's own PDF, and each guest's own pass one at a time, stay free."*

- **Event pass row (Studio):** "Every guest's pass (PDF)" (the shipped `passes` file, in the size picked on the row) beside the one-pass
  "Sample (PDF)", the line under both "<N> passes · <a> coming, <p> not replied yet · <size>, ganged on A4 with cut lines" — the file's
  own count and where those guests stand (`loadPassGuestNames` + `passGuestReply`, the printed passes' read and the reply the pass rule
  reads; coordinator 2026-10-16: the 2026-09-29 rule stands, the number IS the file). A 0 part is dropped; a "maybe" is counted, never
  hidden. Unread → "Guests who are coming"; nobody → said in place, no button.
- **One guest's pass, free:** "Pass for ▾" (the Form row's dropdown, guests who have a pass) + "Save PDF" → `/api/hub-print/pass?…&pass_guest=<id>`
  (new: the route prints that one guest's pass; `loadGuestPasses({ onlyGuest })`).
- **Pro, server-enforced:** `/api/hub-print` refuses `passes` and the whole `set` (not its sample sheet) to an event without Event Hub Pro —
  `printOwnsPro`, the ticket zip route's read (an internal host's event counts) — 403 with words, before drawing (`isAllInOnePrint`).
- **Pro, marked:** the whole set, every guest's ticket, the Printed ticket batch and the new all-guests file wear the zip's ◆ pattern in
  Studio and the shipped Details (owned: the file, ◆ unlocked; free: the door + centred note `StudioProDoor`; store shell: absent).
  "Save again" on the set and the ticket batch only where the file can be saved.

Guards: `apps/web/lib/all-in-one-prints-are-pro.test.ts` (the route's GET called with its I/O stood in for: free refused, Pro served, one pass
and a piece free; the ◆ marks rendered) and test 5 of `studio-prints-navigation.test.ts` — each sabotaged red. Re-aimed to the ruling:
`studio-prints-money-is-unchanged` (golden re-recorded, reason in its `_about`), `paid-mark`, `free-themes-are-free`, `print-pieces`,
`changed-since-you-printed`, `printed-tickets-drop-who-cannot-come`, `studio-prints-are-the-templates`, `studio-screens-follow-the-prototype`,
`the-maker-lower-third-holds-every-tool`.

SPEC IMPACT: None — the decision row already exists (corpus DECISION_LOG 2026-10-16 "PRINTS: ONE AT A TIME IS FREE — EVERY 'DOWNLOAD ALL'
IS EVENT HUB PRO").
