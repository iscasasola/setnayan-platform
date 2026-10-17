## 2026-10-17 · fix(entourage): the other of two parents is named — "Mother of the Groom", not "Parent of the Groom"

Owner 2026-10-17, on live /cale-ice ("Standing with us · Parents"): "Mr. … — Father of the Groom" stood beside
"Atty. … — Parent of the Groom". His word: *"mother of the groom"*. She is titled "Atty." with her attire at its
default, so the per-person resolver (title, then attire, #6598) had nothing to say.

- `lib/entourage.ts`: when one side's parents — or grandparents — are exactly TWO people, one told by their own entry
  (father / mother) and the other not, the other is the other word (`withThePairInferred`). Nobody whose title or
  attire says something is ever changed; two unknowns stay "Parents / Grandparents of the …"; one person alone, or
  three or more, are unchanged. It lives in the one resolver (`peopleForSpec` → `kinWordsOfHolders`), so every look
  gets it: On the axis, Lines, the march (incl. the plural rule), the prints and the Maker canvas.
- Titles: every title word of the prefix is read, then the display name's leading title words, so a gendered title
  AFTER a professional one is found ("Atty. Mrs. …", "USec. Mrs. …"). Professional and honorific titles (Atty., Dr.,
  Engr., Hon., Judge, USec., Comm., Gen., Ombudsman …) are never gender words.
- `loadMarch` now reads `attire` too (`ENTOURAGE_PARENT_FIELDS`), so a parent told by attire alone reads the same
  on the Maker's march as on the prints.
- Lab: `/dev/maker-lab/guest?entourage=<style>&cast=cale` — cale-ice's parents' shape with stand-in names.
- Guards extended: `lib/the-entourage-names-who-each-person-is.test.ts` (Mr. + Atty. → Father · Mother, Mrs. + Engr.
  → Mother · Father, three on a side, Atty. Mrs. / USec. Mrs., an Atty. alone) and
  `lib/grandparents-are-never-immediate-family.test.ts` (Mr. + Atty. grandparents, two unknown, three).

SPEC IMPACT: None — applies the owner's 2026-10-17 "mother of the groom" to the shipped resolver; no new rule.
