## 2026-06-23 · fix(std): reveal the clip on the actually-presented frame 0 (requestVideoFrameCallback)

Owner: "i still see a bit. i really need it to start from the beginning." #2090 gated the clip-overlay reveal on the `'seeked'` event, but `'seeked'` fires when the seek OPERATION completes — the compositor can still paint the OLD (mid-clip) frame for a tick afterwards, and the blind 700ms fallback could reveal a wrong frame on a slow seek. That leaked tick is the "bit" before it starts from the beginning.

Fix (`save-the-date-film.tsx`): gate the reveal on `requestVideoFrameCallback` — the PRESENTED frame's `mediaTime`. After seeking to 0 we keep requesting frames until `mediaTime <= 0.08` (the start is genuinely on screen), then reveal. So the first visible frame of the crossfade is always the beginning; no mid-clip frame can leak. The clip keeps PLAYING throughout (never paused), so iPhone audio takeover + buffering are untouched. Falls back to `'seeked'` on browsers without rVFC (pre-Safari 15.4); last-resort 1200ms safety timer so it can never hang hidden.

SPEC IMPACT: `0024_save_the_date/` — the video beat reveals only once the presented frame is at the start (frame-accurate, not seek-event-based). (Reference/history only.)
