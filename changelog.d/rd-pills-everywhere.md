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

## 2026-10-08 · feat(ui): every segmented selector is the one pill — area 2, the supplier's dashboard

Same ruling, same template; shape, colour and motion only. Adds no request.

- **Converted (8):** Momentum window (Daily | Monthly | Annual) · Billing cycle
  (Monthly | Annual) · Your services sections (Coverage | Service cards) · QR
  type on the dashboard card and on the QR Code Generator (Shortlist | Locked) ·
  Discount unit (% | ₱) · how a payment is set (% of total | Fixed ₱) · Billing
  term on a custom plan (Every 28 days | Yearly — a radio group, so the pill in
  shape and colour; it does not slide yet).
- **Two small accessibility words changed so the thumb can find the picked
  choice:** the picked Billing cycle link says `aria-current="page"` (it said
  "true"); the two sides of "how a payment is set" now say `aria-pressed` (they
  said nothing).
- **Guards:** 8 lines added to `lib/pills-are-everywhere.test.ts`; the watch
  widened to `app/vendor-dashboard` (nothing added to its baseline).

SPEC IMPACT: None.

## 2026-10-08 · feat(ui): every segmented selector is the one pill — area 3, onboarding and the public pages

- **Converted (1):** the wedding onboarding's song step — Top 100 | Search |
  Playlist. Onboarding's own CSS keeps two rules for it that only give back the
  padding its `.onbw * { padding: 0 }` reset removes; the look is the template's.
- Everything else found on these pages picks one of 3+ values, filters, or is a
  card picker — listed for the controller, not converted.
- **Guards:** one line in `lib/pills-are-everywhere.test.ts` plus a check that
  onboarding.css does not draw the selector's look again; the watch widened to
  onboarding, sign-up, sign-in and the public route folders.

SPEC IMPACT: None.
