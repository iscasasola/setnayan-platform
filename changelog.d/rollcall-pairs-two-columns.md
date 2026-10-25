## 2026-10-14 · feat(entourage): the Roll call draws a pair as two columns, with no "&"

Owner, verbatim, 2026-10-14, on the Wedding March scene: *"we find the roll call
okay but. The names feel too crowded. Maybe have their pairing show in 2 columns
without the &."*

In `EntourageSection`'s Roll call (`app/[slug]/_components/entourage-section.tsx`
— the guest Event Hub, and the Maker's Wedding March stage, which draws the same
component), every data-paired group — Principal Sponsors, Bride's Crew & Groom's
Crew, and the stacked Secondary Sponsors (Candle · Veil · Cord · Coin) — now
draws each walking pair as ONE row of TWO equal columns (`PairRow`), left person
and right person side by side, no "&":

- the two columns hold at 375 px (`grid-cols-2`, no breakpoint), so a pair never
  stacks; a long name wraps inside its own cell (`min-w-0 break-words`), and
  the two cells share a first-line baseline;
- someone walking alone is a row of their own starting at the left edge, so
  every name in the list begins on one of the same two edges;
- a screen reader still hears the pair as "X and Y" (a visually-hidden " and "
  ends the left cell), then the roles the heading names (", Ninong and Ninang");
  under a by-role sub-heading ("Candle") no role is repeated;
- who is shown, the role sub-headings and the march order are unchanged.

Unchanged on purpose: the printed Entourage card (`printedEntourageLines`) keeps
2026-09-30 option 1 (a pair is one "A & B" line) — the ruling was about the
scene; the Secondary Sponsors' `inline` drawing ("Candle: names", which nothing
sets yet) is one line by its nature; the Two sides and The march styles
(`entourage-styles.tsx`) have their own drawing; and the other two-column groups
(Parents, Maid of Honor & Best Man, …) keep their look.

Guard: `app/[slug]/_components/the-heading-says-the-role.test.ts` now pins the
two-column shape (two cells per pair, no "&", `grid-cols-2` with no
breakpoint, `items-baseline`, `min-w-0`, "X and Y" to a screen reader) in place
of the one-line " & " shape. Sabotaged five ways (stack on a phone, the "&"
back, the hidden "and" removed, `min-w-0` removed, the shipped component
restored) — each red, restored green.

SPEC IMPACT: Supersedes the 2026-09-30 "option 1" (a paired Ninong & Ninang as
ONE line) on the PAGE's Roll call — the printed card keeps it. The controller
writes the DECISION_LOG row.
