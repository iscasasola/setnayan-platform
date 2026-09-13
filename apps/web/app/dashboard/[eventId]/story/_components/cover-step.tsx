'use client';

/**
 * THE COVER — the Story Maker's fourth step. PORTED from
 * `prototypes/story-maker.html` (`#p-cover`), not redrawn: the tiles with their
 * source chip and moment label, the "+ Upload another" tile, the three live
 * previews under their own eyebrows, and the closing eligibility line are the
 * prototype's. `02_The_Story_Maker.md` §6 · `08` step 1.5.
 *
 * ── ONE PICTURE, THREE JOBS, AND ALL THREE ARE REAL HERE ────────────────────
 * The prototype paints its three preview frames by swapping one background. So
 * does this — but the story frame shows what the story will ACTUALLY lead with,
 * which is not always the tile you just tapped: a supplier's frame and the
 * animated monogram have no rung on the story's existing lead-image ladder, so
 * the story keeps the living hero while the shelf and the share card carry the
 * real choice. **A preview that promised otherwise would be the screen lying to
 * the host about the one thing it exists to show them.**
 *
 * ── THE TILES ARE NOT WHERE ELIGIBILITY IS DECIDED ──────────────────────────
 * Everything offered here already passed the screen and the consent veto in
 * `loadCoverCandidates` — and `setStoryCover` re-checks the pair server-side on
 * every press, because this component is a browser and a server action is a
 * public POST.
 */

import { useMemo, useState, useTransition } from 'react';
import { FileUpload } from '@/app/_components/file-upload';
import { setStoryCover } from '../cover-actions';
import type { CoverCandidate } from '../_lib/load-cover-candidates';
import type { StoryCoverKind } from '@/lib/story-cover';

/** The image types the editor's other upload fields accept. */
const COVER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type CoverChoice = { kind: StoryCoverKind; ref: string | null } | null;

/** Kinds the story's own lead-image ladder can express (see `cover-actions`). */
const LADDER_CAN_SAY: ReadonlySet<StoryCoverKind> = new Set<StoryCoverKind>([
  'hero',
  'upload',
  'capture',
]);

function sameChoice(a: CoverChoice, b: CoverChoice): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && (a.ref ?? null) === (b.ref ?? null);
}

export function CoverStep({
  eventId,
  candidates,
  unreadable,
  initial,
  displayName,
  monogramText,
  monogramColor,
  metaLine,
  uploadDisplayUrls,
}: {
  eventId: string;
  candidates: readonly CoverCandidate[];
  /** Sources that could not be read. An unreadable source is not an empty one. */
  unreadable: readonly string[];
  initial: CoverChoice;
  displayName: string;
  monogramText: string | null;
  monogramColor: string | null;
  /** "Feb 14, 2026 · Tagaytay" — the preview chrome, from the event's own facts. */
  metaLine: string;
  uploadDisplayUrls: Record<string, string>;
}) {
  const [choice, setChoice] = useState<CoverChoice>(initial);
  const [uploadRef, setUploadRef] = useState<string>(
    initial?.kind === 'upload' ? (initial.ref ?? '') : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const livingHero = useMemo(
    () => candidates.find((c) => c.kind === 'hero') ?? null,
    [candidates],
  );

  const chosen = useMemo(() => {
    if (!choice) return null;
    if (choice.kind === 'upload') {
      return {
        kind: 'upload' as StoryCoverKind,
        ref: choice.ref,
        source: 'Your own photo',
        label: 'The one you uploaded here',
        previewUrl: choice.ref ? (uploadDisplayUrls[choice.ref] ?? null) : null,
      };
    }
    return (
      candidates.find((c) => c.kind === choice.kind && (c.ref ?? null) === (choice.ref ?? null)) ??
      null
    );
  }, [choice, candidates, uploadDisplayUrls]);

  /*
    What the STORY's own top will show — which is the chosen picture only when
    the lead-image ladder can express it. Everything else keeps the living hero.
  */
  const storyLeadUrl =
    choice && LADDER_CAN_SAY.has(choice.kind)
      ? (chosen?.previewUrl ?? null)
      : (livingHero?.previewUrl ?? null);
  const storyKeepsLivingHero = Boolean(choice && !LADDER_CAN_SAY.has(choice.kind));

  const pick = (next: CoverChoice) => {
    if (sameChoice(next, choice)) return;
    const previous = choice;
    setChoice(next);
    setError(null);
    startTransition(async () => {
      const result = await setStoryCover(eventId, next?.kind ?? null, next?.ref ?? null);
      if (!result.ok) {
        // Put the tile back. A cover that the server refused is not the cover,
        // and leaving it lit would tell the host the opposite.
        setChoice(previous);
        setError(result.error);
      }
    });
  };

  const card = 'rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6';
  const eyebrow =
    'block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45';

  return (
    <section className={card} aria-labelledby="cover-heading">
      <h2 id="cover-heading" className="font-display text-lg italic text-ink">
        The cover
      </h2>
      <p className="mt-0.5 text-sm text-ink/60">
        One picture does three jobs: the top of your story, the card on
        setnayan.com, and the thumbnail when anyone shares the link. Pick it once
        &mdash; you can see all three below.
      </p>

      {unreadable.length > 0 ? (
        /*
          AN UNREADABLE SOURCE IS NOT AN EMPTY ONE. A host shown a short list
          with no explanation concludes their suppliers sent nothing.
        */
        <p role="status" className="mt-3 text-xs leading-relaxed text-ink/55">
          We couldn&rsquo;t read {unreadable.join(' and ')} just now, so
          there may be more pictures to choose from than you can see here.
        </p>
      ) : null}

      {/* ── The tiles ──────────────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {candidates.map((candidate) => {
          const isChosen =
            choice?.kind === candidate.kind && (choice.ref ?? null) === (candidate.ref ?? null);
          return (
            <button
              key={`${candidate.kind}:${candidate.ref ?? 'none'}`}
              type="button"
              onClick={() => pick({ kind: candidate.kind, ref: candidate.ref })}
              aria-pressed={isChosen}
              disabled={pending}
              className={`group relative aspect-[4/3] overflow-hidden rounded-md border text-left transition ${
                isChosen ? 'border-burgundy ring-2 ring-burgundy/30' : 'border-ink/10 hover:border-ink/30'
              }`}
              style={
                candidate.previewUrl
                  ? {
                      backgroundImage: `url(${candidate.previewUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : { background: monogramColor ?? '#F3EBDD' }
              }
            >
              {/* The monogram tile is DRAWN, not fetched — it is their own mark,
                  and the share card already renders it that way. */}
              {candidate.kind === 'monogram' ? (
                <span className="absolute inset-0 flex items-center justify-center font-display text-2xl italic text-white/90 mix-blend-luminosity">
                  {monogramText}
                </span>
              ) : null}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/85">
                  {candidate.source}
                </span>
                <span className="mt-0.5 block truncate text-xs font-medium text-white">
                  {candidate.label}
                </span>
              </span>
            </button>
          );
        })}

        {/* ── Upload another ──────────────────────────────────────────────────
            THE SAME FIELD AS "YOUR OWN PHOTOS · COVER PHOTO", DELIBERATELY. It
            writes the same stored ref and the same path prefix, so the two
            controls are two doors to one room rather than two covers quietly
            competing for the top of the story. */}
        <div className="col-span-2 rounded-md border border-dashed border-ink/25 bg-white/60 p-3 sm:col-span-1">
          <span className={eyebrow}>Upload another</span>
          <div className="mt-2">
            <FileUpload
              bucket="media"
              pathPrefix={`editorial/${eventId}/hero`}
              name="story_cover_upload"
              acceptedTypes={COVER_IMAGE_TYPES}
              maxSizeMB={10}
              compressImage
              variant="wide"
              currentValue={uploadRef || null}
              initialDisplayUrls={uploadDisplayUrls}
              onChange={(v) => {
                const ref = typeof v === 'string' ? v : '';
                setUploadRef(ref);
                pick(ref ? { kind: 'upload', ref } : null);
              }}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-mulberry">
          {error}
        </p>
      ) : null}

      {/* ── The three jobs, previewed ───────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <span className={eyebrow}>On your story</span>
          <div
            className="mt-2 flex aspect-[3/2] items-end rounded-md border border-ink/10 bg-ink/10 p-3"
            style={
              storyLeadUrl
                ? {
                    backgroundImage: `linear-gradient(to top, rgba(0,0,0,.62), transparent 60%), url(${storyLeadUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            <span className="block">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
                {metaLine}
              </span>
              <span className="mt-0.5 block font-display text-lg italic text-white">
                {displayName}
              </span>
            </span>
          </div>
          {storyKeepsLivingHero ? (
            <p className="mt-2 text-xs leading-relaxed text-ink/55">
              Your story itself still opens on the picture from your site. The
              shelf card and the shared link carry the one you just picked.
            </p>
          ) : null}
        </div>

        <div>
          <span className={eyebrow}>On setnayan.com/realstories</span>
          <div
            className="mt-2 flex aspect-[4/3] items-end rounded-md border border-ink/10 bg-ink/10 p-3"
            style={
              chosen?.previewUrl
                ? {
                    backgroundImage: `linear-gradient(to top, rgba(0,0,0,.62), transparent 60%), url(${chosen.previewUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : { background: monogramColor ?? '#6B4E3D' }
            }
          >
            <span className="block text-xs font-semibold text-white">{displayName}</span>
          </div>

          <span className={`${eyebrow} mt-3.5`}>When someone shares the link</span>
          <div
            className="mt-2 flex aspect-[1200/630] items-end rounded-md border border-ink/10 bg-ink/10 p-3"
            style={
              chosen?.previewUrl
                ? {
                    backgroundImage: `linear-gradient(to top, rgba(0,0,0,.62), transparent 60%), url(${chosen.previewUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : { background: monogramColor ?? '#6B4E3D' }
            }
          >
            <span className="block text-xs font-semibold text-white">{displayName}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/55">
        A capture can only be your cover if it passed the same checks as
        everything else &mdash; screened, and nobody in it opted out.{' '}
        <strong className="font-semibold text-ink/75">
          {chosen ? `${chosen.source} — ${chosen.label}` : 'The one on your site now'}
        </strong>{' '}
        is your cover now.
      </p>
    </section>
  );
}
