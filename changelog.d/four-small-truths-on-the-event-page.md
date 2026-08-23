## 2026-08-23 · fix(event): six small untruths on the page a couple lives in

All six were measured in the event-dashboard study and re-verified against `origin/main` before
anything was changed. The owner has seen the before/after for this work and said "look good".

- **D-3 · "Hair & makeup" arrived as "Hair & mak…".** The Schedule tile sits two-up on a phone, and
  with the date pill at its fixed width there is room for about eleven characters — on the tile
  whose entire job is telling the couple what is next. The name now wraps to two lines before it
  ellipsises, and the date pill sits with the first line rather than centring against two.
- **D-4 · four filled actions shouting at once, in the decorative colour.** The top-priority CTA
  was filled, and so was the FIRST row of every decision group — so a couple with three open groups
  met four identical "most important" buttons. There is now exactly one filled action on the page,
  and it wears the action colour: gold is the atelier's decorative slot, and the CTA terracotta
  lives in the token confusingly named `mulberry` (#C24E25, white on it measures 4.76:1). ⚠ This
  was gated on whether solid gold was a deliberate premium signature — the decision log was checked
  and there is no such rule; the only premium signature on record is the six monogram effects, which
  say nothing about buttons.
- **D-5 · a chip that repeated its own heading.** The group heading said "Pick an option", the row
  said "Pick your caterer", the sub-line said "3 options saved · none locked yet" — and the chip
  said "pick one". A "pick" row now carries no chip; the other two kinds keep theirs, because "not
  booked yet" and "awaiting confirmations" each say something the row does not. All three places
  that render a chip (the digest, the board, the inspector the row opens) handle its absence, so a
  null never renders an empty pill.
- **D-6 · the same number twice on one card.** "3 of 5 categories locked" is the gold bar's figure
  in another costume, and the briefing sentence beside it opens with the same number in words. The
  chips that remain each say something nothing else on the card says: how long is left, and what is
  most urgent.
- **D-8 · prose set in a monospace face.** The focal's sub-line is a venue name or "The date is
  locked"; Space Mono makes a sentence read like a serial number. Every mono line left on that card
  carries a figure.
- **D-2 · the greeting stranded "today." on a line of its own** — a one-word third line under a
  two-line sentence, as the first thing on the page. The hero now balances its lines, and the soft
  tail never breaks inside itself.

⚠ **And the one unsettled observation is settled, in the source rather than left ambiguous.** A
review reported the greeting's tail rendering terracotta while the source said ink. Measured: the
rule has only ever set `--sn-ink-400` (#8A857B — 3.67:1 on white, clearing the 3:1 large-text bar
at 36px/700). The warm thing directly above it is the gold eyebrow, which is what a screenshot most
likely showed. Written into the rule so nobody "restores" a terracotta that was never there.

10 sabotages, every one measured by occurrence count before → after, all red. One did not land on
the first attempt (0 → 0) and was re-run against a pattern that could actually match — a green from
a sabotage that missed proves nothing.

SPEC IMPACT: None. Presentation only; no migration, no schema, no price or SKU change.
