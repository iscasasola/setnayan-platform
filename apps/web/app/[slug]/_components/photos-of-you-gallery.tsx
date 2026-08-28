'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { GuestLiveGallery } from '@/lib/guest-live-gallery';
import { askToTakeMyPhotoDown, removeMyTag } from '../actions';
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
            {/*
              TWO DIFFERENT WISHES, TWO CONTROLS — and until 2026-08-28 there was
              one, which could not act on either.

              "Not me"  → that is somebody else, stop filing it under my name.
                          Removes the TAG, never the photograph. This used to
                          work only on face-recognition guesses, of which
                          production has never held a single one, so it rendered
                          on every photo and did nothing on any of them.

              "Take it down" → that IS me, and I do not want it up. The tag comes
                          off in the same press (that part is theirs), and the
                          photograph goes to a person, because it was taken by
                          somebody else and may hold four other guests.

              Both are real ≥44px labelled controls, legible over the photo.
            */}
            <div className="absolute right-1.5 top-1.5 z-10 flex flex-col items-end gap-1.5">
              <form action={removeMyTag.bind(null, eventId, p.sourceTable, p.id)}>
                <SubmitButton
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[rgb(23_22_15/0.7)] px-3 text-sm font-semibold text-[var(--sn-ob-text)] shadow-sm backdrop-blur-sm transition hover:bg-[rgb(23_22_15/0.85)] focus-visible:bg-[rgb(23_22_15/0.85)]"
                  pendingLabel="Removing…"
                >
                  <X aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                  Not me
                </SubmitButton>
              </form>
              <TakeItDown eventId={eventId} sourceTable={p.sourceTable} sourceId={p.id} />
            </div>
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

/**
 * "Take it down" — the door a guest with no account has never had.
 *
 * ⚖ IT ASKS BEFORE IT SENDS, and the box is optional. Somebody objecting to a
 * photograph of themselves should not have to explain themselves to be heard —
 * but the sentence they write is usually the whole reason a person can answer
 * quickly, so it is offered and never demanded.
 *
 * 🔑 THE ANSWER IS SHOWN IN PLACE. A control that files something invisible is
 * the same defect as one that does nothing: the guest presses, nothing visibly
 * happens, and they press again. Pressing twice is handled server-side too —
 * a second ask on the same photo comes back as the one they already have.
 */
function TakeItDown({
  eventId,
  sourceTable,
  sourceId,
}: {
  eventId: string;
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  sourceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p className="max-w-[13rem] rounded-lg bg-[rgb(23_22_15/0.8)] px-2.5 py-2 text-right text-xs font-semibold text-[var(--sn-ob-text)] backdrop-blur-sm">
        We have your request. You are no longer tagged in it, and someone will
        look at the photo.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center rounded-full bg-[rgb(23_22_15/0.7)] px-3 text-sm font-semibold text-[var(--sn-ob-text)] shadow-sm backdrop-blur-sm transition hover:bg-[rgb(23_22_15/0.85)] focus-visible:bg-[rgb(23_22_15/0.85)]"
      >
        Take it down
      </button>
    );
  }

  return (
    <form
      action={async (formData: FormData) => {
        setError(null);
        const res = await askToTakeMyPhotoDown(
          eventId,
          sourceTable,
          sourceId,
          formData,
        );
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setSent(true);
      }}
      className="w-[15rem] rounded-lg bg-[rgb(23_22_15/0.85)] p-2.5 text-left backdrop-blur-sm"
    >
      <label className="block text-xs font-semibold text-[var(--sn-ob-text)]">
        Ask us to take this photo down
        <span className="ml-1 font-normal opacity-70">Anything to add?</span>
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-md border border-[rgb(251_250_247/0.25)] bg-[rgb(23_22_15/0.6)] px-2 py-1 text-xs font-normal text-[var(--sn-ob-text)] outline-none focus:border-[rgb(251_250_247/0.6)]"
        />
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-semibold text-[var(--sn-ob-text)]">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-2.5 py-1.5 text-xs font-bold text-[var(--sn-ob-text)] opacity-70"
        >
          Cancel
        </button>
        <SubmitButton
          className="rounded-full bg-[var(--sn-ob-text)] px-2.5 py-1.5 text-xs font-bold text-[rgb(23_22_15)]"
          pendingLabel="Sending…"
        >
          Send it
        </SubmitButton>
      </div>
    </form>
  );
}
