import type { WatchLiveData } from '../_lib/types';
import { RoamWatchPicker } from './roam-watch-picker';

/**
 * Panood Watch-Live — the broadcast embedded on the day-of page (spec §7.5:
 * the live page leads with it for the loved ones watching from afar).
 * youtube-nocookie (privacy-enhanced — no tracking cookies before playback);
 * the URL was normalized/validated at save time (lib/panood-watch.ts), so the
 * iframe src is structurally a YouTube embed, never raw user input.
 */
export function WatchLiveBlock({ watchLive }: { watchLive: WatchLiveData }) {
  // Live Studio ROAM: when a multi-camera manifest is present, render the
  // camera/zone/venue picker instead of the single directed embed. Reuses this
  // block's existing render sites (day-of + landing), so no prop-threading change.
  if (watchLive.roam && watchLive.roam.length > 0) {
    return <RoamWatchPicker manifest={watchLive.roam} />;
  }
  return (
    <section
      aria-label="Watch the celebration live"
      className="overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-ink shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-400" />
          Watch live
        </p>
        <a
          href={watchLive.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
        >
          Open on YouTube
        </a>
      </div>
      <div className="aspect-video w-full">
        <iframe
          title="Live broadcast of the celebration"
          src={watchLive.embedUrl}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </section>
  );
}
