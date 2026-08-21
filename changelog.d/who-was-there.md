## 2026-08-21 · feat(story): who was there — the ninong, the ninang, the abay

**Owner approved 2026-08-20 after it was flagged as his ruling to make:**
publishing a guest's name on a public page is a disclosure nobody makes by being
on a guest list, and the 2026-08-17 face-blur ruling covers faces in
photographs, not names on a page.

**Why it is the strongest idea in the design.** Research measured the same hole
across the whole field — **every competitor's couple page names exactly two
people.** The judge reading as a Filipina bride: *"a Filipino wedding is ninong
and ninang, the abay, the entourage, the tita who carried the flowers. The
people she is sending the link to are looking for themselves, and they are not
there."*

### 🔑 RULE 0: none of this data is new

`event_sponsors` has shipped since **2026-06-04** with the Filipino structure
already correct — principal sponsors pair-grouped by `pair_index`, and the four
secondary tiers (cord · veil · coin · candle) each an independent slot, because
one half of a pair may accept while the other declines. Nothing was invented and
nothing new is asked of anybody.

### 🔒 The consent gate is the whole feature

**Only `invitation_status = 'accepted'` is published.** That is not a proxy:
accepting is an affirmative act by that person, stamped with `responded_at`, in
answer to an invitation that named the role.

- **`invited` is a QUESTION, not a yes.** Publishing it answers it for them.
- **`declined` must never appear.** Naming somebody as a ninong after they said
  no is worse than not naming them at all.
- **`pending` is nothing at all.**

⚖ **Withheld even for somebody who accepted:** their `email`, their `phone`,
their `relationship_note` ("Tito Mike, mom's brother"), and any `decline_note`.
The band shows a name and a role — what an invitation card shows.

⚠ **ORDINARY GUESTS ARE NOT ON IT.** `guests` rows are people the couple typed
into a list; none of them agreed to be named in public. The band never reads
that table.

🪤 **AND THE "+ 42 GUESTS" COUNT FROM THE DRAWING IS DROPPED.** A count names
nobody and looked harmless — but it can only be measured from `guests`, and a
failed read of that table is indistinguishable from a wedding of nine people. **A
number nobody can trust does not belong beside names that are true.**

**An empty list renders nothing at all** — a heading over no names announces an
entourage that either does not exist or did not consent, and both are worse than
silence.

**Verification.** 6 source guards · **977 app + lib tests** · typecheck clean ·
lints clean. **4 mutations, each landing verified by occurrence count, all 4
RED**: the consent gate removed (1→0) · `invited` treated as a yes (2→2, red
proves it landed) · contact details added to the public select (1→2) · a refused
read degrading silently (1→0).

🪤 **A STASH POP APPLIED ONE OF FOUR EDITS AND LOOKED FINE.** Moving this work
onto the branch it depends on carried the component across and silently dropped
the import, the loader call and the stylesheet. Caught by checking each piece by
name rather than trusting the pop — the same discipline as verifying a sabotage
landed.

⏭ **Still open on this page:** the desktop rail, and the owner's own view (the
"this celebration is over — write it?" invitation, which already ships on My
Events).

SPEC IMPACT: `DECISION_LOG.md` — a person's public page may name the entourage,
and only those who ACCEPTED the role; contact details and ordinary guests never.
