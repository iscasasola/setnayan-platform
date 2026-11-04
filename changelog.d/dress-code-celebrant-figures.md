## 2026-11-05 · feat(dress-code): the celebrant and the officiant get their own figures — dress codes for debuts, birthdays, christenings

The owner's twelve new renders (HIGGSFIELD-FRONT-PAGE-ALL-IMAGES-2026-11-04 § F + his wrap dress) are cut by the
existing pipeline (`scripts/build-role-attire.py` #70–#81) into the shipped file set — drawing + one mask per colour zone,
280 px tall, webp q82 / lossless masks — and join the ONE registry (`ROLE_DESIGNS`, lib/attire-designs.ts). No second
taxonomy.

- **The celebrant's row** ("The celebrant") now draws two columns — FOR WOMEN (Ball gown · Filipiniana · Cocktail dress ·
  Long gown · Smart casual · Filipiniana (lola) · Party dress (girl)) and FOR MEN (Barong Tagalog · Suit and tie · Formal ·
  Smart casual). The girl's party dress sits on the women's list and is drawn as a girl at child scale (`drawnAs`,
  `wearerOf`).
- **Which principals a Studio shows** (`studioAttireRows(…, { offered })`, the editor passes `resolveRoleSetForEvent`):
  "The celebrant" when someone on the guest list is the celebrant (as shipped); "The bride" / "The groom" only where the
  event's role set offers them — so a debut, a birthday or a funeral no longer shows a bride and a groom. A wedding is
  unchanged. Which types should show the celebrant before anyone is tagged is left to the owner: the generic set (every
  type without its own) also covers corporate, travel and funeral.
- **The officiant**: the priest's alb and stole is drawn and registered (`officiant`), but offered on no row yet — where
  the officiant belongs is the owner's call, and a wedding's Officiants row stays exactly as shipped. His answer, if it is
  "on that row", is one flag (`also: 'officiant'`) on it.
- Four new style words — `elder_filipiniana`, `party_dress`, `priest`, `shirt_dress` (the woman's "Smart casual" is a
  one-colour shirt dress, so it is not the men's two-dot `smart_casual`).
- Dev lab: `/dev/details-lab?studio=1&look=1&attire=debut|birthday|christening` runs the real rows on each type's role set.

SPEC IMPACT: None in the corpus yet — every mapping in the PR's "needs owner OK" table (the celebrant's two columns,
where the priest goes, the wrap filed as Long gown, the new design names, the celebrant's untinted figures) is a build call
awaiting the owner, recorded in the PR body rather than in DECISION_LOG.
