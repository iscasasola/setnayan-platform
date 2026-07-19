### 2026-06-22 — Reels now play audio: mix the backing track into the render

`apps/web/lib/patiktok-render.ts` — the Patiktok reel renderer now actually
mixes the selected backing track (the couple's Pakanta song, selected in #2057)
into the output. Previously `RenderOptions.musicUrl` was passed through but never
consumed, so every rendered reel was silent.

- **Audio mux (MediaRecorder path):** `prepareMusicTrack` fetches the presigned
  R2 `musicUrl` cross-origin (`mode: 'cors'`), decodes it via an `AudioContext`,
  and routes it through a `MediaStreamAudioDestinationNode` to get a real audio
  `MediaStreamTrack`. That track is added to the canvas `captureStream`, so the
  `MediaRecorder` muxes video + audio into one webm/opus blob. Playback starts
  the instant recording starts (shared t0) and is bound to the reel duration
  (stopped when recording stops; no looping).
- **Codec:** when a track is present the recorder requests an audio-capable
  container (`video/webm;codecs=vp9,opus` → vp8,opus → opus → webm); with no
  music it keeps the original mp4-first video-only ladder.
- **CORS-safe + silent fallback:** if the music can't be fetched/decoded (CORS,
  load, or decode error, or no `AudioContext`), `prepareMusicTrack` returns null
  and the reel renders silent — a reel is never failed over its backing track.
- **WebCodecs note:** the WebCodecs MP4 path stays video-only (adding an
  `AudioEncoder` + audio track to `mp4-muxer` is a follow-up). The entry point
  now PREFERS the MediaRecorder path whenever a `musicUrl` is present
  (`shouldUseMediaRecorder`), so a reel with a song gets audio instead of being
  silently routed to the audio-less WebCodecs path.
- Added unit tests for the pure seams (`shouldUseMediaRecorder`,
  `selectRecorderMime`).

SPEC IMPACT: 0017 Patiktok — reel renderer now mixes the backing track (the
couple's Pakanta song, selected in #2057) into the output via the MediaRecorder
path; graceful silent fallback; closes the song→reel render gap.
