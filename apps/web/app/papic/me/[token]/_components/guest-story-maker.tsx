'use client';

// Guest Stories (FREE tier) — the "Make my Story" surface on the guest's
// personal camera/gallery page.
//
// One tap auto-builds a 30s, 9:16 reel from the guest's tagged Papic photos,
// rendered ENTIRELY IN THE BROWSER (lib/reel-render.ts — WebCodecs→mp4,
// MediaRecorder fallback) over a Setnayan-owned music track, with cuts snapped
// to the track's beat grid. No server render, no paywall — this is the free
// viral loop. Finished reel → one-tap share (native share sheet → "Save to
// Photos") + download.
//
// The render plan (presigned photo URLs + template + music) is assembled
// server-side by prepareGuestStory(token); the token is the guest's existing
// capability, so nothing trusts a client-supplied id.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Film,
  Loader2,
  RotateCcw,
  Share2,
  Sparkles,
} from 'lucide-react';
import { renderReel, type RenderTemplate } from '@/lib/reel-render';
import { shareBlobToDevice } from '@/lib/save-to-device';
import { prepareGuestStory } from '../actions';
import { STORY_MIN_PHOTOS } from '@/lib/stories-templates';
import { defaultCameraMove } from '@/lib/stories-camera-move';

type Phase = 'idle' | 'preparing' | 'rendering' | 'ready' | 'too_few' | 'error';

export function GuestStoryMaker({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
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
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      setPreviewUrl(null);
    }
    try {
      const plan = await prepareGuestStory(token);
      setPhotoCount(plan.taggedPhotoCount);
      if (!plan.canRender || plan.photos.length < STORY_MIN_PHOTOS) {
        setPhase('too_few');
        return;
      }

      const template: RenderTemplate = {
        slug: plan.template.slug,
        name: plan.template.name,
        palette: plan.template.palette,
        footerLabel: 'Stories · Setnayan',
      };

      setPhase('rendering');
      const result = await renderReel({
        clips: plan.photos.map((p, i) => ({
          clipId: p.id,
          url: p.url,
          durationSec: null,
          kind: 'photo' as const,
          // §16.9 — each still gets a deterministic camera move so the reel
          // reads as filmed, not slideshowed. ₱0 per render.
          cameraMove: defaultCameraMove(i),
        })),
        template,
        durationSec: plan.template.durationSec,
        musicUrl: plan.music?.url ?? null,
        beatGrid: plan.music?.beatGrid ?? null,
        beatsPerCut: plan.template.beatsPerCut,
        onProgress: setProgress,
      });

      blobRef.current = result.blob;
      const objUrl = URL.createObjectURL(result.blob);
      setPreviewUrl(objUrl);
      setPhase('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not make your Story.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [token]);

  const onShare = useCallback(async () => {
    if (!blobRef.current) return;
    await shareBlobToDevice(blobRef.current, 'my-story');
  }, []);

  const busy = phase === 'preparing' || phase === 'rendering';
  const pct = Math.round(progress * 100);

  return (
    <section
      aria-label="Make my Story"
      className="mt-6 rounded-2xl border border-mulberry/25 bg-mulberry/5 p-5"
    >
      <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <Film aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
        Make my Story
      </h2>

      {phase === 'idle' ? (
        <>
          <p className="mt-2 text-sm text-ink/65">
            Turn your tagged photos into a 30-second reel set to music — made
            right here on your phone, free. Share it the moment it&rsquo;s done.
          </p>
          <button
            type="button"
            onClick={run}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Make my Story
          </button>
        </>
      ) : null}

      {busy ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-ink/70">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
            {phase === 'preparing'
              ? 'Gathering your photos…'
              : `Making your Story… ${pct}%`}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-mulberry transition-[width] duration-200"
              style={{ width: `${phase === 'preparing' ? 8 : pct}%` }}
            />
          </div>
          <p className="text-xs text-ink/50">
            Keep this page open while it works — best on a recent phone.
          </p>
        </div>
      ) : null}

      {phase === 'too_few' ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink/65">
            {photoCount && photoCount > 0
              ? `You're tagged in ${photoCount.toLocaleString()} photo${
                  photoCount === 1 ? '' : 's'
                } so far — you'll need at least ${STORY_MIN_PHOTOS} to make a Story. Check back as more roll in.`
              : `No tagged photos of you just yet. Once you're tagged in a few, come back and make your Story — you'll need at least ${STORY_MIN_PHOTOS}.`}
          </p>
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
          >
            <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Check again
          </button>
        </div>
      ) : null}

      {phase === 'ready' && previewUrl ? (
        <div className="mt-3 space-y-3">
          <div className="mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-xl bg-ink">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              className="h-full w-full object-cover"
              src={previewUrl}
              controls
              playsInline
              autoPlay
              loop
              muted
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
            >
              <Share2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Share my Story
            </button>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
            >
              <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Save
            </button>
            <button
              type="button"
              onClick={run}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
            >
              <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Make again
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'error' && errorMsg ? (
        <div className="mt-3 space-y-2">
          <p
            role="alert"
            className="inline-flex items-start gap-2 rounded-xl border border-danger-300/70 bg-danger-50 px-3 py-2 text-sm text-danger-900"
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
