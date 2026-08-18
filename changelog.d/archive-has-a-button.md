## 2026-08-16 · feat(events): a celebration can finally be put away — and the guard that should have caught this was blind

Owner asked *"what do we need for this archive?"* then *"build it"*. Answer: almost nothing
underneath — **a button.**

🔴 **THE SIXTH GATE WITH NO HANDLE, AND THE LONGEST-LIVED.** `events.archived` shipped with
the FIRST migration. A dozen screens already behave correctly when it is true: the
one-wedding-at-a-time rule releases, the event leaves the switcher, it moves to the Finished
shelf, the anniversary reminder stops. Verified against prod rather than read from a
migration: `authenticated` holds UPDATE on the column and `couple_can_update_event` admits an
organiser. **Nothing in the app has ever written it.** In two years, zero events put away —
because none could be.

🔑 **THE TELL WAS NOT SILENCE — IT WAS FIVE SCREENS TELLING PEOPLE TO USE IT.** "Finish or
archive it first" is what a couple was told when they tried to plan a second wedding, and the
admin console's delete warning recommended *"archiving instead if you might restore later"*.
Every one of those sentences named a control that did not exist. **The owner is personally
behind that instruction** — he holds two upcoming weddings, so a third is refused with
nothing to press.

⚠ **AND IT LOOKED HALF-BUILT, WHICH IS WORSE THAN LOOKING ABSENT.** Anyone checking "does
archive exist?" finds a column, readers, an admin filter and an `?archived=1` param, and
concludes yes.

### What shipped
- **"Put this away"** on the event's Personalization page, with **"Bring it back"** in the
  same commit. 🔑 A forward primitive with no inverse is a defect this codebase has already
  paid for (the auto-block with nothing to reopen it, 2026-08-09). Put-away is reversible by
  definition, so the inverse is not promised for later.
- Called **"Put this away"**, not "Archive": next to a real Delete button, two cold words are
  how somebody destroys a wedding they meant to tidy. The card states the two things people
  actually fear — the guests' page keeps working, nothing is deleted.
- 🔒 **Owner ruling 2026-08-15: the guest page stays up exactly as it was.** Put-away is a
  tidy-up for the couple's list, NOT a privacy control — a four-option privacy setting already
  ships for that, and three of five prod events already sit on private. **Do not fold "the
  wedding is off" into this.**
- All five "archive it first" messages now name the real control and point at the page that
  has it. The admin delete warning stops recommending something that never existed.
- Confirm on the way out, none on the way back: **an undo behind a dialog is an undo people
  do not trust.**

### 🚨 The guard built to catch this could not have caught this
`gates-have-handles.test.ts` exists precisely to find columns with no writer. **Measured: with
both new writer files deleted, it still passed 9/9.** Two independent blind spots, one in each
direction:

1. **TABLE-BLIND.** `archived` exists on `events` AND `communities`, and `samahan/actions.ts`
   genuinely writes `communities.archived`. The register accepted that as proof for
   `events.archived`. Entries now declare their table (`is_founder` turns out to be on
   `vendor_profiles` — it had been passing by accident, not by aim).
2. **SHORTHAND-BLIND.** The pattern required `column:` with a colon, so `{ archived,
   updated_at }` — the ordinary way to pass a variable of the same name — read as *no writer*.
   A correct writer would have been reported missing.

**Both failure directions were live in the same check**: it accepted a write that wasn't
there, and would have rejected one that was. Now anchored on
`.from('<table>') … .update({ … column … })`, and mutation-proved: **removing the new writer
turns it RED** (it did not before).

🔬 Mutations, restored 9/9 green each: writer file deleted → red on `archived` · the only
`.update({ archived })` gutted → red. Neighbouring suites green.

⏭ **Named, not built:** put-away does not yet stop new photos or the photo wall (owner has
not ruled), and the supplier completed-event counts are materialized views refreshed by hand,
so a put-away event's effect on a supplier's public numbers moves only when an operator
presses refresh. **Recommended and not yet decided: a put-away event should still count on a
supplier's public record** — a customer tidying their own list must not shrink somebody else's
history.

SPEC IMPACT: None — no migration, no column, no permission change. The switch already existed.

## 2026-08-18 · fix(dashboard): the put-away write runs on the admin client

Found by an adversarial review pass before merge, then confirmed against the
live database by the object — not read from a migration.

**A co-host could never put an event away, and was told they were not a host.**
`setEventArchived` copied the house host CHECK (`event_members` couple OR
coordinator, plus an accepted `event_moderators` row) but not the house WRITE.
The update ran on the request-scoped client, and the only permissive UPDATE
policy on `public.events` is `couple_can_update_event`, whose
`current_couple_event_ids()` is `member_type = 'couple'` ONLY. So for every
co-host the statement was RLS-filtered to zero rows **with no error**, fell into
the zero-row branch, and answered *"Only a host of this celebration can put it
away"* — immediately after the same function had decided they were one.

`/host/accept/[token]` is the sole writer of `member_type: 'coordinator'`, and
`details/page.tsx` renders the card to them unconditionally, so this was every
co-host in the product on their first visit. "Bring it back" failed identically,
so a co-host could not undo the couple's put-away either.

The write now uses `createAdminClient()`, matching `setEventCeremonyType` /
`updateEventMatchCriteria` / `updateVenueSetting`, whose own comment states that
the explicit host check *is* the authorization. The zero-row branch now returns
`not_found` — with no RLS to filter it, zero rows can only mean the id does not
exist, and keeping the old string would have re-created the same lie for a
genuinely bad id.

🔑 **RLS IS A FLOOR, NOT A SCOPE — and here it was NARROWER than the product
rule.** The original docblock read the policy and caught its `is_admin()`
disjunct being too WIDE, while missing that the other disjunct was too narrow.
That is the direction that is easy to miss.

Guarded by a new case in `lib/gates-have-handles.test.ts` asserting the rule
(the update is rooted at `createAdminClient(`, never at the request-scoped
client, and the zero-row branch claims no permission problem). Three mutations,
each measured by occurrence count, all red.

🪤 **The first cut of that guard's third assertion was decorative and the
mutation run proved it** — the sabotage landed (`not_found` 3 → 2) and the suite
stayed GREEN, because the explanatory comment sitting between its two anchors is
longer than its 200-character match window. A guard whose reach is a character
budget silently shrinks every time somebody documents the code. Re-sliced by
brace so the branch is bounded by what it is.

SPEC IMPACT: None.
