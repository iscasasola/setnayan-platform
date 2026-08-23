'use client';

/**
 * Admin review panel for Save-the-Date videos (iteration 0024 · SEC-6).
 *
 * ── THIS IS NO LONGER AN "OVERRIDE" PANEL. IT IS THE GATE. ──────────────────
 * The automatic screen classifies the POSTER frame — a JPEG the browser grabbed
 * at upload and uploaded as an independent object. It has never looked at a
 * single frame of the video (nsfwjs is image-only; Vercel has no ffmpeg), so a
 * clean poster over a dirty video used to publish the dirty video. It now parks
 * the row at `in_review` and CANNOT approve one. A person watching the sealed
 * clip is the only examiner competent to authorise it.
 *
 * Three states arrive here:
 *   • `in_review` — sealed and poster-screened. Watch it and decide. This is the
 *     normal path and it is now on the critical path of every couple video.
 *   • `pending` / `rejected` — nothing frozen to watch. "Prepare for review"
 *     seals the current bytes first; approval is never against a mutable object.
 *   • `grandfathered` — serving on the pre-SEC-6 poster-only screen, carried
 *     across at the cutover so a live couple page did not go dark. Nothing is
 *     broken; it just has never been examined. Approving replaces the carry-over
 *     with a real examination and clears the badge.
 *
 * Rendered inside /admin/studio → Reveal Studio; rows come from the server page.
 * Empty list → the whole panel is hidden (no clutter when nothing's waiting).
 */

import { useState, useTransition } from 'react';
import { Check, X, Film, Lock, ShieldAlert } from 'lucide-react';
import { sealStdVideoForReview, setStdVideoModeration } from './actions';
import { useSaveLoader } from '@/components/sd-loader';

export type PendingStdVideo = {
  eventId: string;
  publicId: string;
  name: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  /** Serving on the SEC-6 cutover carry-over rather than a real examination. */
  grandfathered: boolean;
  /** Presigned URL of the SEALED video — the exact bytes a guest receives. */
  videoUrl: string | null;
  posterUrl: string | null;
  /** `<etag>:<bytes>` of the sealed objects presigned into the player below.
   *  SEC-6: Approve is PINNED to these, so a decision can only ever cover the
   *  bytes the reviewer was shown. A mismatch comes back as `stale-media`. */
  videoFingerprint: string | null;
  posterFingerprint: string | null;
  /** False when nothing is sealed yet — the row must be prepared before it can
   *  be approved. An admin may only ever put their name to frozen bytes. */
  approvable: boolean;
  /** The verdict names a sealed pair R2 no longer serves (an out-of-band act). */
  sealBroken: boolean;
};

const ERRORS: Record<string, string> = {
  'stale-media':
    'This video changed since the page loaded — reload and watch it again before approving.',
  'not-sealed':
    'Nothing is frozen for this row yet. Use “Prepare for review” first, then watch and approve.',
  'media-unreadable': 'The video could not be read from storage — try again in a moment.',
};

export function StdVideoModeration({ initial }: { initial: PendingStdVideo[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const decide = (eventId: string, decision: 'approved' | 'rejected') => {
    setError(null);
    setBusyId(eventId);
    startTransition(async () => {
      const row = rows.find((x) => x.eventId === eventId);
      const r = await save.run(
        () =>
          setStdVideoModeration(eventId, decision, {
            videoFingerprint: row?.videoFingerprint ?? null,
            posterFingerprint: row?.posterFingerprint ?? null,
          }),
        { steps: ['Recording your decision'], hint: 'Saving' },
      );
      if (r.ok) {
        setRows((prev) => prev.filter((x) => x.eventId !== eventId));
      } else {
        setError(ERRORS[r.error] ?? r.error ?? 'Could not save — try again.');
      }
      setBusyId(null);
    });
  };

  const prepare = (eventId: string) => {
    setError(null);
    setBusyId(eventId);
    startTransition(async () => {
      const r = await save.run(() => sealStdVideoForReview(eventId), {
        steps: ['Freezing this video for review'],
        hint: 'Preparing',
      });
      if (r.ok) {
        // The seal exists but this page's presigned player does not point at it
        // yet. A reload is the honest next step — the reviewer must watch the
        // frozen bytes, not the ones that were on screen a moment ago.
        setError('Prepared. Reload this page to watch the frozen video and decide.');
      } else {
        setError(ERRORS[r.error] ?? r.error ?? 'Could not prepare — try again.');
      }
      setBusyId(null);
    });
  };

  return (
    <section className="mt-10 rounded-2xl border border-[var(--m-line,#e7e3da)] bg-[var(--m-paper,#fff)] p-5 sm:p-6">
      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)]">
          <Film aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Content · needs review
        </div>
        <h2 className="text-lg font-semibold text-[var(--m-ink,#1b1a17)]">
          Save-the-Date videos ({rows.length})
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--m-slate,#4f535b)]">
          The automatic screen only ever looks at a video&rsquo;s still frame, so it can block a
          video but never publish one. Watch each clip below and approve it to make it live, or
          reject to keep the couple&rsquo;s photo gallery instead.
        </p>
      </div>

      {error ? (
        <p className="mb-3 rounded-md border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <li
            key={row.eventId}
            className="flex flex-col gap-3 rounded-xl border border-[var(--m-line,#e7e3da)] bg-[var(--m-wash,#faf8f4)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-[var(--m-ink,#1b1a17)]">{row.name}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  row.status === 'rejected'
                    ? 'bg-danger-100 text-danger-700'
                    : row.status === 'in_review'
                      ? 'bg-info-100 text-info-700'
                      : 'bg-warn-100 text-warn-700'
                }`}
              >
                {row.status === 'rejected'
                  ? 'Rejected'
                  : row.status === 'in_review'
                    ? 'Needs a watch'
                    : row.grandfathered
                      ? 'Carried over'
                      : 'Pending'}
              </span>
            </div>

            {row.grandfathered ? (
              <p className="flex items-start gap-1.5 rounded-md bg-warn-50 px-2 py-1.5 text-[11px] leading-relaxed text-warn-800">
                <ShieldAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span>
                  Live, but never actually watched — carried over from the old still-frame-only
                  screen. Approving records a real review.
                </span>
              </p>
            ) : null}

            {row.sealBroken ? (
              <p className="flex items-start gap-1.5 rounded-md bg-danger-50 px-2 py-1.5 text-[11px] leading-relaxed text-danger-700">
                <ShieldAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span>
                  The frozen copy of this video is missing or has changed in storage. Prepare it
                  again before approving.
                </span>
              </p>
            ) : null}

            {row.videoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- moderator review clip, no caption track
              <video
                src={row.videoUrl}
                poster={row.posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full rounded-lg bg-black object-contain"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg bg-ink/5 px-3 text-center text-xs text-[var(--m-slate,#6a6e76)]">
                <Lock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Nothing frozen to watch yet
              </div>
            )}

            <div className="flex gap-2">
              {row.approvable ? (
                <button
                  type="button"
                  disabled={pending && busyId === row.eventId}
                  onClick={() => decide(row.eventId, 'approved')}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-success-700 disabled:opacity-50"
                >
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                  Approve
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending && busyId === row.eventId}
                  onClick={() => prepare(row.eventId)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--m-line,#e7e3da)] bg-white px-3 py-2 text-sm font-semibold text-[var(--m-ink,#1b1a17)] transition hover:bg-[var(--m-wash,#faf8f4)] disabled:opacity-50"
                >
                  <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Prepare for review
                </button>
              )}
              <button
                type="button"
                disabled={pending && busyId === row.eventId}
                onClick={() => decide(row.eventId, 'rejected')}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-danger-300 bg-white px-3 py-2 text-sm font-semibold text-danger-700 transition hover:bg-danger-50 disabled:opacity-50"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                Reject
              </button>
            </div>
            <a
              href={`/${row.publicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-[var(--m-slate,#6a6e76)] hover:text-mulberry"
            >
              Open couple page ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
