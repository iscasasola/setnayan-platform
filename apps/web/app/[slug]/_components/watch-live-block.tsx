import type { WatchLiveData } from '../_lib/types';
import { RoamWatchPicker } from './roam-watch-picker';

/**
 * Panood Watch-Live — the broadcast embedded on the day-of page (spec §7.5:
 * the live page leads with it for the loved ones watching from afar).
 * youtube-nocookie (privacy-enhanced — no tracking cookies before playback);
 * the URL was normalized/validated at save time (lib/panood-watch.ts) AND
 * re-validated at read time (lib/watch-live-links.ts), so the iframe src is
 * structurally a YouTube embed, never raw user input.
 *
 * DUAL-STREAM (owner-approved 2026-07-26): the couple may also be live on
 * Facebook at the same time (their encoder pushes to both — see
 * app/_components/facebook-dual-stream-card.tsx). Facebook appears as a LINK,
 * never an embed: the only Meta embed is a third-party Meta frame with Meta
 * cookies, and facebook.com is deliberately absent from next.config.ts
 * frame-src. Three shapes, all of which this component handles:
 *
 *   YouTube only  → today's markup, unchanged
 *   both          → the same player, with a second link beside "Open on YouTube"
 *   Facebook only → the link card below (no player — there is nothing to embed)
 */
export function WatchLiveBlock({
  watchLive,
  occasion = 'celebration',
}: {
  watchLive: WatchLiveData;
  /** EventWords.occasion — 'celebration' (default) or the funeral's 'gathering'.
   *  Reaches only assistive text (aria-labels, the iframe title). */
  occasion?: string;
}) {
  const facebookUrl = watchLive.facebookUrl ?? null;

  // Live Studio ROAM: when a multi-camera manifest is present, render the
  // camera/zone/venue picker instead of the single directed embed. Reuses this
  // block's existing render sites (day-of + landing), so no prop-threading change.
  // WAVE 10: side cameras are peer-to-peer and have NO YouTube id, so an event can
  // have them while its roam manifest is empty (the common shape — the director's cut
  // is the CAST single embed). Mount the picker for either, and hand it the plain
  // embed so "Main Stage" still points at the director's cut in that case.
  const guestCameras = watchLive.guestCameras ?? [];
  if ((watchLive.roam && watchLive.roam.length > 0) || guestCameras.length > 0) {
    return (
      <div className="space-y-2">
        <RoamWatchPicker
          manifest={watchLive.roam ?? []}
          eventId={watchLive.eventId}
          guestCameras={guestCameras}
          mainEmbedUrl={watchLive.embedUrl}
          mainWatchUrl={watchLive.watchUrl}
          occasion={occasion}
        />
        {facebookUrl ? <FacebookWatchCard href={facebookUrl} occasion={occasion} /> : null}
      </div>
    );
  }

  // Facebook-only: no player, just the door. Without this the page would render
  // nothing at all for a couple who chose Facebook as their single destination.
  if (!watchLive.embedUrl) {
    return facebookUrl ? <FacebookWatchCard href={facebookUrl} occasion={occasion} /> : null;
  }

  return (
    <section
      aria-label={`Watch the ${occasion} live`}
      className="overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-ink shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
          Watch live
        </p>
        <span className="flex items-center gap-3">
          {watchLive.watchUrl ? (
            <a
              href={watchLive.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
            >
              Open on YouTube
            </a>
          ) : null}
          {facebookUrl ? (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
            >
              Watch on Facebook
            </a>
          ) : null}
        </span>
      </div>
      <div className="aspect-video w-full">
        <iframe
          title={`Live broadcast of the ${occasion}`}
          src={watchLive.embedUrl}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      {/* NOTHING HERE KNOWS WHETHER A STREAM IS RUNNING (2026-08-05).
          The pulsing dot above and this whole block appear because the couple
          SAVED A LINK and the event is inside its day-of window — which is now
          noon the day before to noon the day after. The broadcast itself might
          be three hours of that. So the relative in Dubai who opens the page at
          8 AM sees a live badge and a player that says "video unavailable", and
          has no way to tell a stream that has not started from one that broke.
          One true sentence, said before they need it.

          The real fix is the couple (or their coordinator) flipping the
          broadcast on — the same shape as the host's Papic switch, owner-ruled
          2026-08-03. It needs a column and a control, and it is the next slice.
          Detecting it from YouTube is not an option: the Google account is
          suspended (appeal 73857927), so there is no API to ask. */}
      <p className="bg-ink px-4 pb-3 pt-1 text-xs leading-relaxed text-cream/60">
        If the ceremony hasn&rsquo;t started, the player above will say the video
        is unavailable. Nothing is wrong — check back a little later.
      </p>
    </section>
  );
}

/**
 * The standalone Facebook door — used when Facebook is the only destination, and
 * under the Roam picker. `href` is always the output of normalizeFacebookWatchUrl,
 * so it is structurally `https://www.facebook.com/…` or `https://fb.watch/…`.
 */
function FacebookWatchCard({
  href,
  occasion = 'celebration',
}: {
  href: string;
  occasion?: string;
}) {
  return (
    <section
      aria-label={`Watch the ${occasion} live on Facebook`}
      className="rounded-2xl border-2 border-terracotta/40 bg-ink px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
          Live on Facebook
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-cream/25 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-cream/10"
        >
          Watch on Facebook
        </a>
      </div>
    </section>
  );
}
