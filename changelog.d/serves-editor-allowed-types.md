## 2026-07-28 · fix(vendor-coverages): serves edit sheet renders only the event types the leaf may serve — ending the silent checked-then-dropped save

Inherited gap confirmed by the 2026-07-28 adversarial review: the coverage CREATE
flow filtered its event-type chips to the leaf's `allowedEventTypes`, but the
serves EDIT sheet (and the flag-dark canvas maker's audience sheet) rendered the
FULL vocab while the server (`parseEventTypes`) silently dropped disallowed keys
behind a `?saved=1` redirect — a vendor on a restricted leaf could check
"Corporate", save, see success, and persist nothing. Live prod: 72/73 tier-2
tiles carry a restricted set, so nearly every coverage could hit this.

The rule now lives once in `lib/coverage-allowed-events.ts` (null/EMPTY allowed =
unrestricted, identical to the server and the create flow) and all three
surfaces render through it — create flow (deduped onto the helper), edit sheet,
and canvas audience sheet (composed with `audienceGroups`, catch-all group kept).
Both restricted sheets show the create flow's note ("Only the events this
category can serve are shown"), and a coverage carrying keys the admin has since
disallowed gets a plain-words disclosure ("No longer offered for this category:
… — saving removes them") instead of a silent strip. Server behaviour unchanged.

Tests: 9 pure + call-site pins in `coverage-allowed-events.test.ts` (both pins
neutralisation-probed — reverting either surface's render fails a named test;
the first probe caught my own pin matching the note line instead of the chip
render, so the pin now targets `.map(` specifically). Fail-soft: a failed
taxonomy read renders the full vocab, never a false restriction.

SPEC IMPACT: None
