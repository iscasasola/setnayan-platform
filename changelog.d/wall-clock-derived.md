## 2026-08-04 · fix(day-of): the live clock stopped being eight hours wrong

Three day-of surfaces compared the venue's WALL CLOCK against a real timestamp
and reported the difference as if it meant something. It did not — the answer
was always out by exactly the venue's UTC offset.

What people saw:

- **The couple's and guests' "running late" badge** announced a wedding started
  dead on time as **480 minutes behind**, the moment the coordinator pressed
  Start.
- **The host's live desk** counted an eight-minute-away moment as **"in 488
  min"** — the countdown was useless precisely when it mattered most.
- **The vendor's launched console** did the same on its own clock.

All three now read the planned time at the venue before comparing it, through
one shared `plannedInstant` — three copies is how they drifted apart. Where a
timezone genuinely is not known, the drift badge reports **nothing** rather than
a wrong number: a false "20 minutes behind" tells a coordinator to rush a
wedding that is perfectly on time.

Guarded by tests that fail if the arithmetic is reverted (mutation-checked), and
by fixtures that now state which values are wall clocks and which are instants —
the old fixtures asserted the bug.

SPEC IMPACT: None — this restores the documented behaviour rather than changing it.
