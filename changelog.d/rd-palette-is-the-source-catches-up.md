## 2026-10-07 · fix(theme): the palette branch catches up with main — one log line per failed read

The Mood Board palette work (#6359) already reached main through train 2026-10-05 i. Main and this branch each added a log line for the two new reads (the theme's fill write and the theme gallery's sample board), so the branch conflicted. Kept this branch's version: each failed read is logged once, as a graceful degrade, and returns at once (the fill says "Press Apply again"; the sample wears each theme's own colours). Main's duplicate lines and duplicate import are gone. Port-control baseline regenerated on the merged tree.

SPEC IMPACT: None
