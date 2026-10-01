## 2026-09-30 · copy(suppliers): the host's "Your Team" says Suppliers outside the nav

Owner 2026-10-01 (DECISION_LOG "THE BOTTOM BAR IS HOME · GUESTS · SUPPLIERS · HUB · MORE"): the
host's "Your Team" is renamed **Suppliers**. PR #6205 renames the bar, sidebar, ☰ drawer and tours;
this sweep renames every OTHER host-facing string — the Overview card, the Suppliers page masthead
and part picker, the summary chip's label, empty states, the guard banner, the date-window
sentence, the features page, the public tour — and adds `lib/the-host-says-suppliers.test.ts`, which
fails on any host-facing "your team" left in `app/` or `lib/` (a supplier's own staff pages are
allow-listed; #6205's files are PENDING until it lands). No identifiers, routes or schema change.

SPEC IMPACT: None — decision logged.
