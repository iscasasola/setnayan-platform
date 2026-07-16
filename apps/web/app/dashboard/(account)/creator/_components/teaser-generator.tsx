'use client';

// Creator Adventure-Chapter TEASER — client render orchestrator (CP-2).
//
// Drives the client-side render of a chapter's owned-music teaser:
//   prepare (server plan) → render (WebCodecs mp4 / MediaRecorder webm) →
//   upload the blob to R2 → finalize (server sets teaser_r2_key).
// The heavy encode lives in lib/reel-render.ts (₱0 server compute); this owns
// the UX + the upload/finalize plumbing. Same shape as the Patiktok renderer.
//
// OWNED MUSIC ONLY: the plan's `musicUrl` comes exclusively from the server
// (lib/creator-teaser → the Setnayan-owned reel_music_tracks catalogue). This
// component never reads a file input or any creator-supplied audio.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clapperboard,
  Download,
  Loader2,
  Music2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { renderReel, type RenderClip } from '@/lib/reel-render';
import { defaultCameraMove } from '@/lib/stories-camera-move';
import { TEASER_FOOTER, TEASER_PALETTE } from '@/lib/creator-teaser';
import { prepareChapterTeaser, finalizeChapterTeaser } from '../actions';

type Phase = 'idle' | 'preparing' | 'rendering' | 'uploading' | 'done' | 'error';

/** Draw a 1080×1920 "Made with Setnayan" end card → PNG data URL (no taint). */
function buildEndCardDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const [obsidian, gold] = TEASER_PALETTE;
  ctx.fillStyle = obsidian;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.font = '300 42px system-ui, sans-serif';
  ctx.fillText('Made with', 540, 900);
  ctx.fillStyle = gold;
  ctx.font = '700 118px system-ui, sans-serif';
  ctx.fillText('SETNAYAN', 540, 1030);
  ctx.fillStyle = gold;
  ctx.fillRect(430, 1080, 220, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.font = '400 30px system-ui, sans-serif';
  ctx.fillText('Plan yours at setnayan.com', 540, 1140);
  return canvas.toDataURL('image/png');
}

export function TeaserGenerator({
  chapterId,
  existingTeaserUrl,
}: {
  chapterId: string;
  existingTeaserUrl: string | null;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [musicLabel, setMusicLabel] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(existingTeaserUrl);
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
    setReason(null);
    setProgress(0);
    setPhase('preparing');
    try {
      const plan = await prepareChapterTeaser(chapterId);
      if (!plan.canRender) {
        setReason(plan.reason ?? 'This chapter can’t make a teaser yet.');
        setPhase('idle');
        return;
      }
      setMusicLabel(plan.musicLabel);

      // Photos → montage slots (each a still with a deterministic camera move),
      // then the "Made with Setnayan" end card as the final rigid slot.
      const clips: RenderClip[] = plan.photos.map((p, i) => ({
        clipId: p.clipId,
        url: p.url,
        durationSec: null,
        kind: 'photo',
        cameraMove: defaultCameraMove(i),
      }));
      const endCard = buildEndCardDataUrl();
      if (endCard) {
        clips.push({ clipId: 'endcard', url: endCard, durationSec: null, kind: 'photo' });
      }

      setPhase('rendering');
      const result = await renderReel({
        clips,
        template: {
          slug: 'creator-teaser',
          name: 'Adventure teaser',
          palette: TEASER_PALETTE,
          footerLabel: TEASER_FOOTER,
        },
        durationSec: plan.targetSec,
        musicUrl: plan.musicUrl,
        beatGrid: plan.beatGrid,
        onProgress: setProgress,
      });

      setPhase('uploading');
      const presignRes = await fetch('/api/creator/teaser-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          contentType: result.mimeType,
          sizeBytes: result.blob.size,
        }),
      });
      if (!presignRes.ok) {
        const b = (await presignRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `teaser upload presign failed (${presignRes.status})`);
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
        throw new Error(`teaser upload to storage failed (${putRes.status})`);
      }

      const fin = await finalizeChapterTeaser({ chapterId, bucket, key });

      const objUrl = URL.createObjectURL(result.blob);
      setPreviewUrl(objUrl);
      setSavedUrl(fin.downloadUrl ?? objUrl);
      setPhase('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Teaser render failed.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [chapterId]);

  const busy = phase === 'preparing' || phase === 'rendering' || phase === 'uploading';
  const pct = Math.round(progress * 100);
  const activeUrl = previewUrl ?? savedUrl;

  return (
    <section className="space-y-3 rounded-tile border border-ink/10 bg-ink/[0.02] p-4">
      <div className="space-y-1">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Clapperboard aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
          Owned-music teaser
        </h3>
        <p className="text-[11px] text-ink/55">
          A short Setnayan-hosted clip from this chapter’s Papic gallery, set to a
          Setnayan-owned track — the “made with Setnayan” hook you share. Renders
          in your browser; keep this tab open. Your full edit stays embedded on
          your own platform.
        </p>
      </div>

      {activeUrl && !busy ? (
        <div className="mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl bg-ink">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="h-full w-full object-cover" src={activeUrl} controls playsInline />
        </div>
      ) : null}

      {busy ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-ink/70">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
            {phase === 'preparing'
              ? 'Gathering photos + a Setnayan-owned track…'
              : phase === 'rendering'
                ? `Rendering in your browser… ${pct}%`
                : 'Saving your teaser…'}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-mulberry transition-[width] duration-200"
              style={{ width: `${phase === 'uploading' ? 100 : pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {reason && !busy ? (
        <p className="rounded-tile border border-dashed border-ink/15 p-2.5 text-[11px] text-ink/60">
          {reason}
        </p>
      ) : null}

      {phase === 'error' && errorMsg ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-tile border border-danger-300/70 bg-danger-50 px-3 py-2 text-xs text-danger-900"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {errorMsg}
        </p>
      ) : null}

      {musicLabel && phase === 'done' ? (
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
          <Music2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          {musicLabel} · owned catalogue
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-60"
        >
          {activeUrl ? (
            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          ) : (
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {activeUrl ? 'Regenerate teaser' : 'Generate teaser'}
        </button>
        {activeUrl && !busy ? (
          <a
            href={activeUrl}
            download="setnayan-teaser"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
          >
            <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Download
          </a>
        ) : null}
      </div>
    </section>
  );
}
