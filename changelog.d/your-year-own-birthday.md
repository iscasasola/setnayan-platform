## 2026-08-15 · fix(year): the recurring-occasions plan has something to show, and a door that stays open

Owner: *"we used to have a plan. for events that are upcoming for them. based on
their account. events that are celebrated always."* The plan shipped in July and
was silent. Two reasons, both measured against `origin/main` and the live prod DB
before anything was written.

**1 · IT COULD ONLY DERIVE FROM EVENTS, SO AN ACCOUNT WITH NONE HAD NO YEAR.**
Every moment `buildYearMoments` can produce is pushed inside its
`for (const e of events)` loop. Prod: 5 events, **every one** `recurs = false`,
**every one** `anchor_date = null` — so the strip's only possible line was a
wedding countdown, and "celebrated always" had nothing to stand on.

Meanwhile the profile has asked for a birthday since it was built — *"Optional —
so we can greet you on your day 🎂"* — and `/admin/studio`'s social queue already
reads `users.birth_date` to greet people. **The platform was using the date on the
person's behalf and never showing it back to them.** `buildSelfMoments` now folds
it into both the home strip and the Year page: one line, marked a milestone when
the age lands on the PH ladder (1 · 7 · 18F/21M · 60), `eventId: null` so it stays
a suggestion until they tap — the go-signal rule the rest of the module obeys.

🔒 **THIS IS THE ONLY BIRTHDATE IT READS, AND IT IS THE READER'S OWN.** Typed by
them, into their own profile, rendered on their own screens — the self-consented
Phase-1 slate of the Family Life-OS plan, explicitly un-gated. `dependents.birth_date`
(somebody else's, often a minor's) stays behind `dependentPeopleEnabled()` +
counsel, untouched. Not gated on `public_greeting_opt_in` either: that flag governs
greeting somebody PUBLICLY, and showing you your own date on your own home
publishes nothing.

**2 · 🚨 THE STRIP RETURNED `null` WHEN EMPTY — AND IT HELD THE ONLY DOOR.**
A repo-wide sweep for `dashboard/year` finds **one** in-app href, inside
`<YearMomentsList>`, which renders only when the strip renders. So `return null`
did not hide a strip; it made `/dashboard/year` unreachable by clicking, for three
real classes: a new account, an account whose events are all ones they were
**invited** to (the strip reads organiser rows only), and one whose events are all
archived. The page renders content for exactly those people — its own call takes
the `includeHolidays` default, so Christmas and Valentine's are sitting on it.

🔑 **A DOORWAY THAT ONLY OPENS WHEN THERE IS ALREADY SOMETHING BEHIND IT IS NOT A
DOORWAY.** The empty branch now renders a written invitation carrying both the
Year link and the profile link that fills it, and `Your year` joins the ⌘K palette
— the one door that depends on no data at all. It was the only account spoke
missing from that index.

⚖ **RENDERING WHEN EMPTY REVERSES NOTHING; HIDING DID.** `DECISION_LOG.md`
2026-07-15 ("make sure nothing is orphaned") is what re-linked this door in the
first place, and 2026-08-12 already ruled a zero shelf gets *"a written invitation,
not an empty heading"* on this same home. The three counter-signals found are
scoped to other surfaces and two self-declare they were never adopted.

**THE ORGANISER FILTER IS KEPT, DELIBERATELY.** Every label the builder produces is
first-person — *"Your 3rd wedding anniversary"* — and saying that to someone who
was a guest is worse than saying nothing. The invited-only person is served by the
own-birthday moment, which needs no event, plus the empty branch's door. Widening
means rewriting labels per membership first: a product change, not a query change.

🛡 **6 door assertions, all mutation-proved with occurrence counts printed
before → after** (`lib/year-view-has-a-door.test.ts`): each sabotage landed AND
turned the guard red, baseline green after restore. They match the ACT — a rendered
href to this route — never a symbol name, so renaming `EmptyYear` cannot satisfy
them and deleting the JSX cannot survive them. 14 new derivation tests; 80 tests
green under **UTC · Asia/Manila · America/New_York · Pacific/Kiritimati**, because
this is date math and CI runs in the one zone where date bugs cancel out.

⏭ **FOUND, NOT BUILT — named so it is a decision, not an oversight:** `events.recurs`
has **no UPDATE path anywhere**. All three writers are INSERTs (create-event action,
onboarding insert, the recurrence clone), so an event that already exists can never
be marked "comes back every year" — including all 5 in prod. It has no obvious home
(there is no `[eventId]/settings` route), so choosing one is a design call on a
surface the redesign sessions own, and bundling an unverified new screen into a
verified change is how this repo's own history says defects ship.

SPEC IMPACT: `DECISION_LOG.md` — new row 2026-08-15 recording that the account's own
birthday joins the Year view un-gated (self-consented, Phase 1), that the Year view
must keep two independent doors, and that `events.recurs` is create-time-only.
