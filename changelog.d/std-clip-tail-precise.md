## 2026-06-23 · fix(std): frame-precise clip tail-cut — no leftover ending picture OR sound

Owner: "there is still a bit of sound from the ending. shorter but there is still a bit showing." The #2093 tail-cut fired on `timeupdate`, which only ticks ~4×/s — so the actual cut point was sloppy (worst case it only trimmed ~0.05s), leaving a sliver of the clip's final frames AND its trailing audio.

Fix (`save-the-date-film.tsx`): fold the tail-cut into the same `requestVideoFrameCallback` loop that already handles the frame-0 reveal (#2094) — one per-frame loop now owns BOTH ends, frame-precise: reveal once the presented frame is at the start, and CUT to the close once the presented frame is within `CLIP_TAIL_TRIM_S` of the end. The off-beat branch then pauses the clip, so both its final frames and its audio stop exactly at the cut. Trim bumped 0.3 → 0.5s (reliable now that the cut is exact). `timeupdate` stays as the coarse fallback for pre-Safari-15.4; `ended` for very short clips. Single tunable constant.

SPEC IMPACT: `0024_save_the_date/` — clip tail-cut is frame-precise (0.5s), no leftover ending frame/audio. (Reference/history only.)
