## 2026-08-25 · fix(dashboard): the door desk says why the list is empty — and four doors stop bypassing the closure

Second wave of fixes from the adversarial audit of the same day's merged work.

**The confirmed defect.** On the wedding day the coordinator standing at the
door opens the **check-in desk**. She was granted the seat plan and nothing
else, so her guest read now comes back refused — 200, zero rows, no error. The
desk opened in full anyway: *"Scan a guest's QR … the headcount keeps itself"*,
an expected count of **0**, an empty board, and every QR she scanned answered
*"That guest is not on this event's list"* — **blaming the guest standing in
front of her.** Same on the souvenir table linked from the same header. Both now
say the couple haven't shared the guest list.

🚨 **AND FOUR DOORS WERE BYPASSING THE CLOSURE ENTIRELY.** They read guest names
through the **service-role client**, which does not consult RLS at all — so
yesterday's rule could not reach them, and the dashboard layout admits every
accepted delegate. The layout's own comment says the per-area question is left
to "the moderator RLS policies": true for a page that reads through the
caller's session, **false for one that reads around it**.

- **Alaala** resolved a guest's name as the byline on every story. It had *no
  authorization of its own at all* — no user, no membership, no gate.
- **Guest columns** did the same for every column author.
- **Story assignments** had no authorization either, and its picker *is* the
  guest list by name.
- The **live** page's only guest read is a count of who asked for their face to
  be blurred — a number the person running the day needs, and never a name. Left
  alone, with the reason written down.

Alaala and Guest columns are gated **at the read, not at the page**: the stories
and the queue still render for a refused viewer, unattributed. Blanking a
working screen to hide one field would be the wrong trade.

🛡 **The guard is rewritten because the old one was decoration — and it was
mine.** It carried the docblock *"DERIVED FROM THE COMPONENT, NOT FROM A LIST I
TYPED… a hand-enumerated list is a list of the screens somebody thought of"*
directly above a hand-typed list of two. **That contradiction is the mechanism
by which both desks shipped ungated.** It now derives its subject list from the
tree (26 pages), recognises both gate shapes, floors the sweep, and carries the
rest as a **bill with a written reason per line, checked in both directions** so
a page that gains a gate must come off it.

🪤 **The new guard was itself decoration on its first two revisions, and only
counting caught it.** Rev 1 searched an 800-character window before each guest
read for the deciding boolean — deleting that boolean from the `if` and leaving
its declaration standing passed **all green (1 → 0 occurrences)**. Rev 2 walked
to the nearest `{`, which on `const { data: guests } = await admin…` is the
**destructuring brace**, so it read the wrong header and rejected a correctly
gated page. Rev 3 walks brace depth. All five sabotages are red now; the two on
the false-positive side (a gated page left on the bill, a blinded sweep) are red
too.

Unit suite 9917/9917.

SPEC IMPACT: None.
