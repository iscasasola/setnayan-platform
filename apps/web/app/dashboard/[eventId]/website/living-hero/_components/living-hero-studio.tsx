'use client';

// ============================================================================
// Living Hero Studio (iteration 0046) — the couple picks a ≤5s moment, the
// browser bakes it into a forward→reverse boomerang + a freeze still, and both
// save as the website hero. No server video pipeline; photo-first fallback.
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import {
  bakeBoomerang,
  captureFreezeFrame,
  boomerangSupported,
  EncoderUnsupportedError,
  MAX_CLIP_SECONDS,
  type BakeResult,
} from '@/lib/boomerang-encoder';
import { saveLivingHero } from '../actions';

type Phase = 'idle' | 'ready' | 'baking' | 'preview' | 'saving' | 'done' | 'error';

function fmt(t: number): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// POST to /api/upload → presigned PUT → returns the r2://bucket/key ref to persist.
async function presignAndPut(body: Blob, pathPrefix: string, filename: string): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket: 'media',
      pathPrefix,
      filename,
      contentType: body.type,
      sizeBytes: body.size,
    }),
  });
  if (!res.ok) throw new Error((await res.json())?.error || `Upload failed (${res.status})`);
  const { uploadUrl, r2Ref } = (await res.json()) as { uploadUrl: string; r2Ref: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': body.type }, body });
  if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
  return r2Ref;
}

export function LivingHeroStudio({
  eventId,
  currentClipUrl,
  currentStillUrl,
}: {
  eventId: string;
  currentClipUrl: string | null;
  currentStillUrl: string | null;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [freeze, setFreeze] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bakedUrl, setBakedUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const baked = useRef<BakeResult | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);

  const supported = typeof window !== 'undefined' ? boomerangSupported() : true;
  const windowLen = Math.min(MAX_CLIP_SECONDS, duration || MAX_CLIP_SECONDS);

  const seekPreview = (t: number) => {
    const v = previewRef.current;
    if (v && Number.isFinite(v.duration)) v.currentTime = Math.min(t, v.duration - 0.01);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    baked.current = null;
    setBakedUrl(null);
    setError(null);
    setFile(f);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(f));
    setPhase('ready');
  };

  const onLoadedMeta = () => {
    const v = previewRef.current;
    if (!v) return;
    const dur = Number.isFinite(v.duration) ? v.duration : MAX_CLIP_SECONDS;
    setDuration(dur);
    const win = Math.min(MAX_CLIP_SECONDS, dur);
    setStart(0);
    setFreeze(win / 2);
    v.currentTime = win / 2;
  };

  const reset = () => {
    if (bakedUrl) URL.revokeObjectURL(bakedUrl);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    baked.current = null;
    setBakedUrl(null);
    setFile(null);
    setFileUrl(null);
    setPhase('idle');
    setError(null);
    setProgress(0);
  };

  const onBake = useCallback(async () => {
    if (!file) return;
    setPhase('baking');
    setProgress(0);
    setError(null);
    try {
      const result = await bakeBoomerang({
        file,
        startSec: start,
        durationSec: windowLen,
        freezeSec: freeze,
        onProgress: setProgress,
      });
      baked.current = result;
      setBakedUrl(URL.createObjectURL(result.boomerang));
      setPhase('preview');
    } catch (err) {
      if (err instanceof EncoderUnsupportedError) {
        // Device can't encode — fall straight through to the photo path.
        await onUsePhoto();
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, start, windowLen, freeze]);

  const onSaveBoomerang = async () => {
    if (!baked.current) return;
    setPhase('saving');
    try {
      const clipRef = await presignAndPut(baked.current.boomerang, 'living-heroes', 'hero.mp4');
      const stillRef = await presignAndPut(baked.current.still, 'living-heroes', 'hero.jpg');
      const r = await saveLivingHero(eventId, clipRef, stillRef);
      if (!r.ok) throw new Error(r.error || 'Could not save.');
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setPhase('error');
    }
  };

  const onUsePhoto = async () => {
    if (!file) return;
    setPhase('saving');
    try {
      const { still } = await captureFreezeFrame(file, freeze);
      const stillRef = await presignAndPut(still, 'living-heroes', 'hero.jpg');
      const r = await saveLivingHero(eventId, null, stillRef);
      if (!r.ok) throw new Error(r.error || 'Could not save.');
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setPhase('error');
    }
  };

  const card = 'rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6';
  const primaryBtn =
    'inline-flex h-11 items-center justify-center rounded-lg border border-burgundy/20 bg-burgundy px-5 text-sm font-semibold text-cream transition hover:bg-burgundy/90 disabled:opacity-50';
  const ghostBtn =
    'inline-flex h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-5 text-sm font-medium text-ink/75 transition hover:bg-cream';
  // Hoist before JSX to avoid TypeScript narrowing the type away inside
  // phase-guarded blocks (e.g. `phase === 'ready'` narrows phase, making
  // `phase === 'saving'` always-false inside that branch).
  const isSaving = phase === 'saving';

  return (
    <div className="space-y-5">
      {/* Current state */}
      {(currentClipUrl || currentStillUrl) && phase === 'idle' ? (
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/55">Your hero now</p>
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl bg-ink/5">
            {currentClipUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={currentClipUrl}
                poster={currentStillUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            ) : currentStillUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentStillUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <p className="mt-2 text-sm text-ink/55">
            {currentClipUrl ? 'A living hero is set. Pick a new clip to replace it.' : 'A still photo is set.'}
          </p>
        </div>
      ) : null}

      {/* Pick */}
      {phase === 'idle' ? (
        <div className={card}>
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-ink/15 p-8 text-center transition hover:border-ink/30">
            <input type="file" accept="video/*" onChange={onPick} className="hidden" />
            <p className="text-sm font-semibold text-ink">Choose a video</p>
            <p className="mt-1 text-sm text-ink/55">
              We&rsquo;ll use up to {MAX_CLIP_SECONDS} seconds of it. Everything happens on your device —
              nothing uploads until you save.
            </p>
          </label>
          {!supported ? (
            <p className="mt-3 text-xs text-warn-700">
              Heads up: this browser can&rsquo;t make a moving hero, so we&rsquo;ll save your chosen frame as a
              photo instead.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Trim + freeze */}
      {phase === 'ready' || phase === 'baking' ? (
        <div className={card}>
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={previewRef}
              src={fileUrl ?? undefined}
              onLoadedMetadata={onLoadedMeta}
              muted
              playsInline
              className="h-full w-full object-contain"
            />
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">Start of your {Math.round(windowLen)}s</span>
                <span className="tabular-nums text-ink/55">
                  {fmt(start)} – {fmt(start + windowLen)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, duration - windowLen)}
                step={0.1}
                value={start}
                disabled={phase === 'baking'}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setStart(v);
                  if (freeze < v || freeze > v + windowLen) setFreeze(v + windowLen / 2);
                  seekPreview(v);
                }}
                className="mt-2 w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">Freeze frame (your photo)</span>
                <span className="tabular-nums text-ink/55">{fmt(freeze)}</span>
              </div>
              <input
                type="range"
                min={start}
                max={start + windowLen}
                step={0.05}
                value={freeze}
                disabled={phase === 'baking'}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFreeze(v);
                  seekPreview(v);
                }}
                className="mt-2 w-full"
              />
              <p className="mt-1 text-xs text-ink/55">
                This frame is your printed photo, the poster, and what shows on slow connections.
              </p>
            </div>

            {phase === 'baking' ? (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className="h-full rounded-full bg-burgundy transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-ink/55">Making it move… {Math.round(progress * 100)}%</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {supported ? (
                  <button type="button" onClick={onBake} disabled={isSaving} className={primaryBtn}>
                    Make it move
                  </button>
                ) : null}
                <button type="button" onClick={onUsePhoto} disabled={isSaving} className={supported ? ghostBtn : primaryBtn}>
                  Use a photo instead
                </button>
                <button type="button" onClick={reset} className={ghostBtn}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Preview baked boomerang */}
      {phase === 'preview' && bakedUrl ? (
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/55">Your living hero</p>
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={bakedUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
          </div>
          <p className="mt-2 text-sm text-ink/55">It plays forward, then reverses — on a gentle loop.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={onSaveBoomerang} disabled={isSaving} className={primaryBtn}>
              Save as my hero
            </button>
            <button type="button" onClick={reset} className={ghostBtn}>
              Start over
            </button>
          </div>
        </div>
      ) : null}

      {/* Saving / done / error */}
      {phase === 'saving' ? (
        <div className={card}>
          <p className="text-sm text-ink/70">Saving your hero…</p>
        </div>
      ) : null}
      {phase === 'done' ? (
        <div className={`${card} border-green-200 bg-green-50`}>
          <p className="text-sm font-semibold text-green-800">Saved. Your wedding page now leads with it.</p>
          <button type="button" onClick={reset} className={`${ghostBtn} mt-3`}>
            Change it again
          </button>
        </div>
      ) : null}
      {phase === 'error' ? (
        <div className={`${card} border-red-200 bg-red-50`}>
          <p className="text-sm font-semibold text-red-800">{error ?? 'Something went wrong.'}</p>
          <button type="button" onClick={reset} className={`${ghostBtn} mt-3`}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
