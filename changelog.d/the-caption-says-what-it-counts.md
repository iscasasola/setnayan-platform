## 2026-08-23 · fix(event): the gold bar names what it actually counts

Home and the event page reported different "% planned" figures for the same wedding, and a person
reading two numbers under one label concludes the product is confused about their own celebration.

**Neither number was broken.** They are two different measures wearing one word: the account home
reports the event CHECKLIST's real done/total; the event focal's gold bar reports the LOCKED SHARE
OF VENDOR CATEGORIES. The fix is the caption, not the arithmetic — the focal now says "locked in".
Home is untouched, and once the two stop sharing a word they cannot contradict each other.

🔑 **The honest caption already shipped twice for this exact value** — `setnayan-ai-value.tsx` and
`lib/setnayan-ai-activity.ts` both say "% locked in". Their wording is reused rather than a third
phrase invented for a number the product already knows how to name. The local variable is renamed
to match, so nothing is left called `plannedPct` while rendering "locked in".

⛔ **Deliberately NOT "compute it once and show it everywhere."** That requires deciding which
measure is the real answer to "how planned is this wedding" — a product ruling, and making it
inside a caption fix is how this project acquires a lock nobody remembers agreeing to. A guard
asserts the two still read different sources.

4 sabotages, each measured by occurrence count, all red. One of them first landed on a DOCBLOCK
rather than the code (raw count 2 → 1, stripped count unchanged) and was re-run against the
statement — a green from a sabotage that missed proves nothing.

SPEC IMPACT: None. Presentation only; no migration, no schema, no price or SKU change.
