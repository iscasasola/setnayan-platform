## 2026-06-22 · feat(std): video auto-compression is now quality-first — keep full resolution (up to 4K)

Owner feedback on the auto-compression (#2055): a ~20 MB target "might not look as high res." Owner chose **maximum quality, keep full resolution** (~60–90 MB). Retunes `lib/video-compress.ts`:

- **Keep original resolution up to a 4K long edge** (was: downscale to 1080p). The scale filter caps the longer side at 3840 in BOTH orientations (`min(3840,iw)':'min(3840,ih)':force_original_aspect_ratio=decrease`) — a ≤4K clip is NOT downscaled; only a >4K source is.
- **CRF 27 → CRF 21** (visually transparent — indistinguishable from the source on any screen) + a **`-maxrate 16M -bufsize 32M`** cap so even a 4K clip stays at a streamable bitrate.
- **Audio 128k → 192k**.
- Skip-if-already-light thresholds raised to <12 MB / <8 Mbps (8 Mbps is already a streamable high-quality rate, so don't re-encode it).

Net: the encode no longer reduces resolution — it only trims the source's WASTEFUL over-bitrate (e.g. a 25 Mbps phone export → roughly half), so "high res" is preserved on large/4K screens while the file streams far better than the 135 MB original. Still NEVER throws — falls back to the original on unsupported/failure/OOM (a 4K transcode is heavier in ffmpeg.wasm; on a low-memory phone it may fall back, in which case the original uploads).

Help text updated: "we optimize your video for smooth playback while keeping its full resolution (up to 4K)."

No schema/SKU changes. Client-only.

SPEC IMPACT: `0024_save_the_date/` — STD video auto-compression is quality-first (keep ≤4K resolution, CRF 21 + maxrate), not size-first. (Reference/history only.)
