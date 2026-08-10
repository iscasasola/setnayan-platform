'use client';

import { useRef, useState } from 'react';
import { Play, Download, Sparkles, X, Loader2, Gem } from 'lucide-react';
import type { GalleryPhoto, GalleryTagSource } from '@/lib/papic-gallery';
import { papicCaptureCost } from '@/lib/papic-cameras';
import { PRESERVATION_BLOCK_POINTS } from '@/lib/papic-storage-telemetry';
import { SavePhotoButton } from '@/app/_components/save-photo-button';
import { saveMediaToDevice } from '@/lib/save-to-device';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { setClipShowcaseApproval, setGuestClipShowcaseApproval, setCapturePreserved } from '../actions';

// Real Papic gallery grid — the couple's captured photos + clips with working
// filter chips. Server-fetched (presigned thumbnails) and passed in; this only
// handles the client-side filter state + render.

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'tagged', label: 'Photos of us' },
  { id: 'untagged', label: 'Untagged' },
  { id: 'videos', label: 'Videos' },
  // "Where we will see the preserved photo/video" — owner 2026-08-10.
  { id: 'preserved', label: 'Kept sharp' },
] as const;
type FilterId = (typeof FILTERS)[number]['id'];

function tagDotClass(source: GalleryTagSource): string {
  if (source === 'auto_face') return 'bg-success-500';
  if (source === 'qr' || source === 'manual') return 'bg-terracotta';
  return 'bg-ink/30';
}

/**
 * Kwento density indicator:
 *   ≥3 stories → gold dot  (editorial lead — this moment has a story)
 *   2  stories → amber dot
 *   1  story   → grey dot
 */
function kwentoDotClass(density: number): string {
  if (density >= 3) return 'bg-warn-400';
  if (density === 2) return 'bg-warn-300';
  return 'bg-ink/30';
}

export function PapicGalleryGrid({
  photos,
  eventId,
  kwentoDensity,
}: {
  photos: GalleryPhoto[];
  eventId?: string;
  /** Map of photoId → story count. When provided, photos with ≥1 story get a
   *  small density dot in the lower-right corner of their thumbnail. */
  kwentoDensity?: Map<string, number>;
}) {
  const [filter, setFilter] = useState<FilterId>('all');
  // Clip the couple tapped to play, shown full-screen in the lightbox.
  const [playing, setPlaying] = useState<GalleryPhoto | null>(null);

  const shown = photos.filter((p) => {
    if (filter === 'tagged') return p.tagged;
    if (filter === 'untagged') return !p.tagged;
    if (filter === 'videos') return p.kind === 'clip';
    if (filter === 'preserved') return p.preserved === true;
    return true;
  });

  return (
    <>
      <ul className="flex flex-wrap gap-2" role="list" aria-label="Gallery filters">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={
                  active
                    ? 'inline-flex items-center gap-1 rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-cream'
                    : 'inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60 hover:bg-ink/10 hover:text-ink/80'
                }
              >
                {f.label}
              </button>
            </li>
          );
        })}
      </ul>

      {eventId && photos.length > 0 ? (
        <a
          href={`/dashboard/${eventId}/studio/papic/gallery-zip`}
          download
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/10"
        >
          <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Download all
        </a>
      ) : null}

      {eventId && photos.some((p) => p.kind === 'clip') ? (
        <p className="flex items-start gap-1.5 text-xs text-ink/55">
          <Sparkles aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={2} />
          <span>
            Tap the <span className="font-medium text-ink/70">sparkle</span> on a clip to add it to your public
            memory orb. It only goes live once the guest in it has also consented to public sharing.
          </span>
        </p>
      ) : null}

      <PreservationMeterLine photos={photos} />

      {shown.length === 0 ? (
        <p className="text-sm text-ink/55">No photos in this view yet.</p>
      ) : (
        <ul
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
          aria-label="Papic gallery"
        >
          {shown.map((p) => (
            <li key={p.id}>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
                {p.url ? (
                  // Presigned R2 thumbnail — a plain img keeps the dynamic, short-
                  // lived URL out of next/image's domain allowlist + optimizer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={
                      p.kind === 'clip'
                        ? p.tagged
                          ? 'Papic gallery video clip of tagged guests'
                          : 'Papic gallery video clip'
                        : p.tagged
                          ? 'Papic gallery photo of tagged guests'
                          : 'Papic gallery photo'
                    }
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-ink/10" aria-hidden />
                )}
                {/* Clips are playable: a full-tile button opens the lightbox; the
                    centred play disc is the affordance (decorative, click-through). */}
                {p.kind === 'clip' && p.playUrl && (
                  <button
                    type="button"
                    onClick={() => setPlaying(p)}
                    aria-label="Play video clip"
                    className="absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/25"
                  >
                    <span className="rounded-full bg-black/55 p-2 text-cream">
                      <Play aria-hidden className="h-4 w-4 fill-cream" strokeWidth={2} />
                    </span>
                  </button>
                )}
                {p.kind === 'clip' && (
                  <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-cream">
                    Video
                  </span>
                )}
                {eventId && p.kind === 'clip' && p.source !== 'vendor' ? (
                  <ShowcaseToggle
                    eventId={eventId}
                    photoId={p.id}
                    source={p.source}
                    approved={Boolean(p.showcaseApproved)}
                    consented={Boolean(p.showcaseConsent)}
                  />
                ) : null}

                {/* Keep this original at full resolution, or release it. Vendor
                    documentation captures are excluded: they are the vendor's
                    own files on their own retention, not the couple's to hold. */}
                {eventId && p.source !== 'vendor' ? (
                  <PreserveToggle
                    eventId={eventId}
                    captureId={p.id}
                    source={p.source}
                    preserved={p.preserved !== false}
                    alreadyCompressed={Boolean(p.alreadyCompressed)}
                  />
                ) : null}
                {/* Photos save straight from the tile; clips download from the
                    lightbox (the tile thumbnail is only their poster frame).
                    `saveUrl` is the same-origin save-photo route: FULL-RES original
                    with EXIF/GPS stripped on the fly (owner 2026-07-16), never the
                    raw geo-bearing original (RA 10173). */}
                {p.saveUrl && p.kind === 'photo' ? (
                  <SavePhotoButton url={p.saveUrl} filename={`setnayan-photo-${p.id}.jpg`} />
                ) : null}
                <span
                  className={`absolute bottom-1 left-1 h-2 w-2 rounded-full ring-1 ring-white/70 ${tagDotClass(p.tagSource)}`}
                  aria-hidden
                />
                {kwentoDensity && (kwentoDensity.get(p.id) ?? 0) >= 1 ? (
                  <span
                    className={`absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-white/70 ${kwentoDotClass(kwentoDensity.get(p.id) ?? 1)}`}
                    title={`${kwentoDensity.get(p.id)} guest ${kwentoDensity.get(p.id) === 1 ? 'story' : 'stories'}`}
                    aria-hidden
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {playing?.playUrl ? (
        <ClipLightbox photo={playing} onClose={() => setPlaying(null)} />
      ) : null}
    </>
  );
}

/**
 * Full-screen clip player — opens when the couple taps a video tile. Native
 * <video controls> (autoplay, muted-safe, loop) plus an explicit download of the
 * real video. Uses the shared modal-a11y primitive (focus trap + Esc + scroll
 * lock + restore) like every other Setnayan overlay.
 */
function ClipLightbox({ photo, onClose }: { photo: GalleryPhoto; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  useModalA11y({ open: true, onClose, containerRef: dialogRef });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Video clip"
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-2xl flex-col items-center outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* video controls include the browser's own download in most engines;
            autoPlay is muted-safe (mobile blocks autoplay-with-sound). */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={photo.playUrl ?? undefined}
          poster={photo.url ?? undefined}
          controls
          autoPlay
          playsInline
          loop
          className="max-h-[80vh] w-auto max-w-full rounded-lg bg-black"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (!photo.playUrl || saving) return;
              setSaving(true);
              // fetch→blob→download: a bare cross-origin <a download> is ignored
              // by browsers (opens instead of saves) + the ext is derived from
              // the real container (webm vs mp4), not hardcoded.
              // PRIVACY NOTE (RA 10173): this serves the clip's video ORIGINAL.
              // Stripping MP4/container GPS needs an ffmpeg `-map_metadata -1` pass
              // that Vercel can't run on the serving path — DEFERRED (see the
              // geo-strip changelog). Papic clips are recorded in-browser via
              // MediaRecorder, which writes no GPS, so the current exposure is nil;
              // the gap is only camera-roll/DSLR-origin clips (a future path).
              await saveMediaToDevice(photo.playUrl, `setnayan-clip-${photo.id}`);
              setSaving(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-cream/10 px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-cream/20 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {saving ? 'Saving…' : 'Download clip'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md bg-cream px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-cream/90"
          >
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Showcase toggle for one clip — the couple's gate for the public Alaala memory
 * orb (/our-story). Approving sets couple_approved_for_showcase; the clip only
 * actually surfaces on the orb once the GUEST has also consented to public
 * sharing (consent_to_public — a separate gate, set by the guest-consent flow).
 * So an approved-but-not-yet-consented clip shows a "waiting on guest" hint
 * rather than implying it's already live.
 */
function ShowcaseToggle({
  eventId,
  photoId,
  source,
  approved,
  consented,
}: {
  eventId: string;
  photoId: string;
  /** seat clips flip papic_photos; guest clips flip papic_guest_captures. */
  source: 'seat' | 'guest';
  approved: boolean;
  consented: boolean;
}) {
  const live = approved && consented;
  const title = !approved
    ? 'Add this clip to your public memory orb'
    : live
      ? 'On your public memory orb — tap to remove'
      : 'Approved — waiting on guest consent before it shows';
  // Route to the table-matched approval action. Guest-recorded clips (Option A,
  // the real consent producer) flip papic_guest_captures; seat clips flip
  // papic_photos.
  const action = source === 'guest' ? setGuestClipShowcaseApproval : setClipShowcaseApproval;
  return (
    <form action={action} className="absolute left-1 top-1">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="photo_id" value={photoId} />
      <input type="hidden" name="approve" value={approved ? '0' : '1'} />
      <button
        type="submit"
        title={title}
        aria-pressed={approved}
        aria-label={title}
        className={
          approved
            ? `inline-flex items-center justify-center rounded-full p-1 text-cream ring-1 ring-white/70 ${live ? 'bg-terracotta' : 'bg-warn-400'}`
            : 'inline-flex items-center justify-center rounded-full bg-black/45 p-1 text-cream/85 ring-1 ring-white/40 hover:bg-black/65'
        }
      >
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
      </button>
    </form>
  );
}

/**
 * How much of the paid allowance the couple's kept originals use.
 *
 * 🗣 A PERCENTAGE OF A COUNT — never a gigabyte, and never a raw point total.
 * Owner 2026-08-10: *"do not price by drive. price by number of photos and
 * videos"*, and ₱500 buys 5,000 Papic points. The points are DERIVED from
 * `papicCaptureCost`, the same currency every camera spends, so this line can
 * never disagree with what a capture actually cost.
 *
 * ⚠ Shown to everyone, not only payers. A couple who has bought nothing still
 * sees what they are holding — the bar is what makes "you are over what you paid
 * for" legible before it matters, rather than a surprise six months later.
 */
function PreservationMeterLine({ photos }: { photos: GalleryPhoto[] }) {
  const kept = photos.filter((p) => p.preserved);
  const points = kept.reduce(
    (n, p) => n + papicCaptureCost(p.kind === 'clip' ? 'clip' : 'photo'),
    0,
  );
  if (photos.length === 0) return null;

  const allowance = PRESERVATION_BLOCK_POINTS;
  const pct = Math.round((points / allowance) * 100);
  const over = points > allowance;

  return (
    <div className="rounded-lg border border-ink/10 bg-cream/60 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-ink/80">
          {kept.length} of {photos.length} kept at full resolution
        </p>
        <p className={over ? 'font-mono text-xs text-terracotta' : 'font-mono text-xs text-ink/55'}>
          {pct}%
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className={over ? 'h-full bg-terracotta' : 'h-full bg-success-500'}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink/55">
        {over
          ? 'You are keeping more than one year of preservation covers. Release a few, or add another year — nothing is lost either way: everything stays in your gallery, just smaller.'
          : 'Everything is kept sharp by default. Anything you release stays in your gallery — it simply stops being held at full size.'}
      </p>
    </div>
  );
}

/**
 * Keep this ONE capture's original at full resolution, or release it.
 *
 * 🗣 THE WORDS MATTER MORE THAN THE CONTROL. Releasing does NOT delete a photo —
 * it lets the original be replaced by the compressed copy that already exists,
 * and the photo stays in the gallery for five years either way. The owner has
 * corrected that vocabulary twice, so nothing here says "delete" or "remove".
 *
 * 🪤 AND IT CANNOT BE UNDONE ONCE THE SWEEP HAS RUN. Re-keeping a capture whose
 * original is already gone cannot bring the resolution back, so the tooltip says
 * so before the tap rather than after. A capture in that state renders as a
 * plain, unclickable marker — the server refuses it too, but a control that
 * accepts a tap and changes nothing is the thing worth not building.
 */
function PreserveToggle({
  eventId,
  captureId,
  source,
  preserved,
  alreadyCompressed,
}: {
  eventId: string;
  captureId: string;
  source: 'seat' | 'guest';
  preserved: boolean;
  alreadyCompressed: boolean;
}) {
  if (alreadyCompressed) {
    return (
      <span
        title="This one is already stored smaller. That cannot be undone — the full-size original is gone."
        aria-label="Already stored smaller"
        className="absolute right-1 top-1 inline-flex items-center justify-center rounded-full bg-black/35 p-1 text-cream/50 ring-1 ring-white/20"
      >
        <Gem aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }
  const title = preserved
    ? 'Kept at full resolution. Tap to release — it stays in your gallery, just smaller, and that cannot be undone later.'
    : 'Released — it will be stored smaller. Tap to keep it at full resolution.';
  return (
    <form action={setCapturePreserved} className="absolute right-1 top-1">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="capture_id" value={captureId} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="preserve" value={preserved ? 'no' : 'yes'} />
      <button
        type="submit"
        title={title}
        aria-label={title}
        aria-pressed={preserved}
        className={
          preserved
            ? 'inline-flex items-center justify-center rounded-full bg-success-500 p-1 text-cream ring-1 ring-white/70'
            : 'inline-flex items-center justify-center rounded-full bg-black/45 p-1 text-cream/85 ring-1 ring-white/40 hover:bg-black/65'
        }
      >
        <Gem aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </form>
  );
}
