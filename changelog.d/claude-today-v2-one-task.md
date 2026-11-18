## 2026-11-18 · feat(supplier-today): Today v2 — one task at a time, the app does the thinking

Owner, 18 Nov, on the supplier Today: *"so many text. so confusing. i just wanted to reply to a review … keep focus on
one task … when i log in, ill just finish all that is here and i am good for the day"* — then *"all picks"* on the
drawing `Today, one task` v2 (artifact F4vQbaCwFtu2iawYd2r6q2).

- **Quick kinds answer on the row** (review · logged payment · date change · event finished · meeting time), with the
  shipped forms in `overview-sections.tsx`, one row open at a time; after a review reply the next waiting review opens
  with "✓ Reply posted". Reverses the 8 Nov "every Today row jumps" rule for these five kinds only.
- **Bigger kinds open ONE focused screen** (the shipped `SupplierOpenRow` rise) — inquiry, message, booking ask (fee
  read before Agree via `forecastForBooking`), cancel request, quote/contract draft, lapsed ask ("Got it"), dispute.
  ✕ returns to Today with the task still listed.
- Cover says "N tasks today · N of M done" with pips, or "✓ You're done for today"; a **Done today** list read off the
  columns that already stamp each answer (no new table). An unread desk still never says done.
- Every row names the badge it moves, or "Your page"; a **Next badge** card (Completed bookings, one RPC); **Grow your
  business** (five stages); **Also for your badges and your page** (permit, payout, findable, credit/gift with "Not
  now", a card with no cover) — not counted; **What's trending** from the demand radar + Trending Now holds.
- Confirm-payment and I-delivered answered on Today now come back to Today (one exact `return_to` literal each).
- **The shop's room to grow, as tasks** (owner 18 Nov, same day: *"we want tasks on inspiration library · or if you
  have a plan and there is more service cards to do … deplete their cards"*): "Add to the inspiration library" moves
  from a door under the Shop row into the Today list (with the count of approved photos), and "You can put N more
  cards online · Your plan holds X · Y online now" opens the card maker. Neither counts toward done; both take "Not
  now". ⚠ The cards row needs the plan's card total from #7975 (`serviceCardsTotal`) — until that is on main the
  page passes no allowance and the row is not drawn (an unread number draws nothing).
- Admin › Settings: two new owner lines, "Few inquiries — in 28 days" and "Few bookings — this month". Blank = off.

Migration `20271350875090_grow_lines_on_today_are_the_owners.sql`: two nullable INTEGER columns on `platform_settings`
(the `drive_speed_kmh` pattern) — no new table, no new RLS.

SPEC IMPACT: DECISION_LOG row "TODAY v2 BUILT" — the 8 Nov "every Today row jumps" rule no longer holds for the five
quick kinds; the two grow cut-offs live on Admin › Settings, blank = off.
