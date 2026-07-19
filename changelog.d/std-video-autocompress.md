## 2026-06-22 · feat(std): auto-compress Save-the-Date video uploads in the browser (ffmpeg.wasm)

Owner directive: "we want our service to already do the necessary compression." Phone exports of the Save-the-Date clip are often huge (cale-ice's was 45s / 135 MB / ~25 Mbps) — too heavy to stream, so the clip stalls + re-buffers on playback. There is **no server-side video processing** in the stack (Vercel can't run ffmpeg; all video work is client-side — see `patiktok-render`, `boomerang-encoder`, `hero-video`). So the platform now compresses the video **in the couple's browser at upload time**.

Owner chose the **robust ffmpeg.wasm** path (2026-06-22) over the lighter WebCodecs route, because WebCodecs AAC audio re-encode is unreliable on iOS Safari (where couples upload). Single-thread core → **no SharedArrayBuffer, no cross-origin-isolation / CSP changes.**

**What shipped:**

- **New `apps/web/lib/video-compress.ts`** → `compressVideoForWeb(file, { onProgress })`. Lazy-loads the ~32 MB ffmpeg single-thread core from a CDN (blob-URL'd; browser-cached after first use; never in the main bundle). Transcodes to **≤1080p H.264 (high/yuv420p) + AAC 128k, CRF 27, `+faststart`** (progressive playback). Typical ~25 Mbps clip → ~15–30 MB.
  - **NEVER throws / never blocks an upload:** returns the ORIGINAL file unchanged on anything — unsupported browser, core load failure, decode error, OOM, or a result that isn't actually smaller.
  - **Skips** clips already light enough to stream (< 15 MB or < 6 Mbps, by a cheap `<video>` duration probe) — no pointless re-encode.
- **`apps/web/app/_components/file-upload.tsx`** — new opt-in `compressVideo` prop. Mirrors the existing client-side `watermark` step: when on and the picked file is a video, it compresses BEFORE presign (so the signed content-length matches the PUT body), with a labelled "Optimizing your video…" progress bar (loading → optimizing %). Falls back to the original on failure. Non-video files + all existing callers are untouched (default off). New deps: `@ffmpeg/ffmpeg@0.12.10`, `@ffmpeg/util@0.12.1`.
- **`apps/web/app/dashboard/[eventId]/_components/std-media-picker.tsx`** — the Save-the-Date video uploader sets `compressVideo`, raises the raw cap to 300 MB (compression handles the weight), and updates the help text ("Big files are fine — we automatically optimize your video…").

Net: a couple can upload a heavy phone video and the platform makes it streamable automatically; if compression can't run on their device, the upload still succeeds (uncompressed) — never blocked.

Build verified (`next build` ✅; ffmpeg code-split into a lazy chunk, shared JS unchanged at 104 kB). tsc 0 · lint clean. **Runtime compression is device-dependent and can't be exercised in CI — owner to verify a real upload on desktop + iPhone.**

Follow-ups (not in this PR): the reusable `compressVideo` prop can later cover other video uploads (hero / Pakanta / Papic). Self-hosting the ffmpeg core (vs CDN) would harden it against CDN downtime. Cloudflare Stream remains the premium server-side option if adaptive streaming is wanted.

SPEC IMPACT: `0024_save_the_date/` — Save-the-Date video uploads are auto-compressed client-side (ffmpeg.wasm) to ≤1080p/faststart before storage; oversized originals no longer reach playback. (Reference/history only.)
