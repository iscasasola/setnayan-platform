## 2026-10-21 · fix(dress-code): a guest man wears the palette on his tie — coat & pants black, shirt white

Owner, on the guest's invitation › Dress with us: *"for the guests. the coat and pants is not the color theme. we set
the tie as their palette and keep the coat and pants black"*.

- `lib/attire-figures.ts` — `wearsColourOnTie(role, style)` (the Guests row's man, `guest_m`, in a design with a tie or
  a bow tie: suit · 3-piece · tuxedo · vest and tie · vest and bow tie) and `tieZoneColours` (tie = the option colour,
  coat & pants and vest = `GUEST_SUIT_BLACK` `#1A1A1A`, the black the Mood Board already seeds for a groom, shirt white).
- `lib/role-figure.ts` — `zoneTints` wears a guest man's ONE option colour on the tie; colours given zone by zone are
  worn as given. `pickDots` says "Tie" under each guest option in a suit. One seam, so the Studio's Guests row and
  the Guests card on Dress with us (a plain guest's only dress-code card) both follow.
- Unchanged: every entourage role, the women, the guests' Barong Tagalog and Smart casual (owner questions in the PR).
- Guard `lib/guests-wear-the-palette-on-the-tie.test.ts` (rule · Studio · Guests card · what stays).

SPEC IMPACT: DECISION_LOG row 2026-10-21 "A GUEST MAN WEARS THE PALETTE ON HIS TIE" (corpus `DECISION_LOG.md`).
