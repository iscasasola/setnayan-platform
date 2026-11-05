## 2026-11-05 · feat(dress-code): the celebrant and the officiant get their own figures — dress codes for debuts, birthdays, christenings

The owner's twelve new renders (HIGGSFIELD-FRONT-PAGE-ALL-IMAGES-2026-11-04 § F + his wrap dress) are cut by the
existing pipeline (`scripts/build-role-attire.py` #70–#81) into the shipped file set — drawing + one mask per colour zone,
280 px tall, webp q82 / lossless masks — and join the ONE registry (`ROLE_DESIGNS`, lib/attire-designs.ts). No second
taxonomy.

- **The celebrant's row** ("The celebrant") now draws two columns — FOR WOMEN (Ball gown · Filipiniana · Cocktail dress ·
  Long gown · Smart casual · Filipiniana (lola) · Party dress (girl)) and FOR MEN (Barong Tagalog · Suit and tie · Formal ·
  Smart casual). The girl's party dress sits on the women's list and is drawn as a girl at child scale (`drawnAs`,
  `wearerOf`).
- **Which principals a Studio shows** (`studioAttireRows(…, { offered, eventType, celebrants })`, the editor passes
  `resolveRoleSetForEvent` and `resolveProfileByEvent`): "The bride" / "The groom" only where the event's role set offers
  them — so a debut, a birthday or a funeral no longer shows a bride and a groom; a wedding is unchanged. "The celebrant"
  **from the start** on a debut, a birthday, a christening, an anniversary and a graduation (`CELEBRANT_FROM_THE_START`,
  owner 2026-11-05 (J)); on any other type once someone on the guest list is the celebrant.
- **One column once the gender is known** (owner (L)): when every celebrant's woman-or-man is known (`womanOrManOf` —
  gender → title → attire), the row draws only their column(s) (`celebrantColumns`); an anniversary couple keeps both,
  and one unknown celebrant keeps both.
- **The celebrant's colours** (owner (K)): drawn in the event's MAIN colours by default — in the Studio ("In your main
  colours") and on the guest side (`resolveAttirePaletteColors`, which gave a celebrant the guests' colours).
- **The officiant** (owner (M)): the priest's alb and stole is offered at the end of the wedding Officiants row's Wear ▾
  (`also: 'officiant'`), drawn as the priest. A christening's officiant is a later role-set migration, not in this PR.
- Four new style words — `elder_filipiniana`, `party_dress`, `priest`, `shirt_dress` (the woman's "Smart casual" is a
  one-colour shirt dress, so it is not the men's two-dot `smart_casual`).
- Dev lab: `/dev/details-lab?studio=1&look=1&attire=debut|birthday|christening|graduation` runs the real rows on each type's role set.

SPEC IMPACT: None applied — the owner's answers are already recorded in the corpus (DECISION_LOG 2026-11-05, "WHO CHANGES
THE SCHEDULE, SUPPLIER GIFTS, CELEBRANT DRESS CODES…" (J)–(N)); this PR builds them. Open: a christening officiant
(a role-set migration, later).
