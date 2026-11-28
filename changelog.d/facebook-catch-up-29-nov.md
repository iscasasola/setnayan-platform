## 2026-11-29 · fix(social): the 29 Nov Facebook catch-up: six posts today, in sync

- `lib/social/governor.ts`: a dated, self-expiring exception (`CATCH_UP_DAYS`). On 2026-11-29 Manila only, the
  Facebook cap is 6 posts on whole hours 08:00–22:00 (≥ 1 h apart). Every other day keeps the three daily slots
  (08:00 · 14:00 · 20:00) exactly; tests pin both sides of the date boundary.
- Migration `20271367965867_facebook_catch_up_29_nov.sql`: puts the day's six posts on their hours (First public
  post 10:00 · Plan it 12:00 · bridal car article 14:00 · Live it 16:00 · supplier comment bait 18:00 · five words
  20:00), moving only rows not yet handed to Facebook, and pulls the two test-shop badge posts (Liwanag Lights &
  Sound · Testnayan W1 Lights). A no-op for library rows #8528 has not inserted; must merge after #8528.
- The same migration first inserts the two 28 Nov library posts #8528's import left out (its `scheduled_for > now()`
  filter dropped both passed slots): `lib-3ef2ffc3a7977c677cad609d` "Introduce Setnayan · Plan it, free" and
  `lib-60ee51dd8318fa11af6a2e24` "Comment Bait", copy byte-for-byte from #8528, `scheduled_for` NULL until placed,
  once only (NOT EXISTS on `('library', source_ref)`). Held by `tests/db/the-29-nov-catch-up-holds-six-posts.db.test.ts`
  (now() fixed at 02:55 Manila: 6 posts 10:00–20:00, badges pulled, a re-run changes nothing).

SPEC IMPACT: None (a one-day exception to DECISION_LOG "FACEBOOK POSTING IS AUTOMATIC, IN THREE DAILY SLOTS", on the owner's word of 29 Nov).
