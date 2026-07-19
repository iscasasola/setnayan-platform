## 2026-06-28 · fix(weddings): close Muslim-track integration gaps (Catholic leaks + unsurfaced Nikah data)

Follow-up to the Muslim wedding track (#2319). A parallel gap audit (5 dimensions,
each adversarially verified) found 9 real integration gaps — Catholic content
leaking onto Muslim weddings, and Muslim data the couple sets but no surface read.
All fixed:

- **Sponsors page** no longer renders the Catholic ninong/ninang + cord/veil/
  coin/candle machinery for a Muslim wedding — a pure-Muslim event redirects to
  the guest list (a mixed Catholic+Muslim wedding keeps it for the Catholic leg).
- **Checklist** drops the 3 Catholic sponsor tasks for Muslim couples (new
  `isMuslimCeremony` gate; Christian/INC/civil keep their sponsor tasks).
- **Guest-list View sidebar** filters are now ceremony-aware (Muslim shows "Nikah
  Principals", hides the Catholic sponsor/bearer filters, and vice-versa).
- **gender_separation** (the walima seating posture) is now surfaced: a coordinator
  banner on the seating page + a neutral guest-facing line on the invitation /
  day-of dress-code section. (No auto seat-reflow — the couple confirms with their
  imam; this just communicates the choice.)
- **Dress code** empty-state now has a Muslim modesty note (parallels the existing
  INC branch) so guests aren't left without guidance.
- **Imam essential** now ticks when the officiant is a booked vendor OR
  auto-resolved from a locked mosque venue — not only a guest with role `imam`.
  This also wires the previously-dead `muslim_mosque` officiant-auto-resolve
  framing (+ its PD 1083 hint) into a real surface.
- Removed the dead `mahr_prompt_deferred` write (nothing reads it; `mahr_description`
  is the single source of truth).

Verified: typecheck · 586 unit tests · lint + CI guards · production build.

SPEC IMPACT: None (implementation polish within the already-specced Muslim track;
`Muslim_Wedding_Build_Plan_2026-06-28.md` already covers these surfaces). Decision
log updated with the gap-audit outcome.
