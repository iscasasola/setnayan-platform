## 2026-09-01 · docs(sai): the rename missed a CSS comment

The Suri→Sai rename (PR #5035) grepped `.ts`/`.tsx` only, so one stale mention
survived in `home-reskin.css`'s block comment describing the homepage dock. A
comment is not user-facing, but a stale name in one is exactly what sends the
next session looking for a thing that no longer exists — the failure mode this
repo's own RULE 0 note about migration comments already records.

Deliberately NOT changed, and each for its own reason:

- **Applied migrations** (`20270328649472`, `20270328031951`, `20270527224949`)
  still say Suri/Surian. Applied migrations are never edited — they are the
  record of what ran, and the PGlite replay hashes them.
- **`changelog.d/feat-free-venue-assist.md`** (2026-07-09) still says Suri. It
  is a historical entry describing what shipped under that name on that day;
  rewriting it would make the log lie about the past.

⚠ **THE RENAME IS NOT COMPLETE IN PRODUCTION DATA, AND THAT PART IS NOT A CODE
CHANGE.** `homepage_background_videos` slot 4 is live with
`label = 'Suri · Setnayan AI'`, `is_published = true` — so the homepage dock
still shows the old name to every visitor. Its siblings carry the rest of the
retired pillar set (`Ala Ala · Memory Hub`, `Likha · Creative Studio`,
`Plano · Planner`, `Tiangge · Marketplace`). Renaming those is an owner
decision about the whole pillar system, not a find-and-replace, so it is
surfaced here rather than applied.

SPEC IMPACT: None. The Sai decision is already recorded in the corpus
`DECISION_LOG.md` (2026-08-31).
