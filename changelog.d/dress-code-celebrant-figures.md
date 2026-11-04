## 2026-11-05 · feat(dress-code): the celebrant and the officiant get their own figures — dress codes for debuts, birthdays, christenings

The owner's twelve new renders (HIGGSFIELD-FRONT-PAGE-ALL-IMAGES-2026-11-04 § F + his wrap dress) are cut by the
existing pipeline (`scripts/build-role-attire.py` #70–#81) into the shipped file set — drawing + one mask per colour zone,
280 px tall, webp q82 / lossless masks — and join the ONE registry (`ROLE_DESIGNS`, lib/attire-designs.ts). No second
taxonomy.

- **The celebrant's row** ("The celebrant") now draws two columns — FOR WOMEN (Ball gown · Filipiniana · Cocktail dress ·
  Long gown · Smart casual · Filipiniana (lola) · Party dress (girl)) and FOR MEN (Barong Tagalog · Suit and tie · Formal ·
  Smart casual). The girl's party dress sits on the women's list and is drawn as a girl at child scale (`drawnAs`,
  `wearerOf`).
- **Which principals a Studio shows follows the event type's role set** (`studioAttireRows(…, { offered })`, the editor
  passes `resolveRoleSetForEvent`): a type whose set offers a celebrant (generic — debut, christening, anniversary,
  graduation… — and birthday) shows "The celebrant" and no bride or groom rows. A wedding is unchanged.
- **The officiant**: the priest's alb and stole is the Officiants row's last Wear (`also: 'officiant'`), drawn as the
  priest. The row's shipped seven are untouched.
- Four new style words — `elder_filipiniana`, `party_dress`, `priest`, `shirt_dress` (the woman's "Smart casual" is a
  one-colour shirt dress, so it is not the men's two-dot `smart_casual`).
- Dev lab: `/dev/details-lab?studio=1&look=1&attire=debut|birthday|christening` runs the real rows on each type's role set.

SPEC IMPACT: None in the corpus yet — every mapping in the PR's "needs owner OK" table (the celebrant's two columns, the
priest on weddings, the wrap filed as Long gown, the new design names, the celebrant's untinted figures) is a build call
awaiting the owner, recorded in the PR body rather than in DECISION_LOG.
