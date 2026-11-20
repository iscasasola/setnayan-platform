## 2026-11-20 · feat(memories): Papic on top, its settings rise full screen, and the four keepsake sheets share one shape

The owner's approved drawing, built as drawn (owner 20 Nov, "memories approved":
`prototypes/memories_redesign_2026-11-20/memories_redesign_2026-11-20_fable.html`; DECISION_LOG 2026-11-20 "EVENT ›
MEMORIES — PAPIC ON TOP + FIVE OPENED PAGES, APPROVED"). The parts are re-arranged and restyled. There is no schema
change and no new server function.

- **Order:** Papic block → Magazine · Recap · Flash · Thank You → the filter row (All · All chapters · N photos · ⚙) →
  the grid. The filter row, the grid with its "Add photo · 3 credits each" cell, the round search, the floating +, and
  the top and bottom bars are unchanged.
- **The Papic block** (`papic-home-card.tsx`, the same card, restyled): camera mark + "Papic", with the shipped head
  picker on the right. Its behaviour and its tests are untouched.
  - One state line, computed from the real gate (`lib/papic-guest-cameras-line.ts` over `guestCaptureGate`). It reads
    "Guests’ cameras open Fri 18 Dec", "… are open now", or "… are off", and is never a fixed date.
  - The line is honest while a draft waits ("… · on after you Apply").
  - When the picker is pressed, the card shows this line for the picker's words (`lineFor`).
  - ONE big "N credits left". Total · Taken move into its ⓘ. An unread pot shows "—", never 0.
  - Two equal buttons:
    - **Add photos** (main) opens the phone's picker in the same tap. The picked files go to the ONE shipped uploader in
      the ONE Add photos sheet (`memories-add-photos.tsx` → `AddToLibrary`'s own `onPick`). Where adding by hand is
      off, the button opens the shipped `UploadsOpenChoice` sheet.
    - **Add more** is the shipped buy sheet.
  - A full-width "All Papic settings ›" row.
- **Settings sheet:** a tap on the block body or on that row opens every Papic setting in the shared `RiseScreen`
  (rise full screen: ✕, Esc and Back close it).
  - "Shooting into" comes first, then the same items in the same order.
  - An outcome banner, `?buy=`/pool errors and old `?papic=open` links open the sheet.
  - The inline unfold (› → ⌄, the inert region) is gone.
- **Keepsakes:** the buttons get the block's white rounded look (`bg-frame shadow-sn-frame`). Their four sheets share
  one shape:
  - a handle, the card's icon and title once (with the Recap's PRIVATE mark beside it), and ✕;
  - one line + ⓘ, then one main button (each card's new `seat="sheet"`).
  - The small-caps eyebrow and its rule are gone. Every word is kept.
  - Thank You's sheet now carries "A short film for everyone who came" and "Open your Thank-You Video". The button goes
    to the same page the old row opened.
- **Guards:**
  - New: `memories-papic-is-on-top.test.ts` renders the gallery and checks the order (sabotage seen red).
  - New: `papic-guest-cameras-line.test.ts`.
  - Updated where the drawing changes them, each marked "UPDATED ON PURPOSE 2026-11-20":
    - `papic-opens-in-memories` (the rise, not the unfold);
    - `papic-lives-in-memories` and `the-keepsakes-are-a-row` (the order, and `seat="sheet"`);
    - `papic-chapter` (the chapter row is drawn in the opened sheet);
    - `life-flash-card` and `r3-thank-you-forwards` (`seat="sheet"`);
    - `home-upper-opens-lower-grows` (the head rises);
    - `only-the-acting-widgets-are-framed` (`sn-frame` counts as a frame).

SPEC IMPACT: None. This builds an already-approved drawing and ruling (DECISION_LOG 2026-11-20). No corpus decision
changes.
