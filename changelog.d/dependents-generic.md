## 2026-07-13 · feat(people): dependents are generic — a person, a pet, or anyone

Owner correction (2026-07-13): a dependent "can be a dog, a cat, or anyone —
there is no specification that it needs to be a child." Adds a `dependent_kind`
(person | pet | other) discriminator so the table is a general "someone (or
something) you care for" list rather than a child registry:

- **person** — unchanged: the age fence (<18 / >50), debut milestones, hand-over,
  religion/sex, guardian-consent stamps, and godparents all still apply. Birthday
  is now optional here.
- **pet / other** — no age fence, any/no birthday, no religion/sex, no debut, no
  godparents. Sensitive human fields are dropped server-side even if posted.

Migration `20270805098152` adds the column + CHECK and reframes the table comment
(table is flag-off + empty in prod → the `person` default backfill is a no-op).
Feature stays gated behind `dependentPeopleEnabled()` (default OFF).

SPEC IMPACT: the privacy corpus is updated to match — dependents is reframed from
"minors' data / most sensitive" to a generic list whose sensitive-PI (a child's
birthdate/religion) is a **conditional sub-case of the person kind**, not the
table's purpose. Applied in `NPC_Privacy_Compliance_Dossier_2026-07-12.md`,
`Privacy_Reconciliation_Home_and_Data_Flows_2026-07-13.md`,
`01_Contracts/Setnayan_Privacy_and_Security_Policy.md`, and
`Counsel_Review_Packet_NPC_Privacy_2026-07-13.md`.
