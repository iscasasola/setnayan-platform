## 2026-08-18 · fix(songs): listening to a song was deleting it from the couple's list

**A live defect, degrading every day, with 24% of the damage already done.**
Found by triaging 13 switch-shaped columns with no detectable writer — twelve
were false alarms; this one was the opposite and far worse shape.

### What was happening

The couple's onboarding music step offers *"the most popular wedding songs"* —
a hand-picked list of ~390, seeded once. Separately, the first time anyone plays
a 30-second preview, the app caches that preview and its cover art onto the song
so the next couple loads faster. **That cache write removed the song from the
list.**

Because the list hydrates artwork as rows scroll into view, ordinary browsing was
enough. And the most popular songs sit at the top, so **they hydrated — and left
— first.**

**Measured in production, and the correlation is exact with zero exceptions:**

| | rows | with cached media |
|---|---|---|
| still curated (`source='seed'`) | 298 | **0** |
| demoted (`source='vendor'`) | 93 | **93** |

Being cached *is* being demoted. Song ids 1–12 are Ikaw · Perfect · A Thousand
Years · Beautiful in White · Forevermore · Kahit Maputi Na Ang Buhok Ko. **The
original Top 100 batch is 62% destroyed.**

### 🔑 The mechanism: a BEFORE trigger rewrites columns nobody named

`songs_nonadmin_guard()` fires `BEFORE INSERT OR UPDATE ... FOR EACH ROW` and did
`NEW.is_curated_pick := FALSE` unconditionally for non-admins. **In a BEFORE
trigger `NEW` carries the existing value for every column the statement did not
name** — so a guard written to refuse a *promotion* was silently performing a
*demotion* on every unrelated write. The cache write runs service-role, where
`is_admin()`'s `auth.uid()` is NULL, so the guard fired on it every time.

### 🔑 And the same line destroyed the evidence

`source` was rewritten `'seed'` → `'vendor'` in the same breath, so the repair
already sitting in the repo — `UPDATE songs SET is_curated_pick = TRUE WHERE
source = 'seed'` — now matches **zero** of the damaged rows. *A guard that erases
the record of what it changed cannot be undone by the obvious query.*

### ⛔ The fix is deliberately NOT a role check

Two reasons, both measured:
- The function is `SECURITY DEFINER`, so `current_user` inside it is the OWNER.
  This repo's usual `current_user NOT IN ('authenticated','anon')` idiom would be
  true for **everybody** here and would disable the guard entirely.
- `auth.role()` is NULL in production but `'anon'` in the PGlite replay, so a
  role-based fix **could not be honestly tested**.

Instead the guard now says what it always meant: a non-admin may not **change**
these fields. On UPDATE both are pinned to their OLD values, so a statement that
never named them cannot alter them. Role-independent — it behaves identically in
production and in the replay — and **strictly stronger** than before, since the
old body let a non-admin force `is_curated_pick` to FALSE on any row it reached.

### Restore

All 391 rows came from the two seed batches (the table holds exactly two
`created_at` values and no song has ever been inserted by a vendor or couple), so
restoring by batch is exact rather than a guess. **Dry-run against production,
read-only: the clause touches exactly 93 rows — the precise damage — leaves the
298 correct rows alone, and nothing falls outside the seed batches.** Idempotent.

### Guard

`listening-does-not-unlist.db.test.ts` — 3 assertions. **Mutation-proved by
restoring the original guard body verbatim into the migration: 2 of 3 go red.**
It asserts the cache write preserves both fields, that a non-admin still cannot
promote (the guard's real job, on insert *and* update), and that a non-admin can
no longer demote either.

⏭ **Named, not built:** the admin Songs screen prints "curated" as a read-only
label. There is still no control to add or remove a song on purpose — a separate
build, and not the thing that was bleeding.

SPEC IMPACT: None.
