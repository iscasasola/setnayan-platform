'use client';

// Iteration 0017 PR3 — Patiktok reel renderer (client orchestrator).
//
// Drives the client-side render of a queued job: claim → render (WebCodecs +
// mp4-muxer, MediaRecorder fallback) → upload the MP4 to R2 → finalize the job.
// The heavy lifting lives in lib/patiktok-render.ts; this owns the UX (progress,
// preview, download, retry) and the upload/finalize plumbing.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clapperboard,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { findPatiktokTemplate } from '@/lib/patiktok';
import { renderPatiktokReel } from '@/lib/patiktok-render';
import {
  claimPatiktokRenderJob,
  failPatiktokRenderJob,
  finalizePatiktokRenderJob,
} from '../actions';

type Phase = 'idle' | 'preparing' | 'rendering' | 'uploading' | 'done' | 'error';

const FALLBACK_PALETTE: readonly [string, string, string, string] = [
  '#0F0F0F',
  '#C9A14B',
  '#8B1E3F',
  '#000000',
];

export function ReelRenderer({
  jobId,
  eventId,
}: {
  jobId: string;
  eventId: string;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const run = useCallback(async () => {
    setErrorMsg(null);
    setProgress(0);
    setPhase('preparing');
    try {
      const claimed = await claimPatiktokRenderJob(jobId);
      const tpl = findPatiktokTemplate(claimed.templateSlug);
      const template = {
        slug: claimed.templateSlug,
        name: tpl?.name ?? claimed.templateSlug,
        palette: tpl?.palette ?? FALLBACK_PALETTE,
      };

      setPhase('rendering');
      const result = await renderPatiktokReel({
        clips: claimed.clips,
        template,
        durationSec: claimed.durationSec,
        musicUrl: claimed.musicUrl,
        onProgress: setProgress,
      });
      setRenderMode(result.renderMode);

      setPhase('uploading');
      const presignRes = await fetch('/api/patiktok/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId,
          kind: 'reel',
          jobId,
          contentType: result.mimeType,
          sizeBytes: result.blob.size,
        }),
      });
      if (!presignRes.ok) {
        const b = (await presignRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `reel upload presign failed (${presignRes.status})`);
      }
      const { uploadUrl, bucket, key } = (await presignRes.json()) as {
        uploadUrl: string;
        bucket: string;
        key: string;
      };
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': result.mimeType },
        body: result.blob,
      });
      if (!putRes.ok) {
        throw new Error(`reel upload to storage failed (${putRes.status})`);
      }

      const fin = await finalizePatiktokRenderJob({
        jobId,
        bucket,
        key,
        bytes: result.blob.size,
        durationSec: result.durationSec,
        renderMode: result.renderMode,
        clipIds: claimed.clips.map((c) => c.clipId),
      });

      const objUrl = URL.createObjectURL(result.blob);
      setPreviewUrl(objUrl);
      setDownloadUrl(fin.downloadUrl);
      setPhase('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Render failed.';
      setErrorMsg(msg);
      setPhase('error');
      try {
        await failPatiktokRenderJob({ jobId, reason: msg });
      } catch {
        /* best-effort */
      }
    }
  }, [eventId, jobId]);

  const busy = phase === 'preparing' || phase === 'rendering' || phase === 'uploading';
  const pct = Math.round(progress * 100);

  return (
    <section className="space-y-3 rounded-2xl border border-mulberry/30 bg-mulberry/5 p-5">
      <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
        <Clapperboard aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
        Render this reel
      </h2>

      {phase === 'idle' ? (
        <>
          <p className="text-sm text-ink/65">
            Your reel renders right here in this browser — no server, no wait
            queue. Keep this tab open while it works ({/* */}best on a laptop or
            a recent phone).
          </p>
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Render now
          </button>
        </>
      ) : null}

      {busy ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-ink/70">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
            {phase === 'preparing'
              ? 'Preparing your clips…'
              : phase === 'rendering'
                ? `Rendering in your browser… ${pct}%`
                : 'Uploading your reel…'}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-mulberry transition-[width] duration-200"
              style={{ width: `${phase === 'uploading' ? 100 : pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {phase === 'done' && previewUrl ? (
        <div className="space-y-3">
          <div className="mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-xl bg-ink">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              className="h-full w-full object-cover"
              src={previewUrl}
              controls
              playsInline
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={previewUrl}
              download="patiktok-reel.mp4"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-emerald-800"
            >
              <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Download reel
            </a>
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
              >
                Open saved copy
              </a>
            ) : null}
            <button
              type="button"
              onClick={run}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
            >
              <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Render again
            </button>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
            Saved to your event gallery{renderMode ? ` · ${renderMode.replace('client_', '')}` : ''}
          </p>
        </div>
      ) : null}

      {phase === 'error' && errorMsg ? (
        <div className="space-y-2">
          <p
            role="alert"
            className="inline-flex items-start gap-2 rounded-xl border border-rose-300/70 bg-rose-50 px-3 py-2 text-sm text-rose-900"
          >
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
