## 2026-10-17 · feat(guests): Grandparents of the Bride / of the Groom are their own roles

Owner 2026-10-17: *"the 2 grandparents should not be named immediate family on the wedding march list."* Asked
"two roles, the same way Parents works, or a Relationship dropdown?", he answered "Okay" to the roles.

- Migration `20271271089555_guest_role_add_grandparents.sql`: `guest_role` gains `bride_grandparents` and
  `groom_grandparents` (ADD VALUE only, no backfill, RLS untouched). Applied by the pipeline, never by hand.
- Offered on the guest card's **Details › Role in wedding** picker, /guests/new, quick add and the bulk "Assign
  role…" (Catholic and Muslim weddings), labelled "Bride's Grandparents" / "Groom's Grandparents".
- Stand where the parents stand everywhere a tier is computed: VIP · Immediate Family group, seating tier 1, the
  Auto Arrange family set, inner-circle invite blocks, mood-board / attire colour, attire figures, emcee order,
  guestbook voice, guest search (lolo / lola / grandmother / grandfather).
- Entourage: a **Grandparents** section right after Parents and before Immediate Family, groom's side first. Each is
  named per person by the parents' own resolver — "Grandfather / Grandmother / Grandparent of the Groom". On the
  march, people on one line who are the SAME word say it once in the plural — "Grandmothers of the Groom", and for
  parents too, "Mothers of the Bride" (`kinWordForSeveral`); different words stay "X · Y". In the march they walk right after "The Groom & his
  parents". Same published visibility class as parents (docblock in `lib/entourage.ts`).
- A couple who arranged their sections before today: Grandparents joins right after THEIR Parents
  (`joinsSavedOrderAfter`), not at the end, so an arranged event does not walk its grandparents last.
- Guard `lib/grandparents-are-never-immediate-family.test.ts`: no grandparent under Immediate Family on any look;
  every role list naming a parent names the grandparent beside it (source scan, reasoned exceptions); every tier
  gives a grandparent what a parent gets.

No data is moved: a grandparent recorded as immediate family stays so until the couple re-picks the role.

SPEC IMPACT: `DECISION_LOG.md` — a row for the owner's 2026-10-17 grandparents ruling (two roles, Parents' twin).
