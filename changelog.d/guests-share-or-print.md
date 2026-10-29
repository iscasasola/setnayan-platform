## 2026-10-30 · feat(guests): 📤 Share or print — each Guests view hands over its own files (slice 8)

The Guests top row's 📤 round (left of the ⚙, on both faces of the row — DECISION_LOG 2026-10-29: "📤 is NOT drawn yet —
it waits for the per-view 'Share or print' sheet (slice 8)") will open ONE "Share or print" sheet listing what THIS view can
hand over, as the approved prototype's `printsFor` / `shareSheet` draw it. Each row: name · one line · the house Share
button (`SharePdfButton`: Paper ▾ where the file takes it; the file is made on Share, then the phone's share sheet or a
download). The help sits behind ⓘ.

| View | Files |
|---|---|
| List | **Guest list** (as shown — the ⇅ Show + Group by) · **Check-in sheet** · Meal count |
| Map | **Guest list** (the Map's groups) |
| Seats | Seat plan · **Table list** · Entrance seating chart · Table signs & place cards |
| March | **Wedding march order** |

- **Linked, not redrawn (Rule 0):** Meal count, Seat plan, Entrance chart and Table signs & place cards are the prints
  that already ship — the same routes `lib/free-prints.ts` names (`seating/caterer`, `seating/export`, `seating/print`).
- **New, on #7032's engine (`lib/share-pdf.ts`):** the four documents in bold, drawn by
  `app/dashboard/[eventId]/guests/share/route.ts` from pure models in `lib/guests-share-pdf.ts`. Names are the printed
  name (`guestPrintName`: full name + “nickname”); counts carry commas; an empty list says so in words.
- **Doors before any name:** signed in · a delegate the couple never shared the guest list with is refused (their read
  would be zero rows — a file of nobody) · the march is the couple's only (its read uses the service client) · every
  refused read is a 503 in words.
- The march's read moved, unchanged, into `lib/guests-march-read.ts` so the March view and its PDF are one reading
  (`guests-march.tsx` calls it; `the-band-reads-what-the-host-typed` test points at the new home).
- ⚠ **The 📤 round itself is NOT in this change.** The Guests/Seats top row is being reworked by another builder
  (2026-10-30), so this PR ships the files, the route and the per-view list (`guestsShareItems`) and leaves the row
  alone. The round (`guests-share-round.tsx`: one Sheet of `SharePdfButton` rows) waits, ready, on branch
  `claude/fervent-cannon-exu8lv-share-round`; placing it is: compute
  `guestsShareItems(gview, { eventId, slug, filter, showLabel, groupLabel })` and draw `<GuestsShareRound items={…} />`
  just left of the ⚙ (and let the pinned face's `--gs-rounds-w` count its width).
- The route's event read now binds its error: a refused read answers 503 in words, never "Event not found".
- Not built (no print engine draws them yet): the prototype's **Family map** poster (Map) and **Cue cards** (March).
- Guard `lib/guests-share-or-print.test.ts` (renders real PDFs and reads their words back).

SPEC IMPACT: None — builds the approved prototype's Share or print sheet.
