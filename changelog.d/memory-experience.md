### Memory-home experience — "on this day" + timeline on the Account Photos tab

Turns the Photos tab from a flat album grid into a memory environment:

- **"On this day" anniversary callout** — for events you host whose anniversary is TODAY (exact month/day), a celebratory strip surfaces at the top ("N years ago today — [event] · relive the day", linking to the gallery). Computed from `event_date` vs today; no extra query. This is the in-app form of the memory-home retention hook (the emailed version is PR-G).
- **Year / timeline grouping** — once a user's events span multiple years, the albums group into year sections (most recent first, undated last), so the 10-events case reads as a chronology instead of a wall of cards. Single-year users keep the flat grid.

Deferred (follow-ups): inline reel playback (needs the reel-render pipeline) and media-by-date "on this day" (vs the date-based anniversary used here).

SPEC IMPACT: None (account-area UI).
