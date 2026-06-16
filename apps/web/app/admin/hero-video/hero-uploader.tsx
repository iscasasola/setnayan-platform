'use client';

/**
 * Admin hero-video uploader.
 *
 * Flow (all client-side, since Vercel can't run ffmpeg):
 *   1. Admin picks a video file.
 *   2. We upload the original to R2 (presigned PUT via /api/upload).
 *   3. We extract frames IN THE BROWSER — load the video, seek to N densely
 *      spaced timestamps (~native fps), draw each to a downscaled canvas, export
 *      JPEG. Dense frames keep the scroll-scrub smooth (no stepping); the
 *      downscale keeps the homepage preload light.
 *   4. We upload each frame JPEG to R2.
 *   5. We persist the frame URLs to homepage_hero_config (server action).
 *   6. Admin clicks Publish → the homepage swaps to the scroll-scrub.
 *
 * A 1:1 (square) source is recommended so one render crops cleanly to both
 * desktop (16:9) and mobile (9:16) via object-fit:cover, but any aspect works.
 *
 * RESOLUTION: frames are drawn at up to FRAME_MAX_EDGE px on the long edge and
 * encoded at FRAME_JPEG_QUALITY. The hero is CONTAINED (centered on a dark
 * canvas, capped at min(native, 86vmin) — never displayed larger than the
 * source), so it never upscales/pixelates the way the old full-bleed cover did.
 * A 1080p+ source (1440–2160px square ideal) still reads best on large/retina
 * displays. Higher resolution + more frames = a bigger preload, so FPS is kept
 * modest (16) and clips should be short (~4–6s) — also the ideal hero length.
 */

import { useState, type ChangeEvent } from 'react';
import { saveHeroVideo, toggleHeroPublish } from './actions';

type Phase = 'idle' | 'uploading-video' | 'extracting' | 'uploading-frames' | 'saving' | 'done' | 'error';

// Frame density (owner 2026-06-16): the homepage hero now plays as a LONG, SLOW
// scroll-scrub (TRACK_VH in HeroVideoScrub — ~600vh of runway), so it needs ENOUGH
// frames to stay smooth as you scroll slowly through it; too few = a stepped
// slideshow. Frames still preload behind the "Setting it up…" veil and STREAM in
// progressively (the scrub releases after the opening frames), so a denser sequence
// costs first-load BYTES, not a front-door freeze. 16fps over a ~5–6s clip → ~80–96
// frames × ~960px (~4–5MB) — smooth on the long track, still lean. 960px stays crisp
// on the CONTAINED hero (capped at min(native, 86vmin)) and q0.82 is indistinguishable
// on a moving scrub. Longer source clip = more frames = smoother (and a longer scrub).
// (Raised from the prior lean 8fps/40-frame trim to suit the longer, slower track.)
const FPS = 16;
const MAX_FRAMES = 300; // ceiling (~19s @ 16fps); real hero clips are ~4–6s → ~80–96 frames
const MIN_FRAMES = 54;
// Long-edge cap for extracted frames. 960 keeps the contained hero crisp while
// keeping the preload light; sources smaller than this pass through unchanged
// (never upscaled).
const FRAME_MAX_EDGE = 960;
// JPEG quality — 0.82 is clean on a moving, contained scrub while cutting bytes
// meaningfully vs 0.90.
const FRAME_JPEG_QUALITY = 0.82;
const FRAME_UPLOAD_CONCURRENCY = 5;

async function presignAndPut(body: Blob, pathPrefix: string, filename: string, contentType: string): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'media', pathPrefix, filename, contentType, sizeBytes: body.size }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `Upload failed (${res.status})`);
  }
  const { uploadUrl, r2Key } = (await res.json()) as { uploadUrl: string; r2Key: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!put.ok) throw new Error(`Storage PUT failed (${put.status})`);
  return r2Key;
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
      resolve();
    };
    const onErr = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
      reject(new Error('Seek failed while extracting frames.'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onErr);
    video.currentTime = t;
  });
}

async function extractFrames(
  file: File,
  onProgress: (done: number, total: number) => void,
): Promise<{ blobs: Blob[]; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  (video as HTMLVideoElement & { playsInline: boolean }).playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Could not read that video file.'));
    });
    const dur = video.duration;
    if (!Number.isFinite(dur) || dur <= 0) throw new Error('Video has no readable duration.');
    const scale = Math.min(1, FRAME_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.max(2, Math.round(video.videoWidth * scale));
    const h = Math.max(2, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available.');
    // High-quality resampling when a source larger than FRAME_MAX_EDGE is scaled down.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const N = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.round(dur * FPS)));
    const blobs: Blob[] = [];
    for (let i = 0; i < N; i++) {
      const t = Math.min((i / (N - 1)) * dur, Math.max(0, dur - 0.03));
      await seek(video, t);
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Frame encode failed.'))), 'image/jpeg', FRAME_JPEG_QUALITY),
      );
      blobs.push(blob);
      onProgress(i + 1, N);
    }
    return { blobs, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadFrames(
  blobs: Blob[],
  sessionId: string,
  onProgress: (done: number, total: number) => void,
): Promise<string[]> {
  const keys: string[] = new Array(blobs.length);
  let done = 0;
  let next = 0;
  async function worker() {
    while (next < blobs.length) {
      const i = next++;
      const name = `f-${String(i).padStart(4, '0')}.jpg`;
      keys[i] = await presignAndPut(blobs[i]!, `hero-frames/${sessionId}`, name, 'image/jpeg');
      done++;
      onProgress(done, blobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(FRAME_UPLOAD_CONCURRENCY, blobs.length) }, worker));
  return keys;
}

export function HeroUploader({ initialPublished, initialFrameCount }: { initialPublished: boolean; initialFrameCount: number }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [frameCount, setFrameCount] = useState(initialFrameCount);
  const [published, setPublished] = useState(initialPublished);
  const [busyPublish, setBusyPublish] = useState(false);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      setPhase('uploading-video');
      setMsg('Uploading your video…');
      setPct(0);
      const videoKey = await presignAndPut(file, 'hero-videos', file.name || 'hero.mp4', file.type || 'video/mp4');

      setPhase('extracting');
      setMsg('Extracting frames in your browser…');
      const { blobs, width, height } = await extractFrames(file, (d, t) => setPct(Math.round((d / t) * 100)));

      setPhase('uploading-frames');
      setMsg(`Uploading ${blobs.length} frames…`);
      setPct(0);
      const sessionId = `${Date.now().toString(36)}-${Math.round(width)}x${Math.round(height)}`;
      const frameKeys = await uploadFrames(blobs, sessionId, (d, t) => setPct(Math.round((d / t) * 100)));

      setPhase('saving');
      setMsg('Saving…');
      const result = await saveHeroVideo({
        videoKey,
        videoMime: file.type || 'video/mp4',
        frameKeys,
        frameWidth: width,
        frameHeight: height,
      });
      if (!result.ok) throw new Error(result.error);

      setFrameCount(frameKeys.length);
      setPublished(false);
      setPhase('done');
      setMsg(`Ready — ${frameKeys.length} frames extracted. Click Publish to make it live.`);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  async function onTogglePublish(next: boolean) {
    setBusyPublish(true);
    setError('');
    const result = await toggleHeroPublish(next);
    setBusyPublish(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPublished(next);
  }

  const working = phase === 'uploading-video' || phase === 'extracting' || phase === 'uploading-frames' || phase === 'saving';

  return (
    <div className="rounded-2xl border border-[var(--m-line,#e2ded4)] bg-white p-6 max-w-2xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-sm font-medium text-[var(--m-ink,#1e2229)]">Homepage hero video</div>
          <div className="text-[13px] text-[var(--m-slate,#4f535b)] mt-0.5">
            {frameCount > 0
              ? `${frameCount} frames stored · ${published ? 'LIVE on the homepage' : 'draft (not live)'}`
              : 'No video yet — upload one to replace the homepage hero.'}
          </div>
        </div>
        <span
          className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{
            background: published ? 'rgba(60,140,90,.12)' : 'rgba(0,0,0,.05)',
            color: published ? '#2f7d4f' : '#6a6e76',
          }}
        >
          {published ? '● Live' : 'Draft'}
        </span>
      </div>

      <label
        className="block cursor-pointer rounded-xl border-2 border-dashed border-[var(--m-line,#e2ded4)] px-6 py-8 text-center hover:border-[var(--m-orange,#c5a059)] transition-colors"
        style={{ opacity: working ? 0.6 : 1, pointerEvents: working ? 'none' : 'auto' }}
      >
        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={onPick} disabled={working} />
        <div className="text-[var(--m-ink,#1e2229)] font-medium">{working ? 'Working…' : 'Upload a video'}</div>
        <div className="text-[13px] text-[var(--m-slate,#4f535b)] mt-1">
          MP4 / WebM / MOV · up to 60 MB · use a high-res source (1080p+, 1:1 square ideal) and keep it short (~4–6s) — it plays full-screen, so a low-res clip will look pixelated
        </div>
      </label>

      {working && (
        <div className="mt-4">
          <div className="text-[13px] text-[var(--m-slate,#4f535b)] mb-1.5">{msg}</div>
          <div className="h-2 rounded-full bg-[var(--m-line,#eee)] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--m-orange,#c5a059)' }} />
          </div>
        </div>
      )}

      {phase === 'done' && <div className="mt-4 text-[13px] text-[#2f7d4f]">{msg}</div>}
      {error && <div className="mt-4 text-[13px] text-[#b4252f]">{error}</div>}

      <div className="mt-6 flex items-center gap-3">
        {frameCount > 0 && !published && (
          <button
            type="button"
            onClick={() => onTogglePublish(true)}
            disabled={busyPublish || working}
            className="m-btn m-btn-primary px-5 py-2.5 text-sm rounded-full"
            style={{ opacity: busyPublish || working ? 0.6 : 1 }}
          >
            {busyPublish ? 'Publishing…' : 'Publish to homepage'}
          </button>
        )}
        {published && (
          <button
            type="button"
            onClick={() => onTogglePublish(false)}
            disabled={busyPublish}
            className="px-5 py-2.5 text-sm rounded-full border border-[var(--m-line,#e2ded4)] text-[var(--m-slate,#4f535b)]"
            style={{ opacity: busyPublish ? 0.6 : 1 }}
          >
            {busyPublish ? 'Unpublishing…' : 'Unpublish (restore default hero)'}
          </button>
        )}
      </div>
    </div>
  );
}
