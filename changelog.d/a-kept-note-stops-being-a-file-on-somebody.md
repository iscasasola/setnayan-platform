## 2026-08-25 · fix(vendors): the supplier keeps the note, it stops being a file on a person

Owner, 2026-08-24: **the supplier keeps the note, but it stops being filed under
that person's name. They keep their working history.**

`vendor_client_notes` is the supplier's own CRM — up to 2,000 characters a row,
readable by nobody else including Setnayan. It is unambiguously their business
record, so *"vendor data stays"* reaches it. But its **subject** is the couple,
who have just asked to be forgotten. The classification calls this the trap in the
other direction; the ruling threads it.

🔑 **Severing the event link is exactly that distinction, not a compromise.** The
note carries no name, no contact and no user id of its own — the only thing that
made it *this person's file* is the celebration it hangs off. Cut that and what
remains is what the supplier wrote, addressable only as their own history.

⚠ **A follow-up reminder does not survive.** *"Chase the down-payment on the
15th"* is a file on a named person that acts on its own schedule, and there is
nobody to chase. It is cleared at severance; the words are untouched.

### The half that would have made the keeping a fiction

The only reader is the per-event Customer Card, which filters on the event — so
severing **alone** would preserve every note and show none of them. That is the
**"gate with no handle"**, which this repo has now found five times.

So the same change adds **Kept notes** to the Clients hub. It renders only when
the read actually succeeded: a refused read must not be drawn as *"you wrote
none"*, which is the false-empty this codebase keeps paying for.

🪤 **My own reader guard was partly decoration and the mutation caught it** — a
bare match for the list survived the whole block being put behind `{false ? (`.
It is now anchored from the condition to the map in one match, and the sabotage
turns it red.

Migration `20271165307041`. 5 db tests + 3 reader tests; 4 mutations, each
measured by occurrence count. Prod dry-run rolled back: note kept, unfiled,
reminder cleared, nothing still answering to that celebration. Full db suite
1552/1552. Prod holds **0 notes**, so nothing is migrated.

SPEC IMPACT: `DECISION_LOG.md` — owner ruling 2026-08-24.
