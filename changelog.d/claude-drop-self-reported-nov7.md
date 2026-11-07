## 2026-11-07 · fix(shop-page): an unchecked "in business since" year reads as the year alone

Owner, on his own live shop page: "doesn't that feel wrong that it is self reported?" → "Yes, drop it". The since line now draws "In business since 2020" with no "self-reported" label; a year an admin checked against the DTI registration keeps its ✓. Guarded in `app/v/[slug]/the-since-line-and-check-a-date.test.ts` (sabotaged: putting the word back fails it).

SPEC IMPACT: DECISION_LOG.md row 2026-11-07 "AN UNCHECKED YEAR IS THE YEAR ALONE" (supersedes the "self-reported" state of the 2026-10-29/30 since-line design).
