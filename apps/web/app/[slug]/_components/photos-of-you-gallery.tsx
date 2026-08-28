'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { GuestLiveGallery } from '@/lib/guest-live-gallery';
import { removeMyTag } from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { GalleryCredit } from '@/app/_components/gallery/gallery-credit';
import { GalleryLightbox } from '@/app/_components/gallery/gallery-lightbox';

/**
 * "PHOTOS OF YOU" — the guest's own photographs on the event's public page.
 *
 * One of the four subjects the gallery archetype names (§ 2 route chips:
 * *GUEST "YOUR PHOTOS" ON THE PAHINA LANDING*). It wore the cream page skin
 * until 2026-08-27 and is obsidian now, for the archetype's stated reason:
 * photographs carry the colour, the chrome recedes. The app around it stays
 * light-locked; this is a surface, not a mode.
 *
 * 🚨 SO IT USES `--sn-ob-*` AND NOTHING ELSE. `text-ink` measures 1.27:1 on this
 * panel and `text-mulberry` 3.81:1 — on a light-locked page nothing sets
 * `html.dark`, so theme colours resolve to their LIGHT values here and vanish.
 *
 * ⚠ THE FILE NAMED "your-photos-widget" IS NOT THIS SCREEN. That one is the
 * couple's placeable promise card, which has never rendered a photograph. THIS
 * is where a guest actually looks at theirs, and the register's three-subject
 * list had the wrong file for a fortnight.
 *
 * ── WHAT IS DELIBERATELY UNCHANGED ─────────────────────────────────────────
 * The three states stay three states. A failed read, an empty result and a full
 * grid say different things, because collapsing the first two once told every
 * untagged guest that the page had broken. Only the skin moved.
 *
 * ⚠ It is a CLIENT component solely because the lightbox holds state. The data
 * and every gate still resolve on the server and arrive as props.
 */
export function PhotosOfYouGallery({
  gallery,
  eventId,
  isLive,
  isPost,
  showClaimAccountCta,
  occasion,
  eventWord,
  timeZone,
}: {
  /** null means the read FAILED. An empty `photos` array means nobody has
   *  tagged this guest yet — a real answer, and the commonest one early in a
   *  day. The two must never render the same words. */
  gallery: GuestLiveGallery | null;
  eventId: string;
  isLive: boolean;
  isPost: boolean;
  showClaimAccountCta: boolean;
  occasion: string;
  eventWord: string;
  /** The VENUE's zone. Absent ⇒ credits drop the time, never guess it. */
  timeZone?: string | null;
}) {
  const photos = gallery?.photos ?? [];
  const [openedId, setOpenedId] = useState<string | null>(null);
  const opened = photos.find((p) => p.id === openedId) ?? null;

  return (
    <section aria-label="Photos of you" className="sn-gal p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="sn-gal-kick inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em]">
          {isLive ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--sn-ob-gold)]" />
          ) : null}
          Photos of you{isLive ? ' — so far' : ''}
        </p>
        <p className="sn-gal-soft text-sm">
          {(gallery?.total ?? 0).toLocaleString()}
          {isLive ? ' so far' : ''}
        </p>
      </div>

      {/* Post-event grace (Invite/Join v2): a no-login guest can still save
          their photos for ~24h after the wedding, then it closes — an account
          keeps them forever. The claim-account box already sits near the top of
          the page for accountless viewers. */}
      {isPost && showClaimAccountCta ? (
        <p className="sn-gal-text mt-3 rounded-lg border-l-2 border-[var(--sn-ob-gold)] bg-[rgb(203_167_102/0.12)] px-3 py-2 text-sm">
          These close about a day after the {eventWord}. Save the ones you want now — or make a
          free account (the box near the top) to keep them.
        </p>
      ) : null}

      {!gallery ? (
        // The read failed. Say so — and say whose fault it is.
        <p className="sn-gal-soft mt-4 rounded-lg border border-[rgb(251_250_247/0.12)] px-3 py-3 text-sm">
          We couldn&rsquo;t load your photos just now. Nothing is lost — pull down to refresh in a
          moment.
        </p>
      ) : photos.length === 0 ? (
        // Genuinely none yet. The commonest state early in a day, and the one a
        // guest most needs reassurance about.
        <p className="sn-gal-soft mt-4 rounded-lg border border-[rgb(251_250_247/0.12)] px-3 py-3 text-sm">
          {isLive
            ? 'No one has tagged you yet — your photos appear here as they’re taken.'
            : `No photos of you were tagged at this ${occasion}.`}
        </p>
      ) : null}

      {/* 3-up (not 4-up) so the photos — and the readable "Not me" control —
          are big enough for an older guest (Guest Legibility Floor). */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <figure key={p.id} className="sn-gal-tile group aspect-square">
            {/* Tapping the photo opens it here rather than navigating away to a
                raw presigned URL in a new tab. "Click any tile for the lightbox"
                — and the save is an action inside it, so the guest keeps their
                place on the page instead of losing it to a browser tab. */}
            <button
              type="button"
              onClick={() => setOpenedId(p.id)}
              aria-label="Open this photo"
              className="block h-full w-full"
            >
              {/* Presigned URL — raw <img> (the optimizer would cache expiry). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
            {/* "Not me" — drop a wrong auto-face guess of yourself on this one
                shot (you stay enrolled for the rest). Auto-tags only; a
                photographer's QR tag can't be removed here. A real ≥44px
                labelled control, legible over the photo. */}
            <form
              action={removeMyTag.bind(null, eventId, p.sourceTable, p.id)}
              className="absolute right-1.5 top-1.5 z-10"
            >
              <SubmitButton
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[rgb(23_22_15/0.7)] px-3 text-sm font-semibold text-[var(--sn-ob-text)] shadow-sm backdrop-blur-sm transition hover:bg-[rgb(23_22_15/0.85)] focus-visible:bg-[rgb(23_22_15/0.85)]"
                pendingLabel="Removing…"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                Not me
              </SubmitButton>
            </form>
            {/* WHO GOT THIS SHOT OF YOU — the question a guest actually has, and
                one this page could not answer at all before. Silent when unknown. */}
            <GalleryCredit name={p.capturedBy} capturedAt={p.capturedAt} timeZone={timeZone} />
          </figure>
        ))}
      </div>

      {photos.length > 0 ? (
        <p className="sn-gal-soft mt-3 text-sm">
          {isLive
            ? `More arrive as the day unfolds — and every photo of you is yours to keep after the ${occasion}.`
            : 'Tap any photo to open it full size and save it.'}{' '}
          Tap <span className="sn-gal-text font-medium">Not me</span> on any photo that isn&rsquo;t
          you.
        </p>
      ) : null}

      {opened ? (
        <GalleryLightbox
          src={opened.url}
          kind="photo"
          capturedByName={opened.capturedBy}
          capturedAt={opened.capturedAt}
          timeZone={timeZone}
          onClose={() => setOpenedId(null)}
          actions={
            <a
              href={opened.url}
              target="_blank"
              rel="noopener noreferrer"
              className="sn-gal-btn inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
            >
              Open full size to save
            </a>
          }
        />
      ) : null}
    </section>
  );
}
