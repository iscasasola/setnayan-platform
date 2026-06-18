'use client';

/**
 * Admin moderation panel for Save-the-Date videos (iteration 0024).
 *
 * The automatic poster-frame NSFW screen (lib/nsfw-screen · screenStdVideo)
 * covers the normal path: 'clean' → approved (plays live), 'nsfw_blocked' →
 * rejected. This panel is the human override for the edges the auto-screen
 * leaves — a video stuck at 'pending' (poster extraction / model hiccup left it
 * never-screened, so it silently never goes live) or a false-positive
 * 'rejected'. Only an 'approved' video plays on the public couple page.
 *
 * Rendered inside /admin/reveal-studio; rows are passed in from the server page.
 * Empty list → the whole panel is hidden (no clutter when nothing's waiting).
 */

import { useState, useTransition } from 'react';
import { Check, X, Film } from 'lucide-react';
import { setStdVideoModeration } from './actions';

export type PendingStdVideo = {
  eventId: string;
  publicId: string;
  name: string;
  status: 'pending' | 'rejected';
  videoUrl: string | null;
  posterUrl: string | null;
};

export function StdVideoModeration({ initial }: { initial: PendingStdVideo[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const decide = (eventId: string, decision: 'approved' | 'rejected') => {
    setError(null);
    setBusyId(eventId);
    startTransition(async () => {
      const r = await setStdVideoModeration(eventId, decision);
      if (r.ok) {
        setRows((prev) => prev.filter((row) => row.eventId !== eventId));
      } else {
        setError(r.error || 'Could not save — try again.');
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
        <h2 className="text-lg font-semibold text-[var(--m-ink,#1e2229)]">
          Save-the-Date videos ({rows.length})
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--m-slate,#4f535b)]">
          These couple videos are awaiting (or failed) the automatic screen, so they don&rsquo;t
          play on the public page yet. Watch each and approve to make it live, or reject to keep
          the couple&rsquo;s photo gallery instead.
        </p>
      </div>

      {error ? (
        <p className="mb-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
              <p className="truncate text-sm font-medium text-[var(--m-ink,#1e2229)]">{row.name}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  row.status === 'rejected'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {row.status === 'rejected' ? 'Rejected' : 'Pending'}
              </span>
            </div>

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
              <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-ink/5 text-xs text-[var(--m-slate,#6a6e76)]">
                Video unavailable
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending && busyId === row.eventId}
                onClick={() => decide(row.eventId, 'approved')}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                Approve
              </button>
              <button
                type="button"
                disabled={pending && busyId === row.eventId}
                onClick={() => decide(row.eventId, 'rejected')}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                Reject
              </button>
            </div>
            <a
              href={`/${row.publicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-[var(--m-slate,#6a6e76)] hover:text-terracotta"
            >
              Open couple page ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
