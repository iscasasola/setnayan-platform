## 2026-10-28 · feat(prints): R8 — Prints leaves Studio for its own page; Home gets a Prints line; every old print door forwards

Owner, 2026-10-27 (DECISION_LOG "PRINTS LEAVES STUDIO — ITS OWN PAGE (THE APPROVED SWIPE CAROUSEL), OPENED FROM A PRINTS LINE
ON HOME; NO NEW BOTTOM TAB"): *"Prints leaves Studio. It keeps its own page (the approved swipe carousel) and Home gets a Prints
line that opens it. No new bottom tab."* — and 2026-10-28 *"all mapping will be kept"*. Build plan
`EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 7b (R8).

- **The page** — `/dashboard/<id>/prints` (`app/dashboard/[eventId]/prints/page.tsx`). It renders the Maker's OWN page
  (`launch/page.tsx`) told to draw Prints alone by `PRINTS_PAGE_SURFACE`, a Symbol key on the `searchParams` object it hands
  over (no address can carry it). Nothing is redrawn: the swipe carousel, ⚙ Print settings, Download ▾, View as ▾, the
  PrintSaveButton / usePrintSave saves and share icon, every format and "Changed since you printed" are the shipped ones. The
  shell (`printsPage`) names the page "Prints" where Stages | Studio stood, keeps ↶ · ✓ (Event Hub Pro dropped ✕), and draws the workspace full
  screen as the Studio tile did (no Studio home, no lower third). A viewer with no Maker work, or an event that needs no Event
  Hub details, is sent to Home.
- **Home's Prints line** — `HomePrintsLine` (`_components/home-prints-line.tsx`), drawn after the Papic card from the control
  row's own card (`.sg-row.hc-card` + `.hc-card-door`): name with ⓘ (the Studio card's words, moved to
  `lib/prints-page.ts` `PRINTS_PAGE_CARD`), one line, ›. Only where Prints has work (`makerHasWork` + `needs.hubDetails`).
  Home holds the door, never the tool. No bottom tab.
- **Removed** — the `prints` Studio tile (`STUDIO_TILE_KEYS`, `STUDIO_TILE_ITEM`, `STUDIO_TILES`, `STUDIO_TILE_PARTS`,
  `STUDIO_PAGE_CARDS`, `TILE_ICON`); the Maker's Prints doors (Page ▾ › Prints `MAKER_PAGE_ACTIONS.prints`, Settings › Prints,
  the menu's Prints part). Studio's "n of N ready" loses one ready and one total (Prints was always ✓). Home's progress and
  the guided flow held no print, so nothing there moved.
- **Every old door forwards** — `launch/page.tsx` forwards `?tool=prints`, `?tool=details&item=<print>`, `?item=every-print`
  (and a save's flash / picked size / View as, `PRINTS_PAGE_CARRY`) to the page at the same piece, before any read
  (`printsForward` — the same `detailsItemFor` the Maker reads an address with). `detailsItemHref` (every link into Details)
  gives a print the page's address; the guest card's return from the invitation is the page. Inside the app: a print opened in
  the Maker loads the page, anything else opened on the page loads the Maker (`itemElsewhere`).
- **Help** — Home's spotlight gains a "Prints" stop (`home-prints`); the Hub slide of the event-menu tour no longer says every
  print is made there; the Prints feature page says "Open Prints from Home".
- **Maps** — Ugat screens map regenerated (`/dashboard/[eventId]/prints` added), port baseline regenerated (475 routes; nothing
  lost — the Prints doors are MOVED, held in `the-maker-toolbars-lose-nothing.test.ts`), admin map regenerated (no change but its
  stamp). Labs: `/dev/maker-lab?prints=1[&item=<print>]` is the Prints page; `/dev/home-lab` draws the line (`&prints=0` drops it).
- **Guards** — `lib/prints-has-its-own-page.test.ts` (9 tests, one per move; 11 sabotages, each RED). Re-aimed: the Studio
  tile, toolbar, lower-third and one-Maker guards now hold Prints as MOVED (counts derived from `STUDIO_TILE_KEYS`, never typed).
- **Fix (2026-10-30, walked 390 after merging main)** — the Prints page opened on a bare warm page on a phone: the carousel
  lives in the workspace's editor sheet, which opens at mount only when a door was pressed. The page now mounts with its
  door pressed (`maker-shell.tsx` `detailsDoor`), as the Studio tile did; guard 2b (sabotage → RED).

SPEC IMPACT: `DECISION_LOG.md` — new row "BUILT — R8 · PRINTS HAS ITS OWN PAGE" (2026-10-28); `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md`
step 7b marked built (PR). No ruling changed.
