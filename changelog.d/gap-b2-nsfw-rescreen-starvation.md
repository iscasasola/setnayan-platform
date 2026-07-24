## 2026-07-24 · fix(papic): NSFW re-screen sweep no longer starved by poster-less clips

Gap audit 2026-07-23 · Batch B2. A clip whose poster-frame upload failed sits at
`moderation_state='unscreened'` forever: `screenCapture()` classifies a clip by
its poster and BAILS (no state written) when there's no poster. `reScreenStuckCaptures`
selects `unscreened` rows with a fixed `RESCREEN_LIMIT` (10/table) and NO order,
so ≥10 such clips re-fill the window every run — genuinely-screenable photos that
a transient screen hiccup left `unscreened` never get re-screened and stay dark
on every guest surface (guest gallery + Live Wall show only `clean`).

Both sweep queries (per-event `reScreenStuckCaptures` + global discovery
`reScreenAllStuckCaptures`) now exclude poster-less clips — keep a row iff it is
NOT a clip OR it has a poster (`.or(<clipCol>.is.null,<clipCol>.neq.clip,poster_r2_key.not.is.null)`)
— and the per-event sweep orders `created_at` ascending so the window advances.
Degrades safely if `poster_r2_key` is absent (42703 → skip that table). No
migration. Existing nsfw sweep/screen tests 16/16.

SPEC IMPACT: None — sweep convergence fix.
