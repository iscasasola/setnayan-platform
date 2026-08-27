## 2026-08-27 · fix(event-types): the event is a WAKE — the funeral is the ceremony inside it

Owner ruling 2026-08-27, verbatim: *"Wake is the viewing (our event not funeral). Funeral is the ceremony until burial. So change it to Wake instead of Funeral."*

One word was doing two jobs. The **lamay** — the nights of viewing, running as long as the family needs — is what a family actually plans here: the guest list, the schedule, the food through the nights, the photographs. The **funeral** is the ceremony on the closing day, through to the interment. Shipping the type as "Funeral" named the last day and called it the whole stretch.

**The event type is now `wake`.** ⛔ **`funeral` was NOT swept out of the product, and must not be.** Almost every surviving use is correct and was correct before this: the "funeral Mass" option in onboarding, "Funeral service" on the run-of-show, the funeral home on the checklist, the supplier category. A global find-and-replace here deletes the distinction this change exists to draw.

### Why now

Measured against production before a line was written: **0** events carry the type, **1** vocab row, **1** profile, **1** onboarding row, **7** marketplace tiles, **0** everywhere else. Ten rows, four tables, and not one family has created one. That is only true today — the first real wake makes this a data migration with a grieving family attached to it.

### 🪤 Two traps, both caught by the replay rather than by the survey

**1 · I CHECKED FOR THE WRONG CONSTRAINT CLASS.** I asked whether any `CHECK` constraint named the value, found none, and called it free to move. `event_type_vocab.event_type` is a **FOREIGN KEY parent** for three tables — `events` (ON UPDATE **NO ACTION**, so it would REFUSE the parent rename the moment one real event existed) and `event_type_profiles` / `event_type_onboarding` (ON UPDATE CASCADE, **ON DELETE CASCADE** — so removing the old row while a child still pointed at it would have silently deleted the wake's solemn register). *"No CHECK constraint names the value" is a true sentence about the wrong question.* Ask `pg_constraint` for `contype='f'` too.

The migration therefore **never renames the parent**: it mints the new row, moves every child onto it, then removes the old one — correct whatever the cascade rules are and whatever the row counts are, today or after the first real wake.

**2 · 🚨 A RENAME IS EVERY SPELLING OF THE VALUE, NOT THE PRIMARY KEY.** `event_type_profiles.onboarding_flow_key` is a *second* column holding the string `funeral`, naming the persona pack the onboarding page looks up. The code-side pack was renamed with everything else, so leaving it would have pointed a live column at a pack that no longer exists — a family choosing a wake would get the quiet intro and then **no questions and no starter plan, with nothing thrown and nothing logged**. The survey counted rows whose `event_type` was `funeral`; this column is not that column.

**3 · And the same shape in the code.** The first pass replaced the quoted key `'funeral'` and missed **dot-access** `.funeral` — five sites. Production code was clean; the tests read the old property name and failed. *A rename that misses the copies is a diff.*

Both database misses are now **refuse-to-apply guards** in the migration, alongside one that fails if any row still carries the old value in any table (arrays included — a row-count check walks straight past `applicable_event_types`) and one that fails if the wake does not exist afterwards, since deleting the statements would otherwise satisfy the first check perfectly.

### What moved

`WAKE_PROFILE` (was `FUNERAL_PROFILE`) · the checklist def, template and title (**"Wake"**; the possessive noun stays `service` — "your service date" reads with dignity, "your wake date" does not) · the anchor, host roles, run-of-show, Setnayan AI tier, Papic access list · the onboarding persona pack, question set and specialty catalog, whose label becomes **"Wake (Lamay at libing)"** · `tests/db/funeral-event-type.db.test.ts` → `wake-event-type.db.test.ts`, with a header recording that a future sweep trying to make it say "funeral" again would be undoing a distinction, not fixing a typo.

### Tests

Full unit suite **10,353 / 0**. `tests/db/wake-event-type.db.test.ts` 6/6 — it pins the vocab row, the solemn register, the quiet onboarding intro, the onboarding pack pointer, the seven scoped tiles, and that a community can never own one.

SPEC IMPACT: Event type `funeral` is renamed to `wake`, per the owner's 2026-08-27 ruling. The corpus decision log and the funeral/solemn register notes name the old key and need the same correction — the word `funeral` stays correct wherever it means the ceremony.
