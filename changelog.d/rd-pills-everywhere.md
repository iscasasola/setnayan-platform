## 2026-10-08 · feat(ui): every segmented selector is the one pill — area 1, the couple's dashboard and the shared pieces

Owner, verbatim (2026-10-08): *"adjust all pill selectors to this if possible"* ·
*"we want the whole app to be adaptive to the same feel"* · *"the only part that
does not follow our rules is their customized event hub"*. Template:
`INTERACTION_RULES.md` § 9 — `app/_components/pill-selector.tsx` (a full pill; the
terracotta thumb slides; grey when off). Shape, colour and motion only — every
handler, address, role and name is as it was. Adds no request.

- **`app/_components/pill-track.tsx` (new)** — the template's "second way in" as
  three elements (`PillTrack`, `PillLink`, `PillButton`), so a SERVER page can
  wear it (the template's class strings live in a client module). It draws no
  look and decides no behaviour of its own.
- **Converted (16):** Planner mode · Display language (Profile) · Seat plan view
  (List | 2D | 3D) · Seat-plan panel (People | Tables | Rules) · who can sit here
  (guest | group | role) · the seat plan dock's two-way toggles · How to make
  your mark · Schedule view (given the thumb) · Guest list views (List | Map |
  Setup) · How moments are made (Automatic | I choose) · Preview device (iPhone |
  MacBook) · How the video plays (Fill | Fit) · one area's access (Edit | Off |
  View) · how to set the date · Order the reel · a thread's views (Chat |
  Decisions | Files) · the two-sided workspace tabs.
- **Two are the pill in shape and colour but do not slide yet** — one area's
  access and "how to set the date" are radio groups (`aria-checked`), which the
  thumb does not read. One line in `pill-thumb.tsx` would let them.
- **Profile's Planner mode / Display language** is now ONE form whose choices are
  submit buttons carrying `name=value` (it was one form per choice); the picked
  choice is a plain button that sends nothing.
- **Dead CSS removed:** `.seg` in `guests-screen.module.css` and
  `make-it-yours.module.css` (the latter keeps its shake and focus ring under
  `.modeseg`).
- **Guards:** `lib/pills-are-everywhere.test.ts` (new — one line per converted
  selector; the Event Hub under `app/[slug]` stays out);
  `selectors-are-pills-that-slide` watch widened to `app/dashboard` and
  `app/_components`; `the-guest-list-sheet-is-calm` now pins the template's track
  and thumb instead of the screen's own `.seg` class.

SPEC IMPACT: None — `INTERACTION_RULES.md` § 9 already names the pill selector as the one source; this applies it.
