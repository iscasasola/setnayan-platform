import Link from 'next/link';
import { Video, ArrowRight } from 'lucide-react';

/**
 * Video guestbook (PABATI) — the day-of card. Auto-shows ONLY when the event
 * owns the active (admin-approved) PABATI pack: the parent grid passes
 * `pabatiActive` (resolved server-side via eventPabatiActive). When it isn't
 * active this renders nothing (the card disappears from the grid).
 *
 * When active it shows the live count + a thumbnail strip of the latest clean
 * greetings (presigned <video> posters), a "share the guest link" prompt, and a
 * manage link. With zero clips it nudges the couple to share the link.
 *
 * 5-second video greetings (up to 300). The collector is the guest recorder on
 * each guest's landing page + the /pabati/[eventId] share-link entry.
 */

export type PabatiClipThumb = {
  /** Stable key — the clip's UUID. */
  id: string;
  /** Presigned playback URL (the clip itself), or null when R2 isn't resolved. */
  url: string | null;
};

type Props =
  | { pabatiActive: false }
  | {
      pabatiActive: true;
      eventId: string;
      clips: PabatiClipThumb[];
      used: number;
      total: number;
      shareUrl: string;
    };

export function VideoGuestbookCard(props: Props) {
  // Not active → disappear from the grid (auto-show only when owned).
  if (!props.pabatiActive) return null;

  const { eventId, clips, used, total, shareUrl } = props;
  const remaining = Math.max(0, total - used);
  const previews = clips.filter((c) => c.url).slice(0, 6);

  return (
    <article className="space-y-3 rounded-2xl border border-mulberry/20 bg-mulberry/[0.03] p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-mulberry">
          <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Video guestbook
        </p>
        <span className="rounded-full bg-mulberry/10 px-2 py-0.5 text-xs font-medium text-mulberry">
          {used} / {total}
        </span>
      </header>

      {used > 0 ? (
        <>
          <h3 className="text-base font-semibold tracking-tight text-ink">
            {used} {used === 1 ? 'greeting' : 'greetings'} so far
          </h3>
          <p className="text-sm text-ink/60">
            5-second video greetings from your guests — {remaining} left of {total}.
          </p>

          {previews.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {previews.map((c) => (
                <video
                  key={c.id}
                  src={c.url ?? undefined}
                  // The first frame stands in as the thumbnail (no separate
                  // poster column — the clip's own frame shows muted, paused).
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-square w-full rounded-md bg-ink/[0.04] object-cover"
                />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold tracking-tight text-ink">
            No greetings yet
          </h3>
          <p className="text-sm text-ink/60">
            0 greetings — share the guest link and your guests can each leave a
            5-second video greeting (up to {total}).
          </p>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          href={shareUrl}
          className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-mulberry-600"
        >
          <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Share the guest link
        </Link>
        <Link
          href={`/dashboard/${eventId}/gallery`}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/10"
        >
          Manage
          <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </article>
  );
}
