# Controller orders, 29 Nov 2026

## To the Facebook catch-up session (PR #8541), 02:55 Manila: URGENT
#8541 would give 4 posts today, not 6. Read-only check of prod `social_posts`: #8528 is live and applied, but `lib-3ef2ffc3a7977c677cad609d` (Introduce Setnayan · Plan it, free) and `lib-60ee51dd8318fa11af6a2e24` (Comment Bait · unusual client request) DO NOT EXIST in prod. #8528's importer skipped them because their 28 Nov slots were already past.

1. In your migration, INSERT those two library rows (the same columns, caption, first comment, link and source_ref that `20271366752632_social_library_v2.sql` would have written; copy the values, change no wording), status 'scheduled', NOT EXISTS-guarded so a re-run inserts nothing. The placement loop then puts them at 12:00 and 18:00.
2. Add a PGlite db test: after both migrations, 29 Nov holds exactly 6 rows on whole hours ≥1 h apart, and the two badge posts are 'pulled'.
3. Preflight, `gh pr ready 8541` (keep do-not-auto-merge), CI green, STATUS ready with the head SHA.
The owner gave GO to merge on green. The first post is at 10:00 Manila.
