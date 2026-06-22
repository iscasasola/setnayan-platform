## 2026-06-23 · tweak(std): don't hold the clip's last frames at the crossfade to the calendar

Owner: avoid the last couple of frames of the keepsake clip being visible before it "restarts". The warm loop itself is already hidden (overlay opacity-0 off-beat + frame-0 reveal, #2090); the visible tail was at the END of the clip's own beat — the clip played to its true end, then `'ended'` advanced the film and the **final frame was held on screen for the full VIDEO_FADE_MS (0.85s) dissolve** to the calendar close. Phone clips often end on an unflattering frame (camera lowering / hard stop), so that freeze-on-last-frame is what showed.

Fix: cut over to the close `CLIP_TAIL_TRIM_S` (0.3s) BEFORE the clip's true end via a `timeupdate` watcher (`save-the-date-film.tsx`), instead of waiting for `'ended'`. The off-beat branch then pauses the clip, so it freezes a hair early and dissolves out mid-motion — the actual last ~0.3s of frames never display. `'ended'` stays the fallback for very short clips (guarded `duration > 1`); only fires on the clip's own beat. Trim is a single tunable constant.

SPEC IMPACT: `0024_save_the_date/` — the video beat crosses to the close ~0.3s before the clip's true end (no held final frame). (Reference/history only.)
