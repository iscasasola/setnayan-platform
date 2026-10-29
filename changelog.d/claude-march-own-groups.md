## 2026-10-29 · feat(guests): March — the couple's own march groups (＋ Group)

Owner 2026-10-29 (DECISION_LOG "GUESTS ANSWERS (owner ~14:40): custom March groups YES"): *"yes. so if they have a
custom way of marching they can customize it."* In Guests › March a couple can now make their OWN march groups —
named, ordered, holding walks — beside the role-based sections.

- ＋ Group sits where the approved Guests prototype (v13) draws it: the thumb row's ＋ ▾ ("New group", first — then
  the "Not walking" names, as before) and the selected group's toolbar (Rename · ＋ Walk ▾ · ＋ Group · Delete). A new
  group lands after the selected group (else after the last section, before the bride's side), opens with its name
  box up, and is drawn empty with a drop box until a name is dragged in.
- An own group behaves exactly like the shipped role sections (the same header tap/toolbar, sticky header, lone walker
  spans, empty walk removed, header drag to reorder). A name may be dragged INTO an own group (a gap, or beside a lone
  walker) and back to its role's section; any other cross-section drop is still refused in words. Delete = its walkers
  to "Not walking" (filed under their role's section) and the group goes.
- Every edit is a drafted march step (`group-add` · `group-name` · `group-drop` · `regroup`), shown at once and written
  at ✓ Apply through `guests/march-group-step.ts` (plain functions — +0 server actions).
- Data: migration `20271296703339_march_own_groups.sql` — `march_groups` (RLS at CREATE TABLE, `march_walks`' host
  terms) + `march_walks.march_group` (composite FK, `ON DELETE SET NULL (march_group)`) + `set_march_group()`
  (SECURITY INVOKER). Order rides the existing `events.entourage_section_order`. The march only — the invitation's
  entourage still prints everyone under their role. Ugat J50 claims extended.
- Guards: `lib/march-own-groups.test.ts`, `tests/db/march-own-groups.db.test.ts` (each sabotaged red, restored).

SPEC IMPACT: None — implements the 2026-10-29 DECISION_LOG row as ruled (no new decision). The data home is new schema
(`march_groups`, `march_walks.march_group`), recorded here and on the Ugat map.
