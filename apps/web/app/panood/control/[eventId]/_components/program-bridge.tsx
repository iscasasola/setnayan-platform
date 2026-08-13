'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, MonitorPlay } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { installProgramBridge } from '@/lib/panood-program-bridge';
import { programSourceAllowed, type ProgramAirDecision } from '@/lib/live-studio-publish-pure';
import { useCameraFeed } from './camera-feeds';

/**
 * apps/web/.../live-studio-control/setup/_components/program-bridge.tsx
 *
 * ⭐ WAVE 5 — THE UNIFIED CONTROLLER'S PATH TO AIR.
 *
 * ── THE GAP THIS CLOSES ────────────────────────────────────────────────────
 * `/panood/program/[eventId]` is the REAL encode surface (spec § 4c): a chrome-less
 * window the host's encoder (OBS etc.) window-captures and streams to their own
 * YouTube. It cannot open its own WebRTC connection — the transport is ONE PUBLISHER
 * → ONE VIEWER per slot, so answering a phone's offer itself would STEAL the picture
 * from the host's own monitor mid-ceremony. So it reaches through `window.opener`
 * and re-renders the MediaStream objects its opener already holds
 * (lib/panood-program-bridge.ts).
 *
 * That bridge had exactly ONE installer: the LEGACY Cast control room. The unified
 * Wave 1–4 controller installed nothing, so a cut here reached the host's monitor and
 * then stopped — no window for the encoder to capture, no path to air at all. This is
 * that installer, using the SAME bridge (not a second one) and the SAME shared viewer
 * Wave 4 opened (`useCameraFeed`, never a new `watchPanoodCameras`).
 *
 * ── ⭐ AND IT IS A PAYWALL SURFACE ──────────────────────────────────────────
 * The program output is a publication path Setnayan does not own (see
 * lib/live-studio-publish.ts → decideProgramAir). Under "rehearse free" a host may
 * cut between every camera they have; if those cuts reached the encoder, a free host
 * could broadcast a full multi-cam wedding to their own channel for ₱0.
 *
 * So this component publishes `air.airSlot` — the slot the SERVER decided may go out
 * — and never `mainStageSlot`, the host's cut. For an entitled host those are the
 * same value and nothing is restricted. For a free host the program output stays
 * pinned to their ★ default channel while the cut moves freely on the monitor beside
 * it, and `requestedSource` carries the difference so the capture surface can NAME it
 * rather than silently airing a camera the controller says is off.
 *
 * `air` arrives already-decided from the server. It is NOT re-derived here, for the
 * same reason `watermark` never was: a paywall the browser computes is one devtools
 * edit from free. And because this half is tamperable in principle — it runs in the
 * host's own browser, holding their own cameras' streams — the pop-out re-resolves
 * the identical decision server-side on its own render and refuses to paint a source
 * this component was not allowed to send. Two independent points, one helper.
 *
 * ⚠ THE HONEST LIMIT, stated so nobody mistakes this for a wall. Rehearse-free means
 * every camera's media is delivered to the host's own browser by design — that is what
 * makes rehearsal free and costs ₱0. A host who rewrites their own browser's
 * JavaScript can therefore composite their own feeds, with or without us. What these
 * two gates guarantee is that NO SHIPPED SETNAYAN CODE PATH hands an un-entitled event
 * a multi-cam program window: the ordinary product does not do it, and there is no
 * setting, no column and no request that makes it do it. Making it stronger would mean
 * withholding cameras from the rehearsal, which is the one thing § 4d forbids.
 */
export function ProgramBridgeHost({
  eventId,
  air,
  isLive,
  airLabel,
  streamingEnabled,
  /**
   * The host's cut, for `requestedSource`. Given separately from `air` because the
   * cut is what the human did and `air.airSlot` is what they are permitted to send;
   * conflating the two is precisely the bug this whole component guards against.
   */
  mainStageSlot,
}: {
  eventId: string;
  /** Server-resolved program-output entitlement (lib/live-studio-publish.ts). */
  air: ProgramAirDecision;
  /** Is a broadcast up right now? Control-plane fact, mirrored to the pop-out. */
  isLive: boolean;
  /** Host's own name for what is going out — used only in the no-signal state. */
  airLabel: string;
  /**
   * NEXT_PUBLIC_PANOOD_STREAMING_ENABLED, resolved server-side — the same flag the
   * joining phone and Wave 4's viewer read. With it OFF no camera can deliver a
   * picture to anything, so the copy has to say the window will be empty rather than
   * imply a feed that cannot exist yet. NO FAKE DOORS (§ 4b): the window is still
   * genuinely useful for proving an OBS capture before the day, and that is exactly
   * what it then offers.
   */
  streamingEnabled: boolean;
  mainStageSlot: string | null;
}) {
  const toast = useToast();
  // Subscribe to the PERMITTED slot, not the cut. Wave 4's provider owns the single
  // WebRTC viewer; this is a read of what it already holds.
  const { stream } = useCameraFeed(air.airSlot);

  const bridgeRef = useRef<ReturnType<typeof installProgramBridge> | null>(null);
  const popoutRef = useRef<Window | null>(null);

  useEffect(() => {
    bridgeRef.current = installProgramBridge();
    return () => {
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
      // ⚠️ We deliberately do NOT close the pop-out — the legacy control room learned
      // this the hard way. This cleanup runs on ANY unmount, including an ordinary
      // client-side navigation, so closing the window here would kill a host's live
      // output the moment they tapped a link. The pop-out looks after itself: it
      // re-resolves the bridge on a timer and reattaches when this remounts.
    };
  }, []);

  // BELT AND BRACES on our own side: even with `air.airSlot` as the only subscription,
  // publish nothing if the resolved source is somehow not permitted. Cheap, and it
  // means a future edit that wires the cut in here by mistake fails closed.
  const allowed = programSourceAllowed(air, air.airSlot);

  useEffect(() => {
    bridgeRef.current?.publish({
      source: allowed ? air.airSlot : null,
      requestedSource: mainStageSlot,
      label: airLabel,
      live: isLive,
      stream: allowed ? stream : null,
      // Split/PiP need a mixing point that does not exist (phase 2 — spec § 4b).
      secondaryStream: null,
      splitRatio: 0.5,
      // ⚠ The LEGACY full-screen SETNAYAN paywall overlay (lib/panood-watermark.ts,
      // owner-locked 2026-07-21) is NOT published from this path, and that is a
      // deliberate abstention rather than a removal:
      //   • its 24-hour window is anchored on `panood_control_state.first_live_at`,
      //     which the unified go-live path (`goLivePanood`) never writes — feeding
      //     it here would put a full-screen watermark over a host who PAID ₱2,999,
      //     because a never-written anchor reads as 'awaiting-go-live'; and
      //   • free-tier branding on this surface is already resolved SERVER-SIDE on the
      //     pop-out itself, from the real entitlement, as the forced "POWERED BY
      //     SETNAYAN" lower third (Wave 2 · lib/live-studio-overlays.ts) — which is
      //     derived, never stored, so there is nothing a free host can switch off.
      // The multi-cam paywall on this path is `air`, not a watermark. The two owner
      // locks that contradict each other on free-tier branding (spec § 4c) are still
      // open and still the owner's to settle before this flag flips; nothing here
      // decides them, and the legacy control room's own watermark is untouched.
      overlay: false,
      overlayReason: air.owned ? 'window-open' : 'unpaid',
    });
  }, [air, allowed, airLabel, isLive, mainStageSlot, stream]);

  function openProgramPopout(): void {
    const existing = popoutRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }
    const win = window.open(
      `/panood/program/${eventId}`,
      // A NAMED target so repeat taps reuse the same captured window instead of
      // spawning a second one the host has to re-add as an OBS source.
      `setnayan-program-${eventId}`,
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no',
    );
    if (!win) {
      toast.error('Your browser blocked the pop-out. Allow pop-ups for Setnayan, then try again.');
      return;
    }
    popoutRef.current = win;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-cream/70 px-3 py-2.5">
      <MonitorPlay aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink/65">
        <span className="block font-semibold text-ink">Program output for your encoder</span>
        Opens a clean window with nothing but Channel 1 on it. Add it in OBS as a{' '}
        <span className="font-medium text-ink/80">Window Capture</span> and stream that to
        YouTube — keep this tab open, it is what feeds the window.
        {!streamingEnabled ? (
          <span className="mt-1 block text-ink/50">
            The window will be empty for now — live camera video arrives with the streaming
            rollout. You can still set up and test your OBS capture with it today.
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={openProgramPopout}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-[11.5px] font-semibold text-ink/75 transition-colors hover:border-terracotta/45 hover:text-terracotta"
      >
        <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Open program output
      </button>
    </div>
  );
}
