'use client';

// Guest Stories (FREE tier) — the "Make my Story" surface on the guest's
// personal camera/gallery page.
//
// One tap auto-builds a 30s, 9:16 reel from the guest's tagged Papic photos,
// rendered ENTIRELY IN THE BROWSER (lib/reel-render.ts — WebCodecs→mp4,
// MediaRecorder fallback) over a Setnayan-owned music track, with cuts snapped
// to the track's beat grid. No server render, no paywall — this is the free
// viral loop. Finished reel → one-tap share (native share sheet → "Save to
// Photos") + download. DOWNLOAD-ONLY: the finished file NEVER uploads to R2,
// never lands in a DB row, never joins a hosted feed (owner-locked; the
// Patiktok branch of the same engine DOES upload — do not copy it here).
//
// PICKER (owner 2026-07-23): besides the one-tap auto build, the guest can
// CHOOSE their own mix — up to STORY_MAX_PHOTOS of their tagged photos AND
// clips (clips come only as geo-stripped web copies, server-filtered) — and
// pick the music: an owned-catalogue track OR their own upload. The BYO upload
// follows the §16.7 client-side rule: the file is turned into an object URL
// and handed straight to the in-browser renderer — IT NEVER LEAVES THE DEVICE
// (no upload request of any kind), which is what keeps Setnayan a
// not-distributor of the guest's music.
//
// The render plan (presigned media URLs + template + music options) is
// assembled server-side by prepareGuestStory(token); the token is the guest's
// existing capability, so nothing trusts a client-supplied id.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Film,
  Loader2,
  ListChecks,
  Music,
  RotateCcw,
  Share2,
  Sparkles,
} from 'lucide-react';
import { renderReel, type RenderClip, type RenderTemplate } from '@/lib/reel-render';
import { shareBlobToDevice } from '@/lib/save-to-device';
import { prepareGuestStory } from '../actions';
import type { GuestStoryPlan, StoryMediaItem, StoryMusic } from '@/lib/guest-stories';
import { STORY_MIN_PHOTOS, STORY_MAX_PHOTOS } from '@/lib/stories-templates';
import { storySelectionState } from '@/lib/guest-stories-media-set';
import { defaultCameraMove } from '@/lib/stories-camera-move';

type Phase = 'idle' | 'preparing' | 'pick' | 'rendering' | 'ready' | 'too_few' | 'error';

/** Which music feeds the render: the plan default, a chosen catalogue track,
 *  the guest's own client-side upload, or silence. */
type MusicChoice =
  | { type: 'default' }
  | { type: 'track'; track: StoryMusic }
  | { type: 'byo' }
  | { type: 'silent' };

/** A still photo as a render source (pure — shared by auto + picker paths). */
function photoClip(
  p: { id: string; url: string; subjectCenter?: { x: number; y: number } | null },
  i: number,
): RenderClip {
  return {
    clipId: p.id,
    url: p.url,
    durationSec: null,
    kind: 'photo' as const,
    // §16.9 — each still gets a deterministic camera move so the reel
    // reads as filmed, not slideshowed. ₱0 per render.
    cameraMove: defaultCameraMove(i),
    // Tier-2 auto-reframe: frame the move on the detected face when known
    // (null → reel-render uses its centered default focal).
    subjectCenter: p.subjectCenter ?? null,
  };
}

export function GuestStoryMaker({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [pickableCount, setPickableCount] = useState<number>(0);
  const [plan, setPlan] = useState<GuestStoryPlan | null>(null);
  // Pick order matters — the reel plays in the order the guest tapped.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [musicChoice, setMusicChoice] = useState<MusicChoice>({ type: 'default' });
  // §16.7 BYO — the guest's own audio FILE. Client-side only: it becomes an
  // object URL for the in-browser renderer and NEVER leaves the device.
  const [byoFile, setByoFile] = useState<File | null>(null);
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

  /** Render a list of media items with the given music. Shared by both paths.
   *  `byo` is the guest's own audio file (picker path only) — it becomes an
   *  object URL for the in-browser renderer, revoked right after. No
   *  fetch/upload of the file ever happens (§16.7 client-side-only rule). */
  const renderStory = useCallback(
    async (
      activePlan: GuestStoryPlan,
      items: RenderClip[],
      music: StoryMusic | null,
      byo: File | null = null,
    ) => {
      const template: RenderTemplate = {
        slug: activePlan.template.slug,
        name: activePlan.template.name,
        palette: activePlan.template.palette,
        footerLabel: 'Stories · Setnayan',
      };

      setPhase('rendering');
      const byoUrl = byo ? URL.createObjectURL(byo) : null;
      try {
        const result = await renderReel({
          clips: items,
          template,
          durationSec: activePlan.template.durationSec,
          musicUrl: byoUrl ?? music?.url ?? null,
          // The guest's own song has no analyzed grid — even-split fallback.
          beatGrid: byoUrl ? null : (music?.beatGrid ?? null),
          beatsPerCut: activePlan.template.beatsPerCut,
          onProgress: setProgress,
        });
        blobRef.current = result.blob;
        const objUrl = URL.createObjectURL(result.blob);
        setPreviewUrl(objUrl);
        setPhase('ready');
      } finally {
        if (byoUrl) URL.revokeObjectURL(byoUrl);
      }
    },
    [],
  );

  /** The resolved music for the current choice (picker path). */
  const resolveMusic = useCallback(
    (activePlan: GuestStoryPlan): StoryMusic | null => {
      switch (musicChoice.type) {
        case 'track':
          return musicChoice.track;
        case 'silent':
          return null;
        case 'byo':
          return null; // the object URL is injected in renderStory
        default:
          return activePlan.music;
      }
    },
    [musicChoice],
  );

  /** ONE-TAP AUTO PATH — unchanged behavior: all tagged photos, default music. */
  const run = useCallback(async () => {
    setErrorMsg(null);
    setProgress(0);
    setPhase('preparing');
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      setPreviewUrl(null);
    }
    try {
      const freshPlan = await prepareGuestStory(token);
      setPlan(freshPlan);
      setPhotoCount(freshPlan.taggedPhotoCount);
      setPickableCount(freshPlan.media.length);
      if (!freshPlan.canRender || freshPlan.photos.length < STORY_MIN_PHOTOS) {
        setPhase('too_few');
        return;
      }
      await renderStory(freshPlan, freshPlan.photos.map(photoClip), freshPlan.music);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not make your Story.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [token, renderStory]);

  /** PICKER PATH step 1 — prepare the plan, then show the selection grid. */
  const openPicker = useCallback(async () => {
    setErrorMsg(null);
    setProgress(0);
    setPhase('preparing');
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      setPreviewUrl(null);
    }
    try {
      const freshPlan = await prepareGuestStory(token);
      setPlan(freshPlan);
      setPhotoCount(freshPlan.taggedPhotoCount);
      setPickableCount(freshPlan.media.length);
      if (freshPlan.media.length < STORY_MIN_PHOTOS) {
        setPhase('too_few');
        return;
      }
      setSelectedIds([]);
      setMusicChoice({ type: 'default' });
      setPhase('pick');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load your photos.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [token]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (!storySelectionState(prev.length, { min: STORY_MIN_PHOTOS, max: STORY_MAX_PHOTOS }).canAddMore) {
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  /** PICKER PATH step 2 — render the guest's own pick with their music. */
  const runPicked = useCallback(async () => {
    if (!plan) return;
    const byId = new Map(plan.media.map((m) => [m.id, m]));
    const picked = selectedIds
      .map((id) => byId.get(id))
      .filter((m): m is StoryMediaItem => Boolean(m));
    if (picked.length < STORY_MIN_PHOTOS) return;
    setErrorMsg(null);
    setProgress(0);
    try {
      let photoIdx = 0;
      const items: RenderClip[] = picked.map((m) =>
        m.kind === 'photo'
          ? photoClip(m, photoIdx++)
          : {
              clipId: m.id,
              url: m.url,
              durationSec: m.durationSec,
              kind: 'clip' as const,
            },
      );
      await renderStory(
        plan,
        items,
        resolveMusic(plan),
        musicChoice.type === 'byo' ? byoFile : null,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not make your Story.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [plan, selectedIds, renderStory, resolveMusic, musicChoice, byoFile]);

  const onShare = useCallback(async () => {
    if (!blobRef.current) return;
    await shareBlobToDevice(blobRef.current, 'my-story');
  }, []);

  const busy = phase === 'preparing' || phase === 'rendering';
  const pct = Math.round(progress * 100);
  const selState = storySelectionState(selectedIds.length, {
    min: STORY_MIN_PHOTOS,
    max: STORY_MAX_PHOTOS,
  });

  return (
    <section
      id="story"
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
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
            >
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Make my Story
            </button>
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
            >
              <ListChecks aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Choose photos &amp; music
            </button>
          </div>
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

      {phase === 'pick' && plan ? (
        <div className="mt-3 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink/80">
                Pick your moments — any mix of photos and clips
              </p>
              <span
                className={`font-mono text-xs ${
                  selState.canRender ? 'text-mulberry' : 'text-ink/50'
                }`}
              >
                {selectedIds.length}/{STORY_MAX_PHOTOS}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink/50">
              Tap up to {STORY_MAX_PHOTOS} — at least {STORY_MIN_PHOTOS} to make a
              Story. They play in the order you pick.
            </p>
            <ul className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {plan.media.map((m) => {
                const pickIndex = selectedIds.indexOf(m.id);
                const isPicked = pickIndex >= 0;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(m.id)}
                      aria-pressed={isPicked}
                      aria-label={
                        m.kind === 'clip'
                          ? `Clip${m.durationSec ? ` · ${Math.round(m.durationSec)}s` : ''}`
                          : 'Photo'
                      }
                      className={`relative block aspect-square w-full overflow-hidden rounded-lg border transition ${
                        isPicked
                          ? 'border-mulberry ring-2 ring-mulberry/60'
                          : 'border-ink/10 hover:border-mulberry/40'
                      }`}
                    >
                      {m.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.thumbUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-ink/10">
                          <Film aria-hidden className="h-5 w-5 text-ink/40" strokeWidth={1.75} />
                        </span>
                      )}
                      {m.kind === 'clip' ? (
                        <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-ink/70 px-1 py-0.5 text-[10px] font-medium text-cream">
                          <Film aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
                          {m.durationSec ? `${Math.round(m.durationSec)}s` : 'clip'}
                        </span>
                      ) : null}
                      {isPicked ? (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-mulberry text-[11px] font-semibold text-cream">
                          {pickIndex + 1}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/80">
              <Music aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
              Music
            </p>
            <div className="mt-2 space-y-1.5">
              {plan.music ? (
                <MusicOption
                  label={plan.music.displayName}
                  hint="Recommended"
                  active={
                    musicChoice.type === 'default' ||
                    (musicChoice.type === 'track' &&
                      musicChoice.track.trackSlug === plan.music.trackSlug)
                  }
                  onSelect={() => setMusicChoice({ type: 'default' })}
                />
              ) : null}
              {plan.musicOptions
                .filter((t) => t.trackSlug !== plan.music?.trackSlug)
                .map((t) => (
                  <MusicOption
                    key={t.trackSlug}
                    label={t.displayName}
                    active={
                      musicChoice.type === 'track' &&
                      musicChoice.track.trackSlug === t.trackSlug
                    }
                    onSelect={() => setMusicChoice({ type: 'track', track: t })}
                  />
                ))}
              <MusicOption
                label="No music"
                active={musicChoice.type === 'silent'}
                onSelect={() => setMusicChoice({ type: 'silent' })}
              />
              {/* §16.7 BYO — client-side ONLY. The file becomes an object URL for
                  the in-browser renderer; there is no upload path, so the
                  guest's song never leaves their phone. */}
              <label
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  musicChoice.type === 'byo'
                    ? 'border-mulberry bg-mulberry/10 text-ink'
                    : 'border-ink/10 text-ink/70 hover:border-mulberry/40'
                }`}
              >
                <span className="min-w-0 truncate">
                  {byoFile ? `Your song: ${byoFile.name}` : 'Use my own song (from this phone)'}
                </span>
                {musicChoice.type === 'byo' ? (
                  <Check aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2} />
                ) : null}
                <input
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) {
                      setByoFile(f);
                      setMusicChoice({ type: 'byo' });
                    }
                  }}
                />
              </label>
              {musicChoice.type === 'byo' ? (
                <p className="text-[11px] text-ink/45">
                  Your song stays on your phone — it&rsquo;s mixed into the video
                  right here and never uploaded.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runPicked()}
              disabled={!selState.canRender || (musicChoice.type === 'byo' && !byoFile)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-40"
            >
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Make my Story
            </button>
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="inline-flex items-center justify-center rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'too_few' ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink/65">
            {photoCount && photoCount > 0
              ? `You're tagged in ${photoCount.toLocaleString()} photo${
                  photoCount === 1 ? '' : 's'
                } so far — you'll need at least ${STORY_MIN_PHOTOS} to make a Story. Check back as more roll in.`
              : pickableCount > 0
                ? `You have ${pickableCount} tagged ${pickableCount === 1 ? 'moment' : 'moments'} so far — you'll need at least ${STORY_MIN_PHOTOS} to make a Story. Check back as more roll in.`
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
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-mulberry/40 hover:text-mulberry"
            >
              <ListChecks aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Choose again
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

function MusicOption({
  label,
  hint,
  active,
  onSelect,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
        active
          ? 'border-mulberry bg-mulberry/10 text-ink'
          : 'border-ink/10 text-ink/70 hover:border-mulberry/40'
      }`}
    >
      <span className="min-w-0 truncate">
        {label}
        {hint ? <span className="ml-1.5 text-[11px] text-ink/45">{hint}</span> : null}
      </span>
      {active ? (
        <Check aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2} />
      ) : null}
    </button>
  );
}
