## 2026-11-10 · feat(rise): a Clients row rises full screen · Today pins "Needs you today" · equal-width buttons on Share and the QR card (Build 5 · Lane A, slice 2)

Build 5 plan Step 0 rows 30–31 + the T19 equal-width rule; owner approved the supplier prototype (v119) 10 Nov.

- **A Clients row RISES FULL SCREEN** (owner 10 Nov on a Clients screenshot: *"The event did not grow fullscreen as
  planned"*). `SupplierOpenRow rise` — below 701 the row's head (same title · line · avatar · stage, its arrow now ›)
  opens the shipped `RiseScreen` holding the event's fixed lines (Event type · Celebrant · Hosted by · Location / Date /
  Pax · Service requested · For your service) and its door or inquiry answers, drawn ONCE (the fold holds no body). The
  rise is the slice-1 shell's: 0.7 s from the row, bars slide away, ✕ / Esc / Back fall back into the row on the same
  scroll. Every Clients list (Asking · Booked · Done · All) draws `RosterRowView`, so it is every row. From 701 the row
  still opens in the right column (the wide Rise is Lane R's owner pick). `Fold` gains `rises` (› + `aria-haspopup`).
- **Today: "Needs you today" is the ONE pinned row** (owner 10 Nov: *"Needs you today is the correct one to be pinned
  rather than the row above it."*; DECISION_LOG 2026-11-10 📌). The cover (greeting · date · tasks) and the stats strip
  scroll away — the two `CollapsingTop`s are gone from Today; the Needs heading + count sticks (the Clients pinned-row
  template: sticky, page ground, soft hairline, `data-pinned-row`), and Today's ONE ⚙ moved to its right end. A new
  shop's setup keeps its own pinned heading (the Needs heading does not pin there). `TodayPinnedRow` is no longer
  mounted (left for the undershell sweep with its words' guard).
- **Equal-weight choices at equal widths (T19)** — the house `EqualRow` (components/action-button.tsx: equal grid
  columns, fits as one via `useFitRow`, every button fills its cell incl. icon-only); the chat cards' copy now re-exports
  it. The QR card (Today's step 6 · every Your-QR-codes card) draws Share · Copy link · Download QR in it; the risen Share
  door's Copy · Save · Share are `.ab` presses of one width (Save wears the Share icon, the file-button rule; Share keeps
  the `<Share aria-hidden …/> Share` shape its icon guard anchors on). An equal row now fits on each BUTTON's content box:
  equal cells never make the row overflow and a centred word eats the padding before `scrollWidth` sees it, so
  "Download QR" ran into its edge at 375 while the row read "full"; it now steps to words-only, as one.
- 🔒 `customers/a-client-row-rises-full-screen.test.ts` · `_components/today-pins-needs-you-today.test.ts` ·
  `lib/equal-weight-choices-sit-at-equal-widths.test.ts` (9 of 10 red on main; sabotaged). Re-aimed
  `the-today-page-speaks-to-every-supplier.test.ts` "first taps" (the ⚙ left the cover by ruling).

SPEC IMPACT: None — builds the approved Lane A design (DECISION_LOG 2026-11-10 ⤴ + 📌); HOUSE_TEMPLATES T19's "NO GUARD
— needs one for equal widths" now has one (corpus row to update on merge).
