## 2026-08-23 · fix(couple): a finished event stops talking as if the day is still coming

Four things a celebration that has already happened used to say, and no longer does.

- **The schedule showed nothing on its very first open.** A non-wedding event seeds its
  run-of-show mid-render and then asked the database for the rows a second time. That second
  question is never asked: Next memoises identical GET requests for the length of one render, so
  the re-read was handed the answer from *before* the insert. The host read "0 blocks" and a plain
  reload showed five. The seed now RETURNS what it wrote (`INSERT … RETURNING`), so there is only
  one question. Measured in the dependencies rather than inferred — `postgrest-js` issues a plain
  GET with no `signal`, which is exactly what Next's `dedupe-fetch` dedupes.
- **The checklist did not know the day had happened.** It captioned a column of dates in the past
  "This week", painted every one of them red for overdue, and reported the lot at 0% under a green
  progress bar. It now asks the ONE lifecycle resolver every other surface uses. Exactly one
  caption on either ladder is reader-relative and therefore able to go stale — `s1 · "This week"`,
  which becomes "The week before"; every other caption is event-relative ("9–6 months before") and
  is left alone. Afterwards the dates lose the word "Due" and the alarm colours, and the countdown
  bar gives way to one line saying the list is a record now.
- **"Review" had no destination.** The After-phase menu entry and the finished-event summary card
  both opened the browsing bench. Both now use the shipped `?tab=build` deep link onto "Your team".
  ⚠ **And the review chip they promise did not exist on the live path.** "Leave a review" shipped
  only on `plan-budget-accordion.tsx`, which renders solely with `BUDGET_BUILD_ENABLED=false` — the
  kill switch, never thrown. The summary card's own comment asserted the opposite. It now ships on
  `build-locked.tsx` ("Your team"), gated on the same `reviewState()` window the review form and
  RLS enforce, using the review-status map the page already resolved.
- **The After stage promised a "7-day review window" that exists nowhere.** Grepped: nothing counts
  seven days over a gallery; the only seven-day clock in the product is force-majeure
  auto-resolution. Deleted rather than built to. The true half is kept — Photo Delivery defaults to
  `manual_release`, so the couple releases the gallery themselves. `afterPct` is now derived from
  its own items instead of hardcoded to 0.

🪤 **Two guards of my own were decorative until measured.** One matched a prop anywhere in the
vendors page and stayed green through a mutation that removed it from `BuildLocked`, because the
page also passes it to the fallback accordion (2 → 1 is still a match). One version of the review
chip — `text-mulberry` on a `bg-mulberry/10` tint — **measures 4.16:1 on the white page, below the
AA floor**, and both shipped contrast guards passed it: one checks token definitions, the other only
judges pairings where both sides are opaque. The solid action measures 4.76:1 light / 6.20:1 dark,
and is now inside the contrast guard's own count (1367 → 1368 pairings).

13 sabotages, every one measured by occurrence count before → after, all red.
9,520 unit tests green under `Asia/Manila`.

SPEC IMPACT: None. No migration, no schema change, no price or SKU change. The corrected claim in
`finished-event-summary.tsx` (that the supplier list already offered a review) is fixed in code
where it was written.
