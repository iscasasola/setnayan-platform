## 2026-08-24 · feat(samahan): 24-hour hourly stories — the Setlog concept inside a samahan

A samahan member can now share a short raw clip to their group — one per
clock hour — and it disappears after 24 hours. Owner 2026-08-24: *"samahan to
have the same setlog concept … share stories every hour and we will only
keep these videos for 24 hours."*

- Migration `20271162535352_samahan_stories_24h.sql`: `samahan_stories` with
  RLS-enforced expiry (`expires_at > now()` in the read policy — the 24-hour
  promise holds the instant the clock passes, sweep or no sweep) and the
  one-per-hour rule as a UNIQUE index on a DB-stamped hour bucket. No
  authenticated write surface at all.
- `POST /api/samahan/story`: member check through the caller's own session,
  SYNCHRONOUS NSFW screen of the poster frame (a flagged post never gets a
  row — no unscreened state exists), browser-transcoded web720 clip only.
  `DELETE` lets the author take their own story down early.
- `lib/samahan-stories.ts`: one deleter for both take-down and expiry — R2
  objects first, row last (a failed file delete keeps the row so the sweep
  retries; no orphaned bytes, no rows naming deleted files). Cron-free
  `samahan-story-sweep` via `claim_periodic_job`, fired from the community
  page's `after()`.
- Stories strip on the samahan space page (overview tab): capture/pick a
  clip, phone does the compressing, posters as thumbnails, tap to play,
  hours-left label, "Take it down" on your own.
- Ugat: joint J40 documents the table, its rate shape, and its two
  deliberate traps.

SPEC IMPACT: DECISION_LOG.md row 2026-08-24 (Samahan stories ruling — hourly
rhythm, 24-hour retention, free; the paid keep-forever path stays Papic on a
group event).
