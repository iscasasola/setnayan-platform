## 2026-10-07 · fix(event-hub): the cover loses its frame and wears the Global Background — for every couple

Owner 2026-10-06, DECISION_LOG "THE COVER LOSES ITS FRAME, WEARS THE GLOBAL BACKGROUND": *"cover has this frame that we can remove. the background of cover is the global background?"* — and 2026-10-07, asked flagged or not: *"for everyone"*.

- `app/[slug]/_components/pahina-masthead.tsx` (The Card): the paper card (`bg-cream`, shadow) and the gold hairline box are gone; the names, mark, date and time sit directly on the Event Hub's main background, in the page's own inks over the ground's measured AA scrim (`MainGround` / `mainGroundLegibility`) — the same rule every other part already reads. Same parts, same spacing, same tap-to-edit marks; `data-cover-frameless` marks it.
- Guard `the-invitation-is-a-card.test.ts` now holds the new rule (no paper, no hairline, no shadow on the card branch).
- Darker ↔ Lighter is not here (Builder S4c).

SPEC IMPACT: None — implements the 2026-10-06 DECISION_LOG row; the owner's "for everyone" (no flag) is recorded in this fragment and the PR.
