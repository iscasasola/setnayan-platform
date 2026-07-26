import { ExternalLink, Video } from 'lucide-react';
import type { RoamRecording } from '@/lib/live-studio-recordings';

/**
 * "Your recordings" — THE RECORDING HANDOFF, on every couple-facing Live Studio
 * setup surface.
 *
 * `02_Specifications/09_Panood_Feature_Specification.md` § 6, "Recording Archive
 * (YouTube auto-archive only in V1)": every broadcast is auto-archived by YouTube
 * as an unlisted video at indefinite retention, and *"couples download from their
 * Setnayan dashboard via a link that resolves the YouTube watch URL through the
 * Data API."* § 6 also removed the parallel R2 archive from V1 — "to avoid paying
 * for storage of content that's already free on YouTube" — so nothing here copies
 * bytes anywhere.
 *
 * ⚠ WHY THIS IS A SHARED COMPONENT AND NOT A SECTION ON ONE PAGE. There are TWO
 * couple-facing Live Studio setup surfaces, and which one a couple uses depends on
 * a flag they cannot see:
 *   · flag OFF (prod today) → the legacy `/dashboard/[id]/studio/panood/setup`
 *   · flag ON  → the Wave 8 controller's `<SetupSheet>` at `/panood/control/[id]`
 * A recording that only appears on one of them is a recording the couple loses at
 * the flag flip. This is the same rule `FACEBOOK_REPLAY_WARNING` follows for the
 * same reason — it renders on both surfaces, never one.
 *
 * RENDERS NOTHING when there are no recordings, which is every event that has not
 * finished a broadcast. No empty state, no placeholder: a couple mid-planning
 * should not see a section about a video that does not exist.
 *
 * ⚠ THE COPY SAYS "WATCH", NOT "DOWNLOAD", ON PURPOSE. § 6 says "download", but
 * the mechanism it prescribes — a resolved watch URL — delivers watching. YouTube
 * only offers a file download to the channel's OWNER (via YouTube Studio), so the
 * claim holds for a couple who broadcast on their own channel and would be FALSE
 * for a Wave 9 pool broadcast on a Setnayan channel. The condition is stated in
 * the copy rather than assumed, and the pool-side file handoff is flagged to the
 * owner as unbuilt rather than implied here.
 */

/** Exported so a test can assert both surfaces render the same promise. */
export const RECORDINGS_HEADING = 'Your recordings';

function formatRecordingDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  return `${Math.max(m, 1)} min`;
}

export function LiveStudioRecordingsCard({
  recordings,
  /**
   * `compact` trims the section for the controller's setup SHEET, where Wave 8
   * put every setup control and vertical space is the scarce resource (the sheet
   * scrolls inside a `100dvh` shell that must never let the page scroll). Text
   * only — the same rows, the same links, the same tri-state notes.
   */
  compact = false,
}: {
  recordings: RoamRecording[];
  compact?: boolean;
}) {
  if (recordings.length === 0) return null;

  return (
    <section
      aria-labelledby="panood-recordings-heading"
      className="sn-tile space-y-4 p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          After the broadcast
        </p>
        <h2
          id="panood-recordings-heading"
          className={`flex items-center gap-2 font-semibold tracking-tight ${
            compact ? 'text-base' : 'text-xl'
          }`}
        >
          <Video
            aria-hidden
            className={compact ? 'h-4 w-4 text-terracotta' : 'h-5 w-5 text-terracotta'}
            strokeWidth={1.75}
          />
          {RECORDINGS_HEADING}
        </h2>
        <p className={`max-w-prose text-ink/65 ${compact ? 'text-xs' : 'text-sm'}`}>
          YouTube keeps an unlisted recording of every broadcast, and it stays up
          indefinitely. These are watch links — if your broadcast went out on your
          own YouTube channel, you can also download the file from YouTube Studio.
        </p>
      </div>

      <ul className="space-y-2">
        {recordings.map((rec) => (
          <li
            key={rec.videoId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-cream/60 px-4 py-3"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium text-ink">
                {rec.label}
                {rec.venueLabel ? (
                  <span className="text-ink/55"> · {rec.venueLabel}</span>
                ) : null}
              </p>
              <p className="text-xs text-ink/55">
                {rec.endedAt
                  ? `Ended ${new Date(rec.endedAt).toLocaleDateString('en-PH', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}`
                  : 'Broadcast finished'}
                {rec.durationSeconds
                  ? ` · ${formatRecordingDuration(rec.durationSeconds)}`
                  : ''}
              </p>
              {/* TRI-STATE, and null is not false. `archived === false` means
                  YouTube was asked and has no recording; `null` means we could not
                  ask (no token, or the API errored) and must not claim either way. */}
              {rec.archived === false ? (
                <p className="text-xs text-ink/70">
                  No recording on YouTube — this channel may not have carried video,
                  or the broadcast ran past YouTube&rsquo;s 12-hour archive limit.
                </p>
              ) : null}
              {rec.archived === null ? (
                <p className="text-xs text-ink/55">
                  We couldn&rsquo;t confirm this recording with YouTube just now.
                </p>
              ) : null}
            </div>
            <a
              href={rec.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/75 hover:text-ink"
            >
              Watch on YouTube
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
