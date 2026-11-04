## 2026-11-04 · fix(card-maker): Return never creates the card · "Something else" is the live taxonomy · no blank screen on iPhone · More settings lines up, pins and shows itself

Owner, iPhone, live card maker (2026-11-04).

- **Return never submits the card** ("after i placed the price, it finished"). The browser's implicit submission
  created a half-filled card when he pressed Return after the price. The card form now stops Return in any one-line
  input and moves to the next reachable field (blurs on the last); textareas keep new lines; every one-line field's
  phone key reads "next". Create / Save is the only way to save. `lib/return-moves-on.ts`.
- **"What you offer → Something else" is the live taxonomy** ("why is it that i only see these categories when we have
  a whole spectrum"). The folds came from the hard-coded `SERVICE_GROUPS` (~46 kinds); they are now one fold per live
  top-level group from Admin › Categories, every live trade with the same plan standing the save enforces. A kind a shop
  already has a card under that is no longer live stays listed ("Your other cards"); Miscellaneous stays reachable (the
  miss line names it). The search band no longer empties itself against the now-complete folds; a fold hides what the
  band already shows. `lib/service-card-kind-groups.ts`.
- **No blank screen when a menu or fold opens** ("i keep going to this blank slate"). ONE OPEN AT A TIME shut the open
  fold above the tapped control; Safari has no scroll anchoring, so the page jumped onto the white past the form and the
  Schedule menu floated where its button had been. The shared mechanism now keeps the tapped element in place
  (`lib/keep-the-tap-in-place.ts`, called from `lib/one-open.ts`), and tells an open PickMenu to re-place (a resize
  event — PickMenu itself is untouched; it must stay under its inlined-size budget).
- **More settings: no gap, no covered row.** A nested fold head pinned through its parent's clipping body and stuck
  40 px (+ the top bar) down inside its own fold. A head now never pins through a clip; More settings stops clipping
  once open, so its groups pin as slim lines UNDER it (the 2026-10-29 rule) — `app/_components/fold.tsx` (small).
- **More settings lines up**: every mark at one column, every name at one column, what a group opens onto starts on the
  name column.
- **More settings shows itself on first open** ("we want to scroll so the see all animating then return back to the
  first one which is price") — down to the last group, back to Price · more; once per visit; any touch stops it; none
  under reduce motion. `lib/reveal-sweep.ts`.

SPEC IMPACT: None — implements existing rulings (2026-10-26 "the taxonomy has one source", 2026-10-29 pin rule,
2026-10-04 one open at a time). `SERVICE_GROUPS` still feeds other screens (listed in the PR as the next to move).
