## 2026-11-14 · fix(admin): the Shops list names the shop contact and the owner account (AW-11)

Admin walkthrough AW-11: a shop's card showed one unlabelled email — the shop's CONTACT address — so a shop whose
contact is not its owner's sign-in (Liwanag: contact `testnayan2`, owner `testnayan4`) read as if the wrong account
ran it. The card now says **Shop contact · …** and, for a claimed shop, **Owner account · …** linked to the person
record. The owners are read in one batch; a refused read says "couldn't read it — not the same as none", never a
blank. Unclaimed shops label their contact the same way. No new look.

SPEC IMPACT: None.
