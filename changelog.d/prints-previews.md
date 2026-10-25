## 2026-10-14 · feat(maker · prints): every print row shows what it looks like — the route's own picture, full size on a tap; the entrance chart is its own row

Owner, verbatim: *"i cannot see what the different prints look like"* (Studio › Prints). Measured cause: on a phone
`lib/studio-details.ts` steps the picture aside for every full-screen form tool, and a print row's head was name ·
size line · size ▾ only. Approved prototype `prototypes/maker_prints_previews_2026-10-14_fable.html`.

- **Every print row's head carries its real picture** (`print-paper.tsx` `PrintThumb`): the SAME address the route
  already draws and the Save downloads from — the set pieces' `/api/hub-print/<piece>?mode=screen` (the address their
  body draws), the free group's previews, the entrance chart's PNG — at true paper proportions, lazy (near the screen),
  low priority, three at a time, from the browser cache when it is there; a page badge when the file has more pages.
- **A tap opens it full size on a phone** (`PrintPaperSheet`): pinch · double-tap · ⌕ to zoom, drag to look around,
  ‹ › + dots (or "Page n of N") for the pages, swipe when not zoomed; the size ▾ (the same pick); the paper's chips; How
  many (the layout's own numbers); the same Saves and "Changed since you printed". On a computer the picture is already
  the left column — a tap picks that print.
- **Empty**: the routes still draw the paper; the sheet says what is missing (no tables · nobody seated · nobody has said
  yes · no guests · no menu · no Love Story) with the door that fixes it — Seat plan and Love Story in place, the Guest list.
- **🪧 The entrance seating chart is its own row** (owner's answer to the prototype's open question; new free print
  `seating-chart`): By table | A to Z (the two-way pill), its size ▾ (A3 · A2 · A1 · 24 × 36 in), one Save for the layout
  picked; when the names do not fit, the chart's own words, the Save withheld, the size that fits one tap away. The pack
  ("Table signs & place cards") no longer carries the chart's Saves. Same route, same files.
- **Routes** (the only server asks): `?page=N` on the page-1 picture routes (guest registry, QR sheet — which now lists
  every guest and draws only that page's codes —, seating pack, caterer report) and an `x-print-paper` header with the
  layouts' own numbers (`lib/print-paper.ts`), URI-encoded JSON.
- Guard `lib/every-print-shows-its-picture.test.ts` (every row has a picture · it is the route its Save uses · no
  second renderer · the chart is its own row · the routes take `page` · first load untouched) — 8 sabotages, all red.

SPEC IMPACT: corpus `DECISION_LOG.md` row 2026-10-14 "STUDIO › PRINTS — EVERY PRINT SHOWS WHAT IT LOOKS LIKE (APPROVED) ·
THE ENTRANCE SEATING CHART IS ITS OWN ROW" (the owner's approval and his answer, recorded with the build).
