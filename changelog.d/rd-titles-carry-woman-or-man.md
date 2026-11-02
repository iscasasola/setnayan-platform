## 2026-10-17 · feat(guests): a title carries woman or man — "Atty. (Woman)" · "Atty. (Man)"

Owner, 2026-10-17: *"Find a different approach on how to fix this issue on prefixes which are neutral gender"* →
*"or let them choose Atty (Female) or Atty (Male). something like this"* → *"so no need to choose"*.

- **Title dropdown** (the guest card, both kits; /guests/new): Mr. · Ms. · Mrs. · Miss, then each common neutral title
  twice — "Atty. (Woman)" · "Atty. (Man)" (Fr./Msgr./Bro. Man only, Sr./Sis./Dra. Woman only) — "No title (Woman/Man)",
  and "Other title…" (template kit): the typed title comes back as two entries in the same list. Posts one key,
  `name_title` = "Atty.|woman"; `updateGuest` / `createGuest` store `name_prefix` (prints) + `gender` (never prints).
- **`guests.gender`** (migration `20271271534871`): nullable, CHECK woman|man; backfill Mr. → man, Ms./Mrs./Miss → woman
  only; trigger keeps those four for every writer; a neutral title keeps the gender the row had. Grants equal to
  `name_prefix` for anon/authenticated/service_role (post-condition); exposure baseline +1 line.
- **The one resolver** (`lib/entourage.ts` `parentWordOf`) reads gender FIRST, then the title, then attire; a legacy
  `principal_sponsor` with a gender stands in the Ninang / Ninong column; the seat-plan figure dresses from it
  (`resolveGuestAttire`). The march (`loadMarch`) now asks the parent fields.
- **Guests list prompt**: "N people need Woman or Man for their title" — a sheet of the same Title dropdown, narrowed
  to each person's own title's two entries, saved as tapped (`setGuestTitleGender`); gone when none are left. Only the
  roles whose word waits on it (parents, grandparents, legacy principal sponsor). No email, no notification.
- Bulk paste, quick add and the import read a typed "(Woman)" / "(Man)" as the gender and drop it from the name.
- Guards: `lib/the-title-carries-woman-or-man.test.ts`, `tests/db/a-title-carries-woman-or-man.db.test.ts`.

SPEC IMPACT: New column `guests.gender` and the title-with-gender picker — DECISION_LOG row "A TITLE CARRIES WOMAN OR
MAN" (owner 2026-10-17).
