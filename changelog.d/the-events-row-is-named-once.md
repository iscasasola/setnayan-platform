## 2026-09-23 · fix(rail): the events row is called "Events" on every surface, and wears the events icon

Owner, on the signed-in rail: *"it should only always say Events regardless
where you are"* · *"icon does not need to show a back button, keep the events
icons"* · *"keep it consistently like this"*, pointing at the in-app rendering
(`LayoutGrid` + "Events"). And, on the event group's name row: *"on top of
this, show the logo/monogram of the event"*.

**ONE DOOR WAS WEARING THREE NAMES AND TWO DRAWINGS**, depending on where you
met it — all three correct in their own file, none of them agreeing:

- `/` and any signed-out-shell surface → **"Back to your events"** behind an
  `ArrowLeft` (`front-door-shell.tsx`, the §3.6 seam wording);
- inside an event, where the rail collapses to the section → **"Back to
  events"** behind an `ArrowLeft` (`[eventId]/layout.tsx`'s `focus` row, added
  2026-09-21);
- everywhere else in the app → **"Events"** behind `LayoutGrid`.

All three now render the third one. The label goes through the nav registry
(`customer.account.events`), so an admin rename still moves it.

🔑 **THE HALF-FIX WAS THE REAL RISK HERE.** The public row and the focus row
live in different files and neither one's guard could see the other, so fixing
the shell alone would have left the rule *false at exactly the width the owner
was looking at* — and looked done. `seam-invariants.test.ts` now reads BOTH
files in one test.

Also:

- `RailFocus` gains an optional `icon`. The other three focus rows ("My Home",
  from HQ · the shop · an account spoke) keep the arrow deliberately: those say
  what pressing them DOES, this one says where it GOES.
- The event's monogram now renders above its name in the rail, through the
  shipped `EventMonogram` — uploaded SVG → bespoke SVG → designed lockup →
  lettered badge, no fourth answer invented here. It goes through
  `resolveEventMonogramSvg` (the SEC-3 read-time gate), never the raw column.
- The mark is its OWN element, not a child of `.fd-rctx`: that class is prose
  and is hidden on the 72px icon strip, which would have deleted the mark at
  the one width where it is the only thing naming the event you are in. A guard
  asserts no rule may hide it.
- `front-door-invariants.test.ts`'s "fallback equals the registry label" check
  went from one row to a table of all three registry-named rows — the events
  row had been shipping the very defect that guard was written for, in the
  other direction ("Your events" vs "Events"), unseen because the guard was
  aimed at the marketplace row only. It now strips comments before matching,
  because the alaala slot's `label:` sits past any fixed character window
  behind its own rename history.

SPEC IMPACT: `FRONT_DOOR_AND_SEAM_FINAL` §3.6 is REVERSED — the front door's
return row is no longer a sentence ("Back to your events") but the board's
name. The old reasoning is left readable in the code so nobody re-applies it
from the spec. Corpus edit pending owner sign-off, flagged in the PR body.
