## 2026-10-19 · fix(guest-me): Me reads the guest's gender — one role word, one column, one arrive-by

Owner, on cale-ice's Invitation › Me for the groom's "Atty. (Woman)" mother: *"shouldn't it identify that she is the
female mother of the groom"* · *"not both gender to show?"*. Three faults on one page, one cause each:

- **Your role** read "Parent of the Groom": `kinWordOfReader` never received `guests.gender` (the guest read did not
  select it, and the name parts handed to the dress code dropped it). Now `gender` is read, `guestNamePartsOf` is the
  one builder of the reader's name parts, and its key is REQUIRED in `kinWordOfReader` / `readerAttire`, so a caller
  that forgets cannot compile. The Welcome's "You're joining us as …" and Event details' "Your role" read the same
  word (`roleWordOfGuest`).
- **What to wear** showed "For men … · For women …", both figures and both colour sets: the reader's column was chosen
  from `guests.attire` alone. One per-person reading now decides it — `womanOrManOf` (lib/guest-title.ts): gender →
  title → attire — for `parentWordOf`, `readerPick` and `readerAttire`; Me, the guest checklist and the reminder
  checklist pass the person. Unknown still shows both.
- **Arrive** on the ticket read the doors' time (2:30 PM) under Me's "Arrive by 8:00 AM": `guestArriveBy`
  (lib/role-group-dress-code.ts) — the role's own call time from the same tier Me reads, else the doors' time — now
  feeds the ticket (`passCardPass`: the Me picture, "Save my ticket", the zip, the host's card) and the checklist.

SPEC IMPACT: None — applies the 2026-10-17 rulings ("EACH PARENT IS NAMED", "A TITLE CARRIES WOMAN OR MAN") and the
2026-10-16 "EACH ATTIRE COLUMN WEARS ITS OWN" to the surfaces that had not been fed the gender.
