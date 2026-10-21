## 2026-10-21 · fix(dress-code): an entourage man's three controls in the owner's words; the guests' barong / smart casual top held; accents numbered

Owner, 2026-10-21, three rulings on Studio › Mood Board & Dress Code:
- *"barong and smart casual will be their long sleeves or the barong can be tinted as well"* — measured: a guest man's
  Barong Tagalog / Smart casual already wore the option colour on the top, the pants the approved neutral (charcoal ·
  khaki), the host's zone colours winning. Nothing to change in the drawing; now guarded. The smart-casual top's
  word is "Long sleeves".
- *"groomsmen, sponsors entourage men has 3 palette controls. so the coat and pants can be a specific color / tie and
  accent a specific color / long sleeves a specific color"* — measured: every entourage suit / tuxedo / vest design
  already had three fixed 44 px controls (the 3-piece had four). Labels are now **Coat & pants · Tie & accent · Long
  sleeves** (`COAT_AND_PANTS` · `TIE_AND_ACCENT` · `LONG_SLEEVES`, lib/attire-figures.ts; vest designs say "Vest &
  pants"); a 3-piece's vest has no fourth control — it is drawn in Coat & pants (`FOLLOWER_ZONES`, `artZoneKeys`,
  `controlOfZone`; `zoneTints` paints each mask by its control).
- "Long gown · Accent · Accent" — a colour past a one-zone design is numbered as the record numbers accents
  (`accentWord`: Accent · Accent 2); no two dots of one person say the same word.
- Lab: `/dev/maker-lab/guest?attire=cale-now&gm=barong_tagalog|smart_casual`.
- Guard `lib/guests-wear-the-palette-on-the-tie.test.ts` tests 4–6 (+ the owner's three words spelled once); pinned
  words re-anchored in `each-role-has-its-own-designs.test.ts` and `the-dress-code-shows-every-pick.test.ts`.

SPEC IMPACT: DECISION_LOG row 2026-10-21 "THE GUESTS' TOP · THE ENTOURAGE MAN'S THREE CONTROLS" (corpus `DECISION_LOG.md`).
