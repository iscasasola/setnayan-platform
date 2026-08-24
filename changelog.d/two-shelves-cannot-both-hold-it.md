## 2026-08-24 · fix(board): the own-day rule is derived, not enumerated — and a guard that compares two surfaces

Follow-up to #4804, which stopped the "Worth planning" shelf re-listing
celebrations that already exist. That fix is right about the duplication and
**over-drops**: its predicate was a hand-written list of kinds —
`kind === 'wedding' || kind === 'recurring'`.

**Measured, not argued.** A past evening that repeats yearly produces a
`recurring` moment on **next year's** date:

```
kind=recurring  date=2027-08-20  eventId=movie-night  "Movie Night"
```

2027-08-20 is not the event's own day (2026-08-20) — it is exactly the kind of
day the shelf exists to warn about. The kind-based rule deleted it, and on the
owner's real board the shelf went **empty**.

`isEventOwnDay` is now **stamped once by the builder** from the source row —
"does this moment land on the day the event already occupies?" — which is the
only question actually being asked. A moment kind added later is classified
correctly without anyone remembering to extend a list. #4804's own two tests
still pass unchanged.

### The guard the owner asked for

> *"No test asks whether a screen contradicts the screen beside it. If you can
> express any of these as a guard that compares two surfaces rather than checking
> one, that is worth more than the fix."*

`two-shelves-cannot-both-hold-it.test.ts` feeds **one** set of events to **both**
derivations — `splitEventBoard()` (the cards) and `buildYearMoments()` +
`worthPlanningMoments()` (the shelf) — and holds the invariant *between* them:
no celebration may have a card **and** re-list its own day.

🔑 It computes the collision **independently** of `momentIsEventOwnDay`, by
comparing each moment's date against the source event's date. *A guard that asks
the rule whether the rule is right agrees with it by construction, including when
the rule is wrong.* This one proves it: reverting to the shipped kind-based
predicate turns the floor test **red**.

It carries a FLOOR (derived days must survive, so the invariant cannot be met by
emptying the shelf) and a fixture-validity check (both surfaces really see the
same events).

4 tests; 3 mutations, each measured by occurrence count, each turning exactly the
right assertion red.

SPEC IMPACT: None.
