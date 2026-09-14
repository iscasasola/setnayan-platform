## 2026-09-14 · feat(shop): a couple picks WHICH celebration a shop is for

D1. The shop page never asked. It took `events[0]` and scoped everything to it —
the existing-thread lookup, the inquiry composer, and the inquiry that eventually
puts the shop on somebody's list:

    app/v/[slug]/page.tsx            coupleEventId = events[0]?.event_id
    app/v/[slug]/inquiry-actions.ts  : (events[0]?.event_id ?? null)

⚠ CORRECTION, recorded rather than quietly fixed: the first draft of this change
claimed `events[0]` was "whatever Postgres returned first — arbitrary per
request". That is WRONG. `fetchUserEvents` puts no `.order()` on the query but
SORTS THE ROWS IN JS before returning — `is_primary` first, then soonest
`event_date`, dateless last. So `events[0]` means "your primary celebration,
otherwise the soonest one": a real rule, just an invisible one the couple never
chose and is never shown. The claim was checked only after a peer session asked
"is it wrong, or is it non-deterministic?" — the query builder had been read, the
twenty lines below it had not.

🔑 IT IS GENUINELY UNDECIDED ONLY AMONG TIES. The comparator returns 0 for a tie
and `Array.prototype.sort` is stable, so tied rows keep the unordered query's
order. Nothing enforces a single primary — an account holding TWO events flagged
`is_primary = true` was measured on 2026-09-08 — and two celebrations sharing a
date, or both dateless, tie the same way.

Either way the couple is not asked. Someone planning a wedding AND their parents'
anniversary asked a caterer a question and could not tell, and was not told,
which celebration it attached to.

- The page honours `?event=` when the id is one the viewer actually organises,
  checked against the membership list it had already read.
- The picker is the SHIPPED one (`app/_components/marketing/add-to-event*`,
  owner-ruled 2026-08-21) — its drawer, search, empty sentences and create row.
  Only the data shape is new.
- ⚠ THE FILTERING RULE IS REUSED UNTOUCHED. `eventsForStudioApp` takes a
  `ServiceGate` and its own docblock says a service with no `surface` is
  universal and skips the compatibility gate. A shop IS universal, so it passes a
  surfaceless gate and gets gates 1 and 2 exactly as shipped: "yours to change"
  and "ongoing and upcoming only".
- Nothing is written. Each row is a link carrying `?event=`, so choosing is
  navigation: no new table, no new server action.

🔑 THE FALLBACK STAYS. A couple with exactly one celebration is never made to
choose and keeps today's behaviour byte for byte.

### And nobody is marched into a wedding any more

Both `no_event` branches in `inquiry-composer.tsx` hard-coded
`/onboarding/wedding`, so a person asking a caterer about their mother's 60th
birthday was sent to plan a WEDDING. The sibling composer on the same page fixed
exactly this on 2026-08-06 and says so in its own docblock.

They now go to `/dashboard/create-event?next=…` — the event-type picker, which is
the screen whose whole job is that question, and which owns the three-branch rule
for what each type's onboarding actually is. No second question UI was added to a
component that already has a modal flow, and no `/onboarding/${key}` was
re-derived: that fourth-branch-less shortcut 404s for every type whenever the
generic-experience flag is off.


### One coverage change, stated rather than left to be noticed

`lint-port-no-lost-controls` caught the removal, as it should, and the
regenerated baseline carries it as exactly one readable line:

    - "/onboarding/wedding?next=[seg]"

⚠ The REPLACEMENT is not tracked in its place. The old path was an inline
`window.location.href = ` + a literal, which the static extractor can see; the
new one is built inside `noEventDestination()`, which it cannot. So that route's
destination list now watches this navigation not at all, where it used to watch
the wrong one.

It is not uncovered — `the-shop-asks-which-celebration.test.ts` asserts both
`no_event` branches navigate and that the destination is the picker page, and
that guard is mutation-proved. But the MECHANISM watching it changed, and a
baseline line silently vanishing is the kind of erosion this repo counts, so it
is written here rather than left for whoever next reads the diff.


NOT DONE HERE, deliberately: `fetchUserEvents` is read by ~20 surfaces including
the dashboard event switcher. Giving its query a deterministic ORDER BY, or
enforcing one primary per user, would change what those surfaces show and belongs
in its own row with its own blast radius — not inside a shop-page change.

SPEC IMPACT: None — the picker and its rule are the recorded 2026-08-21 ruling.
