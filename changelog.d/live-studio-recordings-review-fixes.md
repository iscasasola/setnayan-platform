## 2026-07-26 · fix(live-studio): two defects an adversarial review found in the recording handoff

An independent multi-lens review of the three merged handoff PRs (#3770/#3774/#3776)
produced 11 candidate findings; 8 were refuted on inspection. These are the two that
survived — both mine, both reproduced directly before fixing.

**① `fetchYoutubeVideoArchives` silently truncated at 50 ids, and truncation reads
as a confident lie.** The call did `.slice(0, 50)` with no signal. `buildRecordingList`
turns "absent from YouTube's answer" into the hard `archived: false`, which the card
renders as **"No recording on YouTube — this channel may not have carried video, or
the broadcast ran past YouTube's 12-hour archive limit."** So an id we never *asked*
about was reported to the couple as a recording that does not exist — the exact false
claim the tri-state exists to prevent, inverted.

Now **chunked, never truncated**: every id is asked about (50 per call), and a failed
chunk **throws** so the existing `catch` degrades the whole lookup to `null` — "we
couldn't confirm" — rather than to a partial answer that reads as a denial. Two chunks
cost 2 quota units out of ~10,000/day.

Reachable at >50 completed broadcasts on one event: a 12-camera wedding with several
end-then-restart cycles, which the code itself anticipates ("it would not survive a
host who ends and restarts mid-day"). The review's first volume estimate was wrong —
rows per cycle are bounded by the pool channel's `concurrent_cap` (default 4), not by
`MAX_ROAM_ZONES` — so it takes roughly ten cycles at shipped defaults, or an
admin-raised cap. Rarer than claimed; still real, still wrong.

**② `formatRecordingDuration` rendered an impossible "1 hr 60 min".** It floored the
hours and rounded the leftover seconds *independently*, so the two could disagree in
the last ~30 seconds of every hour: `7199s → "1 hr 60 min"`, `3599s → "60 min"`.
Reproduced by executing the function. Now rounds to minutes **first**, then splits, so
the carry can't be lost. A property test sweeps 1s…4h asserting no output ever
contains "60 min".

Also: the completed-cameras query had **no `.order()`**, so its row order was whatever
Postgres returned and could differ between two loads of the same page. Now ordered
newest-first, which (with V8's stable sort) deterministically decides which of a
zone's several recordings leads.

`formatRecordingDuration` moved from the card into `lib/live-studio-recordings.ts` so
the pure formatting logic is directly unit-testable rather than trapped behind JSX.

5 new tests (16 in the suite). 4176/4176 unit green with the flag OFF and ON,
typecheck + lint + production build pass. No migration.

SPEC IMPACT: none — no behaviour the corpus describes changes. `DECISION_LOG.md`
records the review and what it refuted.
