## 2026-11-13 · fix(guests): the per-guest supplier row greys out, never hides

Owner: "do not hide it. just grey it out until there is an available pax related booked supplier" · "same on guest card".
Show & sort always draws "Who each service counts"; with no supplier priced per head it shows one greyed, unpressable
row "Per-guest suppliers · Shows once a supplier is priced per guest". The guest card's "Not counted for" does the same
and posts nothing. A refused read says "Couldn't load your suppliers", never "none yet".
Guard: `apps/web/lib/the-pax-row-greys-never-hides.test.ts`.

SPEC IMPACT: None (follows the owner's 13 Nov instruction; DECISION_LOG row added in the specs repo).
