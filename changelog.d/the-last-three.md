## 2026-08-19 · fix: the last three of the sweep — a package, a Samahan, a library

**1 · The public shop page sold a package it could not read.** A refused items
read EMPTIED the package instead of failing it, so the shop appeared to be
selling something that included nothing — on a public page, to somebody deciding
what to buy. The file already carried a 🚨 warning saying exactly this, and only
LOGGED it. **A comment describing a failure mode is not a guard against it.**
⚖ It now returns `[]`, and the section is gated on `length > 0`, so the section
is OMITTED. Between *"we are showing you nothing"* and *"we are showing you the
wrong thing"*, only the second is a lie. Same rule applied one level down to the
options read: "a line is a choice iff it has options", so a refused options read
turns every choice into a fixed inclusion and the couple never learns they could
have picked.

**2 · A Samahan told one of its own members it had 0 members.** `count ?? 0` with
the error unbound. The reader is BY DEFINITION a member of that community, so it
is a number they can personally disprove. The flag is ADDITIVE on purpose —
`member_count` is a plain number read by nine surfaces, and widening it to
`number | null` would ripple through all of them for one headline.

**3 · The library told a host they host nothing.** A refused membership read
empties `events`, and all three album lenses derive from it. That file's own
comment says saying this to a host *"would be a lie"* — it anticipated the
wrong-lens case and not the refused read.

SPEC IMPACT: None. This closes the 11 confirmed instances found 2026-08-19.

🪤 THE TYPE CHANGE IN (3) BROKE SIX DEGRADED FALLBACKS IN LAYOUT FILES — none of
them named in any finding. Caught by comparing the TOTAL typecheck count against
the known baseline (270), after an earlier fix today shipped broken because the
output was grepped for only the files I had touched. **A type change breaks its
CONSUMERS, which are by definition the files you did not name.**

🪤 And the first mutation of guard 1 did not land (count 7 → 7) and read as a
pass. Re-run as an actual removal of the `return` — the shape of the real
regression — it went RED. **An unmeasured mutation proves nothing.**
