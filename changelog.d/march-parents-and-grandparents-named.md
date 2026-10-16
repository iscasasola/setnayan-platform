## 2026-10-17 · fix(entourage): each parent is named per person on every look; a lone person under a two-role heading carries their word

- Owner 2026-10-17: *"It needs to be identified as the mother or father of the bride or groom."* The march printed a pair
  of parents as one word ("Parents of the Groom"); it now says each, in name order — "Father of the Groom · Mother of the
  Groom" (`marchLineWords`, lib/entourage.ts). On the axis and Lines a parent always carries their own word, also where
  only one side's parents are listed (the one-role rule had dropped it there).
- What tells mother from father: the typed title (Mr. / Mrs. Ms. Miss), else the guest card's "Attire · 3D seat plan"
  pick (Gown → mother, Suit → father). Neither → "Parent of the …"; two such parents on one march line share
  "Parents of the …". No gender column exists; nothing is guessed from a first name. The guest-page, /everyone and print
  reads now ask for `attire` (`ENTOURAGE_PARENT_FIELDS`).
- Controller 2026-10-17 (live after #6593): a Maid of Honor, Best Man or crew member centred alone stood under "Maid of
  Honor & Best Man" / "Bride's Crew & Groom's Crew" with nothing saying which — On the axis they now carry their column's
  word (`loneRoleWord`); Lines says the column word too. A category heading (Principal Sponsors) still adds none.
- ⛔ Grandparents NOT relabelled: nothing on a guest row says grandparent. The owner's two are
  `groom_immediate_family`, "Ms.", `relation` empty (and `relation` is empty on every row in production). Reported
  for an owner call.
- Guard: `lib/the-entourage-names-who-each-person-is.test.ts` (11 tests, 4 sabotages red). The maker-lab entourage
  fixture carries two grandparents in the owner's shape.

SPEC IMPACT: None (implements the owner's 2026-10-17 words; the grandparent question is open, not decided).
