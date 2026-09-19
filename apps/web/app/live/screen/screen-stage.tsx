'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIVE_SCREEN_POLL_MS } from '@/lib/live-screens';
import type { LoadedScreen } from '../_lib/load-screen';

type Ready = Extract<LoadedScreen, { state: 'ready' }>;

/**
 * The venue screen's stage (DAY-12).
 *
 * POLLING: `router.refresh()` every LIVE_SCREEN_POLL_MS re-runs the server
 * loader, which re-checks the device token against the row and returns the
 * current mode. A mirror iframe keeps the same `src` across refreshes, so React
 * leaves it mounted and the stream does not restart on every poll.
 *
 * A BLIP KEEPS THE PICTURE. When the loader returns `down` (a refused read),
 * the stage keeps showing the last good picture with a small "reconnecting"
 * mark, rather than replacing a room's screen with an error.
 */
export function ScreenStage({ loaded }: { loaded: Extract<LoadedScreen, { state: 'ready' | 'down' }> }) {
  const router = useRouter();
  const [lastGood, setLastGood] = useState<Ready | null>(loaded.state === 'ready' ? loaded : null);
  useEffect(() => {
    if (loaded.state === 'ready') setLastGood(loaded);
  }, [loaded]);
  const shown = loaded.state === 'ready' ? loaded : lastGood;
  const reconnecting = loaded.state === 'down';

  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), LIVE_SCREEN_POLL_MS);
    return () => window.clearInterval(t);
  }, [router]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-[#F5EFE6]" data-testid="live-screen">
      {shown ? <Picture screen={shown} /> : <Waiting />}
      {reconnecting ? (
        <p className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-[#F5EFE6]/70">
          Reconnecting…
        </p>
      ) : null}
    </main>
  );
}

function Picture({ screen }: { screen: Ready }) {
  const { picture, brand } = screen;
  if (picture.kind === 'off') return <div className="h-full w-full bg-black" data-mode="off" />;
  if (picture.kind === 'mirror') {
    return (
      <div className="relative h-full w-full" data-mode="mirror">
        <iframe
          src={picture.embedUrl}
          title={`${brand.displayName} — livestream`}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="h-full w-full border-0"
        />
        {/* Owner ruling 2026-09-20: the mirror may run in the room only if it
            SAYS it is behind. Always rendered with the mirror — never optional. */}
        <p
          data-testid="mirror-delay-notice"
          className="pointer-events-none absolute left-6 top-6 rounded-full bg-black/70 px-4 py-2 text-base font-medium text-[#F5EFE6]"
        >
          {picture.notice}
        </p>
      </div>
    );
  }
  return <LiveBackground brand={brand} />;
}

function LiveBackground({ brand }: { brand: Ready['brand'] }) {
  const accent = brand.color ?? '#E5794E';
  const date = formatEventDate(brand.eventDate);
  return (
    <div
      data-mode="live_bg"
      className="flex h-full w-full flex-col items-center justify-center bg-[#17160F] px-8 text-center"
      style={{ backgroundImage: `radial-gradient(ellipse at center, ${accent}22 0%, transparent 65%)` }}
    >
      {brand.markDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- an inert data: URI of an already-sanitized SVG, same technique as the broadcast overlay
        <img src={brand.markDataUri} alt="" className="h-[38vh] w-auto max-w-[70vw] animate-[pulse_8s_ease-in-out_infinite]" />
      ) : (
        <p
          className="font-serif text-[22vh] leading-none tracking-tight animate-[pulse_8s_ease-in-out_infinite]"
          style={{ color: accent }}
        >
          {brand.initials}
        </p>
      )}
      <p className="mt-[4vh] text-[5vh] font-semibold tracking-tight">{brand.displayName}</p>
      {date ? <p className="mt-[1.5vh] text-[2.6vh] uppercase tracking-[0.3em] text-[#F5EFE6]/60">{date}</p> : null}
    </div>
  );
}

function Waiting() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#17160F]">
      <p className="text-2xl text-[#F5EFE6]/60">Connecting…</p>
    </div>
  );
}

/** `event_date` is a calendar date; read it at noon UTC so no zone shifts the day. */
function formatEventDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(`${raw.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
