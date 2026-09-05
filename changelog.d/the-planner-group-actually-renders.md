## 2026-09-06 · fix(frontdoor): the rail renders what it is handed

The six free doorway rows shipped on 2026-09-05/06 — Marketplace, Guest list,
Seat plan, Budget, Schedule and Samahan — rendered in **no rail group at all**
for a signed-out visitor in production. Found by opening the live site.

Every list function was right and every caller was right; the shell threw the
rows away. Its render conditions still read `account.signedIn && insideEvent &&
plannerTools.length > 0` and `account.signedIn && togetherTools.length > 0` —
correct when the only rows in those slots were the in-event ones, and exactly
backwards for doorway rows, which are built for the opposite state
(`plannerDoorwayRows` returns `[]` *inside* an event, `togetherDoorwayRows`
returns `[]` when *signed in*). The two decisions cancelled to nothing. Two of
those rows had been visible in Studio the day before, so the change was a net
loss for a stranger, not a neutral one.

- `app/_components/frontdoor/front-door-shell.tsx` — the three group gates
  (Planner, Builder, Together) now ask one question: are there rows. The caller
  decides which rows exist; an empty list is how it says "not here".
- `app/_components/frontdoor/the-rail-renders-what-it-is-handed.test.ts` — new
  guard. Fails if any group gate grows a second condition, paired with a
  behavioural half asserting the doorway lists really are non-empty in the
  state that was broken (and still empty in the states that would double a row).
  Mutation-checked: re-adding `account.signedIn` turns it red.

Why nothing caught it: a group that renders nothing is indistinguishable from a
group with nothing to render. The unit tests passed, the typechecker was happy,
and the only signal was a person looking at the page.

SPEC IMPACT: None. No product decision changes — this restores the rail
behaviour the 2026-09-06 by-kind split already specified.
