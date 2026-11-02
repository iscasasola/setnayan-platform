## 2026-08-19 · fix(guests): the phone's guest summary stops inventing zeros

A gap in my own fix from earlier today, found by re-counting rather than by
re-reading: of 21 places the guest page renders a figure derived from the rows,
the first pass gated 3. The one that mattered most was ungated.

`mobile-guest-carousel.tsx` renders the headline count and the three RSVP pills.
The page hides its DESKTOP header on mobile deliberately — its own comment says
"the carousel's Summary panel carries the count" — so on a phone this panel is
the ONLY count there is. An ungated zero here is not a duplicate of a lie told
elsewhere; it is the whole lie, on the surface where a couple is most likely to
be looking on the day.

Now: the headline reads "Guests" rather than "0 guests" when the read was
refused, and each pill reads "—" rather than a fabricated 0.

🔑 THE LESSON IS THE METHOD, NOT THE FIX. The first pass fixed the claims I had
READ. Counting every use of the stats object found the rest — 21 uses, 3 gated.
Grep the value, not the screen you remember.

SPEC IMPACT: None.
