'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Radio, Square, AlertCircle, Link2 } from 'lucide-react';
import { useSaveLoader } from '@/components/sd-loader';
import { automaticGoLiveAvailable, endOnAirTarget } from '@/lib/live-studio-manual-air';
import {
  goLivePanood,
  endPanoodBroadcast,
  type GoLiveResult,
} from '@/app/dashboard/[eventId]/studio/panood/setup/actions';
import { endManualOnAir } from './actions';

/**
 * TRANSPORT — the approved single-screen controller's go-live control
 * (Wave 1 · Live_Studio_Unified_Spec_2026-07-25 § 4b; the `live-studio-control.html`
 * prototype's `.transport` row).
 *
 * One wide button, thumb-height, directly under the Channel 1 monitor: **Go live**
 * turns terracotta → signal red **End** while on air. It is the ONLY go-live control
 * on this screen — it drives the exact same, already-live server actions the panood
 * GoLiveCard uses (`goLivePanood` / `endPanoodBroadcast`, which revalidate this
 * route), so nothing about the broadcast path is re-implemented, only re-laid-out.
 * The encoder details (RTMP server + stream key) stay in the secondary setup region
 * below — they're setup, not the operating loop.
 *
 * ⚠ ENDING IS NOT ONE ACTION. `isLive` is true for TWO different routes (see
 * `resolveLiveAir`) — a real `panood_broadcasts` row, or a host who started their
 * own stream and flipped the by-hand switch. Only the first has anything for
 * `endPanoodBroadcast` to close; calling it for the second wipes the watch link the
 * host pasted and leaves the by-hand flag on, so the button lies about having ended
 * anything. `liveSource` + `endOnAirTarget` route to `endManualOnAir` instead. The
 * separate by-hand "We're on air" switch further down the page is untouched by this
 * — this is only about what the red button in THIS row does.
 *
 * HONEST GATING (no dead button): going live needs Setnayan's Google OAuth client
 * configured AND a route to air for this event. When either is missing this renders
 * the plain-English reason with a jump to the connect step instead of a button that
 * cannot work.
 *
 * ⚠ A ROUTE TO AIR IS EITHER CHANNEL. `connected` used to mean "this event has a BYO
 * `oauth_grants` row", which hid the button from every host served by a SETNAYAN POOL
 * channel — the model Wave 9 shipped and `goLivePanood` has preferred ever since. It
 * now means "BYO grant OR a healthy pool channel" (lib/live-studio-readiness.ts →
 * poolRouteToAir), which is the question the action itself asks.
 *
 * Going live is FREE for every host (owner model 2026-06-26) — the LIVE_STUDIO SKU
 * gates broadcasting MORE THAN ONE camera, never this button. So there is still no
 * entitlement prop here.
 *
 * ⭐ WAVE 3 (owner-locked 2026-07-25 · § 4d "rehearse free, pay to broadcast"): the
 * paywall is stated AT THIS MOMENT rather than as padlocks over the tiles — but as a
 * sibling element the page owns (the "Rehearse free · Unlock … to broadcast all your
 * cameras" line, which Wave 8 moved into the channel column beside the cameras it is
 * about, plus the persistent unlock bar pinned to the foot of the viewport), NOT as a
 * disabled button. This button must
 * stay live and free for every host: the live /pricing page promises "Single-camera
 * livestream" free, and breaking that to sell the multi-cam upgrade would be selling
 * against our own published promise.
 */
export function TransportRow({
  eventId,
  oauthReady,
  connected,
  isLive,
  liveSource,
  connectHref,
}: {
  eventId: string;
  /**
   * Setnayan's Google OAuth client is configured — i.e. the YOUTUBE_OAUTH_* env vars
   * resolve. ⚠ NOT a Google app-review verdict, whatever the old copy claimed.
   */
  oauthReady: boolean;
  /** This event has a route to air: a live BYO grant OR a healthy pool channel. */
  connected: boolean;
  /** There is an active broadcast right now. */
  isLive: boolean;
  /**
   * Which route put the event on air — `resolveLiveAir`'s `source`
   * (lib/live-studio-manual-air.ts). Decides what "End" actually does: a real
   * `panood_broadcasts` row is torn down via `endPanoodBroadcast`; a by-hand host
   * (no such row) is turned off via `endManualOnAir` instead, so the button never
   * claims to end a broadcast that was never created. See `endOnAirTarget`.
   */
  liveSource: 'broadcast' | 'manual' | null;
  /**
   * Anchor for the "Connect YouTube" step. ⭐ WAVE 8: the controller no longer
   * scrolls, so `#connect` does not jump — it OPENS THE SETUP SHEET at that
   * section (see _components/setup-sheet.tsx, which listens for the hash). The
   * prop keeps its shape so this component stays a dumb renderer.
   */
  connectHref: string;
}) {
  const [error, setError] = useState<string | null>(null);
  // A SUCCESS the host still needs to know about — today, cameras the Setnayan
  // channel could not carry. That count existed and was thrown away, so an
  // operator with a QR code turned up on the day and never appeared on air.
  // Separate from `error`: the broadcast went out, there is nothing to retry.
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  function run(fn: () => Promise<GoLiveResult>, step: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await save.run(fn, { steps: [step], hint: 'Please wait' });
      if ('error' in result) setError(result.error);
      else setNotice(result.notice ?? null);
      // On success the action revalidates this path — the server re-renders with
      // the new broadcast state, so no client navigation is needed.
    });
  }

  // The SHARED predicate — see lib/live-studio-manual-air.ts. The page asks the same
  // question to decide whether to offer the by-hand on-air switch, and two copies of
  // it is how the two controls drift into disagreeing about whether this host has
  // any way to go on air at all.
  const blocked = automaticGoLiveAvailable({ oauthReady, connected })
    ? null
    : !oauthReady
      ? 'One-tap go-live is not configured on Setnayan’s side yet. That is on us, not on you — start the stream yourself and use the “We’re on air” switch below, and your control room lights up the same way.'
      : 'No broadcast channel is ready for this event yet. Connect your own YouTube channel below, or wait for Setnayan to free one up — then this button goes live in one tap.';

  return (
    <div className="space-y-2">
      {blocked ? (
        <Link
          href={connectHref}
          className="flex min-h-[52px] items-center gap-2 rounded-xl border border-dashed border-ink/20 bg-cream/70 px-4 py-2.5 text-sm text-ink/65 transition-colors hover:border-terracotta/40 hover:text-ink"
        >
          <Link2 aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span>{blocked}</span>
        </Link>
      ) : isLive ? (
        (() => {
          // DEFECT 1 fix — see endOnAirTarget's doc comment. A manual-only host has
          // no panood_broadcasts row for endPanoodBroadcast to close; calling it
          // anyway wiped their pasted watch_url and left panood_manual_on_air_at
          // (what isLive actually reads) untouched, so "End broadcast" never ended
          // anything the host could see change.
          const manualOnly = endOnAirTarget(liveSource) === 'manual';
          return (
            <button
              type="button"
              onClick={() =>
                run(
                  () => (manualOnly ? endManualOnAir(eventId) : endPanoodBroadcast(eventId)),
                  manualOnly ? 'Turning off the on-air light' : 'Ending the broadcast',
                )
              }
              disabled={pending}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-danger-600 px-4 font-mono text-sm font-bold uppercase tracking-[0.08em] text-cream transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Square aria-hidden className="h-4 w-4" strokeWidth={2.5} />
              {pending
                ? manualOnly
                  ? 'Turning off…'
                  : 'Ending…'
                : manualOnly
                  ? 'End (on air by hand)'
                  : 'End broadcast'}
            </button>
          );
        })()
      ) : (
        <button
          type="button"
          onClick={() => run(() => goLivePanood(eventId), 'Going live')}
          disabled={pending}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-mulberry px-4 font-mono text-sm font-bold uppercase tracking-[0.08em] text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Radio aria-hidden className="h-4 w-4" strokeWidth={2.25} />
          {pending ? 'Going live…' : 'Go live'}
        </button>
      )}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger-300/70 bg-danger-50 px-3 py-2 text-xs text-danger-900"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </p>
      ) : null}

      {/* Cameras the channel refused to carry. role="status", not "alert" — the
          show is on air; this is a thing to fix, not a thing that failed. */}
      {notice ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[color:var(--sn-warning)]/40 bg-[var(--sn-warning-soft)] px-3 py-2 text-xs text-[color:var(--sn-warning-deep)]"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>{notice}</span>
        </p>
      ) : null}
    </div>
  );
}
