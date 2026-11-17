## 2026-11-14 · feat(shop): Check a date rises over the shop and reads like a cinema seat plan (SHOP-02 v7)

Owner-approved v7 (prototype "Check A Date Seats"; rulings 8db3baac · bc47ffe8).

- **Over the shop, not a page of its own.** The shop's "Check a date" opens the shop's own `?dates` address as a
  full-screen sheet (a centred 576px panel over the dimmed shop on a computer). × is the one way out ("See the shop"
  is gone); Back and Esc do the same; the shop is still underneath. The printed QR address `/v/<slug>/dates` and the
  sign-in resume forward to the shop with the sheet open, carrying the day, the services, the step and the arrival.
  The header shows the shop's logo (initials only when there is none).
- **Seats.** A day you can ask about is green; a day the shop closed is grey and striped (no ask, no book). The green is
  the same in both themes; only the shine changes. Tokens only (`--seat-*`, `--seat-off-*` in globals.css).
- **Popular days shine** with ✦ — the SHIPPED hot-date rule, moved from the event-setup calendar to `lib/hot-date.ts`
  (In demand · Hottest). They stay green. Reduced motion: a still band, no glide.
- **Months swipe**, the next one peeking; ‹ › and the arrow keys on a computer. Three years ahead (was two).
- **A tapped green day lists the shop's services at once**, the ones that can take it first, the rest greyed "Not
  bookable that day"; "Ask about this date" goes straight to "For which event?".
- Not in this change: **trending (🔥 at 10+ couples)** — it reads other couples' dates and gets its own PR.
- Guards: `check-a-date-is-a-seat-plan`; `no-inquiry-reads` now walks the new slot (140 modules) and pins that the old
  address only forwards. Lab: `/dev/check-a-date-lab` (dev only).

SPEC IMPACT: None — builds the owner-approved v7 design; the window widening to three years is part of that design.
