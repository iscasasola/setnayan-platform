## 2026-09-26 · feat(prints): Prints & Tickets holds every print — a free group, and Classic prints free

Two owner rulings of 2026-09-25 (DECISION_LOG "PRINTS & TICKETS HOLDS EVERY PRINT"
and "EVERY PRINT IS FREE IN THE CLASSIC LOOK; THE THEMED VERSION IS PRO").

**The free group** — a new section at the top of the Maker's Prints & Tickets
(`launch/_components/maker-prints.tsx`, list in `lib/free-prints.ts`), open to every
event and shown in the app-store shell. Each item has a real preview thumbnail and a
button that SAVES a file (`print-save-button.tsx`: fetch → share sheet on a phone,
download on a computer; an expired tap keeps the file and asks for one more tap; a
refusal says so in words). Linked, not rebuilt:
- **Guest list registry** — NEW. The reception-desk list, A4 PDF: alphabetical by
  surname, party size, table, RSVP, a check-in box and a signature line
  (`lib/print-guest-registry.ts`, served by `/api/hub-print/guest-registry`). A
  "passed away" hook (`passed_away` / `listedNotCounted`) lists such a guest but keeps
  them out of every count; the column does not exist yet.
- **Guest QR codes** — the #5977 sheet (`/api/hub-print/qr-codes`).
- **2D seat plan** — `seating/export` (moodboard + blueprint); new `?format=preview` SVG.
- **Table signs & place cards** — `seating/print` gains `?format=pdf` (the same pack as
  a PDF; the App Store app's web view has no print dialog) and `?format=preview`.
- **Caterer meal counts** — `seating/caterer` gains `?format=pdf` and `?format=preview`;
  CSV kept.
- **Event QR** — the guest-facing `/api/website/qr/<slug>` PNG. NOT `/event-qr`, which is
  the crew-pairing code carrying the event's master token.

File names follow the owner's rule, `<event slug>-<print>.pdf`
(`cale-ice-guest-registry.pdf`, `cale-ice-seat-plan.pdf`; `printFileName`).

**Classic is free, the theme is Pro.** `mayServe` now takes the theme: every set piece
and the per-guest pass batch are print-ready (bleed, crop marks, no watermark) in
Classic (`house`) for every event, store shell included; the same piece in the couple's
theme still needs Event Hub Pro, and without it stays the watermarked low-res sample.
The hub-print route resolves the theme ONCE and hands that theme to the loader, so the
gate and the drawing cannot disagree. Web: "Go Pro to print in <theme>"; store shell:
the themed print-ready buttons are absent.

Decided here: the seat plan's moodboard/blueprint modes and the seating pack's look are
NOT "themed" — they are not Event Hub themes, were free before, and stay free.

Tests: `lib/free-prints.test.ts` (every free print reachable, un-gated, visible in the
store shell, saved not opened, named by rule), `lib/print-guest-registry.test.ts`
(alphabetical, columns, listed-not-counted, page breaks, real PDF pages),
`lib/print-pieces.test.ts` (the gate: no free path reaches the THEMED print-ready
renderer; Classic print-ready is free).

SPEC IMPACT: None — both rulings are already recorded in DECISION_LOG 2026-09-25.
