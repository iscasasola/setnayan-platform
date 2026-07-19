## 2026-07-02 · fix(vendor): real Heat map, one legend, black BLOCKED days on My Customers calendar

Three owner-reported issues on the My Customers month calendar
(`/vendor-dashboard/customers`).

- **Heat map now shows a heat map.** The toggle was a *dimmer* — it dropped every
  non-booked day to 45% opacity, so on a vendor with no bookings the whole grid
  just faded (nothing that read as "heat"). It now **tints each day by booking
  intensity** (occupancy = `consumed / capacity`, warm gold with alpha scaled by
  intensity) via a new pure `heatOf(day)` helper; open days stay neutral, busy
  dates glow warmest. Past-day muting is unchanged.
- **Honest empty state.** When Heat map is on but the month has no bookings to
  map, the calendar now says so ("No booked dates this month to map yet…")
  instead of leaving an unchanged-looking grid.
- **Legend de-duplicated.** The 6-state key was rendered twice — the always-
  visible dot row under the grid *and* again inside the ⓘ info popover. The
  popover is now help-only ("How to read this calendar": points at the single
  key + explains Locked/Whitelist holds and the heat map); the grid legend is
  the one source. Dead `LegendRow` + `LEGEND_DOT` removed from
  `customers-filter-bar.tsx`.
- **Blocked (unbookable) days now read as black.** A closed date used to show a
  faint grey "Blocked" chip that was easy to miss. The whole cell now paints
  black (`--m-ink`) with a white uppercase **BLOCKED** stamp — a hard closure
  should be unmistakable — and it wins over the heat tint. Day number + any
  partial-block event labels flip to white for contrast; the bottom-legend
  "Blocked" dot went black to match. Full (sold-out) and Locked (on-hold) keep
  their distinct treatments.

Verified: `tsc --noEmit` clean on both changed files.

SPEC IMPACT: None — behavioral/UX fix on a shipped surface; no schema, pricing,
or catalog change. The old "Heat map dims quiet days" wording lived only in code
comments, now corrected in place.
