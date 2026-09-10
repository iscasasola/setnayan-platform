## 2026-09-11 · feat(story): the "Make it yours" arrangement is kept, and read back through both photo gates

Step 3 of `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` — the data layer the editor (step 4), the public
page (step 5) and the prints (step 7) are built on. Nothing a host sees changes yet.

- **Where it lives:** `event_editorial.arrangement` (+ `arrangement_version`), a column on the story's
  own row — NOT a key in `draft_json`. Measured: three writers (`saveEditorial`, the cover step,
  What's Next) rewrite the whole of `draft_json` from a copy read moments earlier, so an autosaving
  key there would be put back by whichever finished second.
- **What is kept:** the mode (Automatic | I choose — one switch, as the owner-passed prototype has
  it), the host's moments in their order with any rename, words with their look (colour, backing,
  size, turn) and every hand-placed photo/snippet at x, y in 660-unit sheet units, named sets, and
  whether there is hand work to lose. **Automatic is derived, not stored** — recomputed from the run
  of show and the capture minutes on every read; a run-of-show moment removed by hand comes back.
- **The one write:** `save_story_arrangement` (service role only), a compare-and-set on the version:
  `saved` · `unchanged` (the same document again — a retried autosave is not a conflict) ·
  `conflict` (another tab saved first; nothing is written) · `no_story`. A trigger refuses browser
  roles writing the two columns directly — the table grant to `authenticated` cannot be narrowed
  per column.
- **The save refuses** a photo in two moments (or twice on a page), repeated ids and no moments;
  drops capture ids that are not this celebration's; never stores a run-of-show label as a rename.
- **The read** (`loadStoryArrangement`, service role) reads the audience off the same row and applies
  the guests' layer (S3 — a pre-publish stranger gets no moments at all) and the consent veto (S14 —
  a taken-back photo drops off every page, or shows blurred where a blurred copy was baked; a vetoed
  snippet is dropped). The stored document is left alone, so released consent brings the photo back.

Files: `supabase/migrations/20271220820369_the_arrangement_is_kept.sql` ·
`apps/web/lib/story-arrangement.ts` · `apps/web/lib/story-arrangement-store.ts` ·
`apps/web/app/dashboard/[eventId]/story/arrangement-actions.ts` · `…/story/_lib/load-arrangement.ts` ·
tests `lib/story-arrangement.test.ts`, `lib/story-arrangement-store.test.ts`,
`tests/db/the-arrangement-is-kept.db.test.ts`.

SPEC IMPACT: `DECISION_LOG.md` row (2026-09-11) — the arrangement's home is a column, not a
`draft_json` key; the mode is one switch for the story, not one per moment; `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`
step 3 row updated.
