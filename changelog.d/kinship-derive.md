## 2026-07-31 · feat(kin): extended kin derived from the seven stored relations — including courtesy tito/tita

`person_connections` stores first-degree family only; its own table comment says so — *"Family first-degree only; extended kin derived."* Nothing did the deriving. This is that calculator, and it closes a real gap: the shipped preview copy already describes behaviour the code did not have.

### The owner's rule, and why it isn't a generic family tree

Asked how someone becomes a tita, the owner gave two paths:

> *"they will only become an aunt if they are the brothers/sisters of their parents… and if they are parents of their friends. these are aunts as well"*

And then, on whether to bound it: *"yes tita can be most."* And that it is **tito and tita** both, gendered by the person.

So a tito/tita arises **two ways** — **blood** (sibling of a parent) and **courtesy** (parent of a friend). That is the Philippine courtesy-kinship model, and no generic family-tree design accounts for it. Two consequences shape the module:

**The friend layer feeds the family labels.** A courtesy tito/tita only exists because a friend edge exists. Remove friends and half the kinship silently disappears — which is why this reversed the spec's original "friends never on the tree" line.

**Every derived relation carries a `basis`.** "My mother's sister" and "my mother's best friend" are both Tita and are **not the same fact**. The word is identical; the provenance is not, and the UI has to be able to tell them apart. When someone is reachable both ways, blood wins — your friend's mother who is genuinely your aunt is your aunt.

**Unbounded is correct.** No closeness filter, no hop cap. Volume is true to life; managing it is the renderer's problem, and a test pins that five friends produce ten titos and titas without complaint.

### Only confirmed edges derive

A `draft` is private to its author; a `pending` claim is unanswered. Neither is an established fact, so neither produces kinship. Deriving from pending would let one person unilaterally populate another's tree — the same class of problem the forgery fix closed at the database level, and it would have walked straight around it.

### Direction

`relation` = **what `to_person` IS to `from_person`** (per the creating migration). Getting that backwards silently inverts every generation — your grandparents become your grandchildren. A test pins it in both directions.

### Gender, and OD6's real boundary

Labels are gendered where sex is known and **paired otherwise** ("Lolo/Lola", "Tito/Tita") — never guessed. Sex lives on `users` (with its own consent stamp) and `dependents`, **not** on `people`, and `people` can hold someone with no account. So a tree legitimately shows a **mix** of gendered and paired labels. A test asserts that mix, because it should read as deliberate rather than broken.

Also derives: lolo/lola, apo, pinsan, pamangkin, bayaw/hipag, balae, and surfaces ninong/ninang from the stored ritual layer rather than inventing them.

### Safe to ship now

Pure — no I/O, no database, no clock. **Zero edges derive zero kin**, asserted directly. That inertness is what makes it safe while the PH counsel gate is still closed; `NEXT_PUBLIC_PEOPLE_CONNECTIONS` stays off and nothing here touches it.

Nineteen tests, weighted toward the cases that would silently produce wrong kinship rather than an error.

SPEC IMPACT: None — pure module, no schema, no RLS, no flag. The decisions it implements are already recorded in `DECISION_LOG.md` (OD5, OD6, OD7, and the 2026-07-31 courtesy-kin ruling).
