## 2026-07-17 · fix(scripts): music ingest — support audio-decode >=3 buffer shape

`scripts/lib/beat-grid.mjs decodeToMonoPcm` assumed the Web-Audio `AudioBuffer`
API (`getChannelData()`/`numberOfChannels`/`length`), but the installed
`audio-decode@3.11` returns a plain `{ channelData: Float32Array[], sampleRate }`.
Every ingest silently failed with "Array is empty" (empty mono buffer → music-tempo).
Now normalises across both shapes so `ingest-owned-music.mjs` computes beat grids
and uploads owned masters again.

SPEC IMPACT: None (build tooling; unblocks owned-music ingest for the teaser render).
