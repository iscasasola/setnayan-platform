'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Radio, Square, Loader2, Smartphone, AlertCircle } from 'lucide-react';
import { PanoodBroadcaster } from '@/lib/native/panood-broadcaster';
import {
  createBroadcast,
  goLiveBroadcast,
  endBroadcast,
} from '../actions';

/**
 * Panood on-device broadcaster control (P1). Shown only inside the native
 * Capacitor app — in a plain browser the native plugin can't run, so we show a
 * "use the app" note instead. Drives the full P1 loop:
 *   createBroadcast (server) → PanoodBroadcaster.start (native push) →
 *   goLiveBroadcast (server: writes panood_watch_url → event-page embed) →
 *   PanoodBroadcaster.stop + endBroadcast.
 */
type Phase = 'idle' | 'starting' | 'live' | 'stopping' | 'error';

export function BroadcastControl({
  eventId,
  youtubeConnected,
}: {
  eventId: string;
  youtubeConnected: boolean;
}) {
  const [isNative, setIsNative] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  async function start() {
    setError(null);
    setPhase('starting');
    try {
      const res = await createBroadcast(eventId);
      if (!res.ok) {
        setError(
          res.error === 'channel_not_live_enabled'
            ? 'Your YouTube channel isn’t live-streaming-enabled yet (enable it in YouTube Studio — a fresh channel needs ~24h).'
            : res.error === 'youtube_not_connected'
              ? 'Connect your YouTube channel first (Step 1 above).'
              : `Couldn’t create the broadcast: ${res.error}`,
        );
        setPhase('error');
        return;
      }
      // Hand the RTMP target to the native encoder; it begins publishing the camera.
      await PanoodBroadcaster.start({
        ingestionUrl: res.ingestionUrl,
        streamKey: res.streamKey,
        resolution: '720p',
        facing: 'back',
      });
      // YouTube auto-goes-live when the encoder connects; this writes the watch
      // URL so the event-page embed lights up.
      await goLiveBroadcast(eventId);
      setPhase('live');
    } catch (e) {
      setError((e as Error).message || 'Broadcast failed to start.');
      setPhase('error');
    }
  }

  async function stop() {
    setPhase('stopping');
    try {
      await PanoodBroadcaster.stop().catch(() => {});
      await endBroadcast(eventId);
    } finally {
      setPhase('idle');
    }
  }

  if (!isNative) {
    return (
      <section className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Go live from your camera
        </h2>
        <p className="inline-flex items-start gap-2 text-sm text-ink/65">
          <Smartphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          Open the <strong>Setnayan app</strong> on your iPad or phone to broadcast —
          the live camera runs in the app, not the browser.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Step 2 · go live
        </p>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Go live from this device
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Setnayan creates the broadcast on your channel and pushes this device’s
          camera straight to it — your event page shows the live player within a
          few seconds.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {error}
        </p>
      ) : null}

      {phase === 'live' ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-medium text-cream transition hover:bg-ink/90"
        >
          <Square aria-hidden className="h-4 w-4" strokeWidth={2} />
          End broadcast
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={!youtubeConnected || phase === 'starting' || phase === 'stopping'}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600 disabled:opacity-50"
        >
          {phase === 'starting' ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Going live…
            </>
          ) : (
            <>
              <Radio aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Go live
            </>
          )}
        </button>
      )}

      {phase === 'live' ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100/80 px-3 py-1.5 text-xs font-medium text-emerald-950"
        >
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
          You’re live — your event page is showing the broadcast.
        </p>
      ) : null}
    </section>
  );
}
