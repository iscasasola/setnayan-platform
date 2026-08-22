## 2026-08-21 · feat(studio): decide which celebrations a service may be added to

Owner ruling: *"they get to pick which event (but only show events that is
compatible to this) and the event should be on the ongoing and upcoming only."*

`lib/events-for-studio-app.ts` — the decision layer behind the coming
**"Add to an event"** picker. Pure; the caller resolves rows and profiles.

**Three gates, and two of the three predicates already existed.** Nothing was
re-derived:

1. **Yours to change** — `eventStance(member_type) === 'organiser'`. Being
   invited to a wedding is not permission to bolt a paid service onto it. Fails
   CLOSED for anything that is neither `couple` nor `guest`, because a
   coordinator's access comes from `event_moderators`, not `member_type`.
2. **Ongoing and upcoming only** — `isFinishedEvent` from `lib/event-board`, the
   **same predicate the events board splits its two shelves on**. "When did this
   end" must have one answer in the product, not two. It already handles what is
   easy to get wrong: a celebration is not finished ON its own day, a multi-day
   one runs to `event_end_date`, an archived one is finished whatever its date
   says, and the boundary is a **Manila calendar day**, not an instant.
3. **Compatible** — `surfaceEnabled(profile, surface)`, the same predicate the
   rail drops rows with and the couple's Studio hub filters on.

🔑 **A DATELESS CELEBRATION IS OFFERED, ON PURPOSE.** You should be able to add
Papic to the birthday whose day you have not picked yet. Do not "fix" this by
requiring a date.

🔑 **THIS FAILS CLOSED WHERE THE RAIL FAILS OPEN, DELIBERATELY.**
`railToolsSignedIn()` keeps a row when the profile is unknown because showing a
row costs nothing. A picker is the opposite: offering an event we cannot confirm
hands somebody a destination that may `redirect()` away with no message — the
exact harm the rail's own comment describes for a birthday organiser pressing
"Logo Maker".

🔑 **AND THAT IS WHY IT RETURNS REASONS, NOT A BARE LIST.** If every profile
failed to load, an array would come back empty and read as *"you have no
events"* — the silently-empty-drawer failure this codebase has shipped before
(`count === null` means NOT MEASURED, never zero). `emptyPickerReason()` gives
four different sentences for four different situations, and a test asserts all
four differ.

🧪 14 unit tests covering every gate and the cases where the obvious
implementation is wrong. **The logic was additionally executed** branch-for-branch
outside the toolchain (this checkout has no `node_modules`): 12 checks, 0
failures. That validates the LOGIC, not the module — the real suite is CI's.

⏭ **NOT BUILT YET, and named rather than implied:** the "Add to an event" button
and the picker UI itself. This is the decision layer they will call.

Not verified locally: no `node_modules`, and `npm run build` cannot complete on
this machine.

SPEC IMPACT: recorded in the corpus `DECISION_LOG.md` (2026-08-21).
