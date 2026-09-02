'use client';

import { useEffect, useRef, useState } from 'react';
import { SetnayanOverlay } from '@/app/dashboard/[eventId]/studio/panood/broadcast/_components/setnayan-overlay';
import type {
  MonogramPosition,
  QrPosition,
  ResolvedOverlays,
} from '@/lib/live-studio-overlays';
import { programSourceAllowed, type ProgramAirDecision } from '@/lib/live-studio-publish-pure';
import {
  clampSplitRatio,
  EMPTY_FRAME,
  resolveProgramBridge,
  type ProgramBridge,
  type BridgeFailure,
  type ProgramFrame,
} from '@/lib/panood-program-bridge';

/**
 * The OBS capture surface — the chrome-less PROGRAM output.
 *
 * The couple sets OBS to window-capture THIS window once (Program window +
 * their YouTube/Facebook stream key → Start Streaming) and never touches it
 * again. Everything on screen here is either live video or, when there is no
 * signal, a deliberately plain card — because whatever this window shows is what
 * gets broadcast. No controls, no branding, no toasts, no "on air" badge: chrome
 * would be composited into the couple's stream.
 *
 * It renders the streams the control room already holds, reached through
 * `window.opener` (see lib/panood-program-bridge). It NEVER opens its own
 * WebRTC connection — doing so would steal the phones' streams from the
 * operator's own monitor.
 *
 * Rendered as a fixed full-viewport layer so it covers the dashboard chrome it
 * is nested inside; OBS then captures the whole window with nothing but program.
 */
export function PanoodProgramSurface({
  overlays,
  qrSrc,
  lowerThirdFallback,
  air,
}: {
  /**
   * WAVE 2 broadcast extras (Live Studio · owner-locked 2026-07-25), resolved
   * SERVER-SIDE against the entitlement and handed down already-decided — exactly
   * like `frame.overlay`, and for the same reason: this surface must never re-derive
   * a paywall decision, or it becomes the soft door to a clean feed. Null = nothing
   * to draw (flag off, or every overlay switched off).
   *
   * These composite HERE, on the window the couple's encoder captures. That is the
   * whole ₱0 story: no second feed, no server mixer, no per-minute cost.
   */
  overlays: ResolvedOverlays | null;
  /** The event's real scan-to-join QR (the shipped /api/website/qr/[slug] PNG). */
  qrSrc: string | null;
  /** Title fallback when a paid host enabled the bar but typed nothing. */
  lowerThirdFallback: string;
  /**
   * ⭐ WAVE 5 — THE PROGRAM-OUTPUT PAYWALL, resolved SERVER-SIDE on this route's own
   * render (see page.tsx) and never re-derived here.
   *
   * This surface is the one publication path Setnayan does not own: whatever it shows,
   * the host's encoder can send to the host's own YouTube. So an un-entitled event may
   * paint exactly ONE camera here — its ★ default channel — and this component refuses
   * any other source REGARDLESS OF WHAT THE OPENER SENDS. The bridge lives on a plain
   * `window` property in the host's own browser; treating anything that arrives over it
   * as authorised would make the paywall a suggestion.
   *
   * Null = the flag is off, or this event has no Live Studio channels (a legacy Cast
   * broadcast) — nothing is restricted and the surface behaves exactly as before.
   */
  air: ProgramAirDecision | null;
}) {
  const [frame, setFrame] = useState<ProgramFrame>(EMPTY_FRAME);
  const [failure, setFailure] = useState<BridgeFailure | null>(null);

  useEffect(() => {
    // RE-RESOLVE, never latch.
    //
    // The first version resolved the bridge once in a `[]` effect and held that object forever.
    // Two ordinary operator actions broke it permanently and silently:
    //   • F5 on the control room — a reload runs no React cleanup, so the old bridge is never
    //     disposed; the reloaded tab installs a NEW bridge over the same key while this window
    //     still holds the DEAD one. `opener.closed` is false after a reload, so the only liveness
    //     probe said "fine" while the <video> held its last decoded frame — a still photograph
    //     going out live, with no error state.
    //   • Any client-side navigation in the console — same orphaning.
    //
    // So we re-resolve on the same cheap timer that already watched the opener. When the console
    // remounts, this window reattaches to the new bridge and resumes on its own.
    let bound: ProgramBridge | null = null;
    let unsubscribe: (() => void) | null = null;

    function attach(bridge: ProgramBridge) {
      bound = bridge;
      unsubscribe?.();
      setFailure(null);
      setFrame(bridge.get());
      unsubscribe = bridge.subscribe(setFrame);
    }

    function poll() {
      const opener = window.opener as Window | null;
      if (!opener || opener.closed) {
        // A genuinely closed console is terminal — say so rather than hold a frozen frame.
        unsubscribe?.();
        unsubscribe = null;
        bound = null;
        setFailure('opener-closed');
        return;
      }
      const resolved = resolveProgramBridge();
      if (typeof resolved === 'string') {
        // Console is mid-remount (reload / navigation). Report it, keep polling, recover.
        if (bound) {
          unsubscribe?.();
          unsubscribe = null;
          bound = null;
        }
        setFailure(resolved);
        return;
      }
      // Identity check: a reloaded console publishes a DIFFERENT bridge object over the same key.
      if (resolved !== bound) attach(resolved);
    }

    poll();
    const timer = setInterval(poll, 2_000);
    return () => {
      clearInterval(timer);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    document.title = 'Setnayan Program output';
  }, []);

  // ── WAVE 5 · THE GATE, applied to the frame that actually arrived ──────────────
  //
  // `air` was decided on the server from `orders`; this is the only place its verdict
  // meets a live frame. Anything the opener sends that is not on the permitted list is
  // dropped — a tampered console, a hand-installed bridge, or simply a stale frame from
  // before an entitlement lapsed all land in the same branch.
  //
  // A refused source shows the WITHHELD CARD, not a black frame and not a substituted
  // camera: a black rectangle going out live is indistinguishable from a crash, and
  // quietly airing a different camera than the controller says is on would be the
  // fake this whole surface exists to avoid.
  const sourceAllowed = air ? programSourceAllowed(air, frame.source) : true;
  const refusedSource = Boolean(air?.enforced && !sourceAllowed);
  const stream = sourceAllowed ? frame.stream : null;
  const secondaryStream = sourceAllowed ? frame.secondaryStream : null;
  // The host's cut is real and permitted, but it is NOT the channel going out — the
  // free tier's program output is pinned. Say which one is, on the picture, because
  // this window is the only place the difference is observable at broadcast time.
  const cutWithheld = Boolean(
    air?.enforced &&
      sourceAllowed &&
      frame.requestedSource &&
      frame.requestedSource !== frame.source,
  );

  return (
    // A real full-viewport route now, not a layer fighting the dashboard shell for cover.
    // `h-[100dvh]` (not `fixed`) because this page owns the whole window — and because a
    // view-transition-named ancestor once turned `fixed` into a zero-height containing block
    // and silently rendered nothing at all.
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-black">
      {failure ? (
        <BridgeFailureCard failure={failure} />
      ) : (
        <>
          {refusedSource ? (
            <WithheldCard />
          ) : secondaryStream && stream ? (
            <SplitComposite
              primary={stream}
              secondary={secondaryStream}
              ratio={frame.splitRatio}
            />
          ) : stream ? (
            <StreamLayer stream={stream} />
          ) : (
            <NoSignalCard label={frame.label} />
          )}
          {/* WAVE 2 — the broadcast extras, composited into the captured picture.
              Drawn UNDER the paywall overlay below: when that is on the whole frame
              is watermarked anyway, and the ordering makes it impossible for an
              overlay to be used to obscure the paywall. */}
          {overlays ? (
            <BroadcastOverlays
              overlays={overlays}
              qrSrc={qrSrc}
              lowerThirdFallback={lowerThirdFallback}
            />
          ) : null}
          {/* WAVE 5 — the host's cut is not what is going out. Small, bottom-left, and
              deliberately ON the captured picture: this window is the only place the
              difference is visible while broadcasting, and a controller that says
              "CH 4 on air" over a stream carrying CH 2 is exactly the kind of silent
              mismatch a couple would only discover afterwards. */}
          {cutWithheld ? (
            <PinnedChannelNotice label={frame.label} liftedForLowerThird={Boolean(overlays?.lowerThird)} />
          ) : null}
          {/* The LEGACY full-screen paywall. Server-decided upstream and carried over the
              bridge — this surface never re-derives it. Covers every branch above, so OBS
              cannot capture a clean frame from any state while the overlay is on.
              (The unified controller does not publish it; see _components/program-bridge.) */}
          {frame.overlay && <SetnayanOverlay size="full" reason={frame.overlayReason} />}
          {frame.overlay && <ObsOrderingNotice />}
        </>
      )}
    </div>
  );
}

/**
 * WAVE 2 · the ₱0 broadcast extras, drawn as DOM layers on the captured window —
 * the monogram bug, the lower third, and the event's scan-to-join QR.
 *
 * WHY THIS IS THE REAL COMPOSITING POINT: OBS captures this WINDOW's picture, so a
 * DOM layer here IS in the couple's broadcast. That is already proven — it is
 * exactly how the SETNAYAN paywall overlay reaches air. No second feed, no server
 * mixer, no per-minute cost: ₱0, which is the only reason these ship in V1.
 *
 * `pointer-events-none` throughout: this window is output, never a control surface.
 * Sizes are absolute px, not viewport units, because the capture is a fixed-size
 * window and a bug that rescales with the operator's monitor is a bug that lands
 * somewhere different on air than it did in rehearsal.
 */
function BroadcastOverlays({
  overlays,
  qrSrc,
  lowerThirdFallback,
}: {
  overlays: ResolvedOverlays;
  qrSrc: string | null;
  lowerThirdFallback: string;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {overlays.monogram ? (
        <span className={`absolute ${positionClass(overlays.monogram.position)}`}>
          {overlays.monogram.markDataUri ? (
            // Inert data URI, already sanitized by safeMonogramSvg (SEC-3) — no optimizer benefit.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={overlays.monogram.markDataUri}
              alt=""
              className="h-16 w-16 object-contain drop-shadow-lg"
            />
          ) : (
            <span className="rounded-full border border-white/35 bg-black/35 px-5 py-2 font-serif text-2xl italic text-white">
              {overlays.monogram.text}
            </span>
          )}
        </span>
      ) : null}

      {overlays.eventQr && qrSrc ? (
        <span
          className={`absolute ${positionClass(
            overlays.eventQr.position,
          )} flex flex-col items-center gap-1 rounded-xl bg-white/95 p-2.5`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- an API-route PNG;
              the image optimizer would add a hop and a cache for no benefit. */}
          <img src={qrSrc} alt="" width={112} height={112} className="h-28 w-28" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
            Scan to join
          </span>
        </span>
      ) : null}

      {overlays.lowerThird ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-10 pb-8 pt-20">
          <span className="h-14 w-[5px] shrink-0 rounded-sm bg-[#D96B4A]" />
          <span className="min-w-0">
            <span
              className={`block truncate text-xl font-bold uppercase tracking-[0.1em] ${
                overlays.lowerThird.forced ? 'text-[#D96B4A]' : 'text-white'
              }`}
            >
              {overlays.lowerThird.title || lowerThirdFallback}
            </span>
            {overlays.lowerThird.subtitle ? (
              <span className="mt-1 block truncate text-base text-white/80">
                {overlays.lowerThird.subtitle}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Corner → placement, for the capture surface. Mirrors `overlayPositionClass` in
 * lib/live-studio-overlays.ts but at broadcast scale (wider insets, and the bottom
 * corners lifted further to clear the taller lower third here). The CORNER SET is
 * the shared one; only the spacing differs, so a host's choice cannot land in a
 * different corner than the controller promised.
 */
function positionClass(position: MonogramPosition | QrPosition): string {
  switch (position) {
    case 'top-right':
      return 'right-10 top-10';
    case 'top-left':
      return 'left-10 top-10';
    case 'bottom-right':
      return 'bottom-40 right-10';
    case 'bottom-left':
      return 'bottom-40 left-10';
    case 'top-center':
      return 'left-1/2 top-10 -translate-x-1/2';
  }
}

/**
 * One full-bleed video. `object-contain` — never crop the couple's frame.
 *
 * UNMUTED, deliberately, and only here.
 *
 * OBS captures this WINDOW's picture; it does not capture a muted element's audio. For the vows to
 * reach the couple's YouTube, this surface has to actually make sound, which OBS then picks up via
 * Desktop/Application Audio Capture. The control-room monitor stays muted on purpose — the operator
 * is usually in the same room as a camera, and an unmuted monitor there is a feedback loop.
 *
 * Autoplay policy is the catch: a browser may refuse to start an unmuted element. This window is
 * opened by a click, so it normally has activation — but if the unmuted play is rejected we FALL
 * BACK TO MUTED rather than lose the picture. A silent broadcast is bad; a black one is worse.
 */
function StreamLayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted = false;
    void el.play().catch(() => {
      el.muted = true;
      void el.play().catch(() => {});
    });
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      playsInline
      autoPlay
      // NOT `muted` — see above. The effect re-asserts it and degrades on rejection.
      className="h-full w-full object-contain"
    />
  );
}

/**
 * Split cam (PR #5) — two live sources side by side at the operator's ratio.
 * The divider is rendered but NOT draggable here: this surface is output-only,
 * the operator drags in the control room and the ratio arrives over the bridge.
 */
function SplitComposite({
  primary,
  secondary,
  ratio,
}: {
  primary: MediaStream;
  secondary: MediaStream;
  ratio: number;
}) {
  const clamped = clampSplitRatio(ratio);
  return (
    <div className="flex h-full w-full">
      <div className="relative h-full overflow-hidden" style={{ width: `${clamped * 100}%` }}>
        <StreamLayer stream={primary} />
      </div>
      <div aria-hidden className="h-full w-[2px] shrink-0 bg-white/25" />
      <div className="relative h-full flex-1 overflow-hidden">
        <StreamLayer stream={secondary} />
      </div>
    </div>
  );
}

/**
 * Shown when a source is cut up but carries no video (a wall source, or a camera
 * that hasn't connected). Intentionally minimal — this frame can go to air.
 */
function NoSignalCard({ label }: { label: string }) {
  return (
    <div className="px-8 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
    </div>
  );
}

/**
 * ⭐ WAVE 5 — a source arrived that this event is not entitled to broadcast.
 *
 * Reached when the frame's source is not on the server's permitted list: an
 * un-entitled event whose console sent a camera other than its pinned free channel.
 * In normal operation nobody sees this — the unified controller only ever publishes a
 * permitted slot — so it is the TAMPER / STALE-ENTITLEMENT state, and it is written
 * to be read by the person who caused it.
 *
 * It says the true thing plainly instead of going black. A black frame going out live
 * is indistinguishable from a crash, and a couple staring at one on their wedding day
 * has no way to tell which they are looking at.
 *
 * It also names the one INNOCENT way to land here: this window resolves its permitted
 * channel once, when it opens. A host who changes their ★ default afterwards leaves it
 * pointing at the old one — which fails closed (no picture) rather than open, and is
 * fixed by reopening the window.
 */
function WithheldCard() {
  return (
    <div className="max-w-lg px-8 text-center text-white">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
        Live Studio
      </p>
      <h1 className="mt-3 text-xl font-semibold">Unlock to broadcast all your cameras</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/65">
        Your free broadcast carries one camera — the channel marked ★ default in the controller.
        Switching between cameras on air is what the Live Studio unlock buys.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/45">
        Just changed your default channel? Close this window and open it again from the
        controller.
      </p>
    </div>
  );
}

/**
 * ⭐ WAVE 5 — the free tier's pinned channel, named on the picture.
 *
 * The host cut to another camera; that cut is real rehearsal and their monitor follows
 * it, but the encoder keeps seeing the one channel they may broadcast. Saying so HERE
 * — small, and on the captured frame — is the honest alternative to letting the two
 * screens disagree in silence.
 *
 * Only ever drawn for an un-entitled event, and only while the two genuinely differ.
 *
 * Lifted clear of the lower third when one is drawn — and on the free tier one always
 * is ("POWERED BY SETNAYAN"), so without the lift this would land on top of it.
 */
function PinnedChannelNotice({
  label,
  liftedForLowerThird,
}: {
  label: string;
  liftedForLowerThird: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute left-0 z-30 max-w-[70%] px-6 ${
        liftedForLowerThird ? 'bottom-28' : 'bottom-0 pb-5'
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">
        On air: {label} · switching cameras needs the Live Studio unlock
      </p>
    </div>
  );
}

/**
 * The OBS ordering trap: OBS streams whatever this window shows. A couple who starts streaming
 * BEFORE pressing Go live would push an overlaid feed to their own YouTube. Say so here, on the
 * captured surface itself, where it is impossible to miss — and where it also lands in any test
 * recording they make, which is the cheapest possible lesson.
 */
function ObsOrderingNotice() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-6 pb-5 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-cream/55">
        Press Go live in the control room to clear this overlay before you start streaming
      </p>
    </div>
  );
}

const FAILURE_COPY: Record<BridgeFailure, { title: string; body: string }> = {
  'no-opener': {
    title: 'Open this from the control room',
    body: 'This window shows your program output for OBS. It has to be opened with the “Pop out for OBS” button in the control room — it can’t run on its own.',
  },
  'opener-closed': {
    title: 'Control room closed',
    body: 'The control room tab was closed, so there is no program to show. Reopen the control room and pop this window out again.',
  },
  'no-bridge': {
    title: 'Waiting for the control room',
    body: 'This window was opened from a page that isn’t running a control room. Open it with the “Pop out for OBS” button.',
  },
};

function BridgeFailureCard({ failure }: { failure: BridgeFailure }) {
  const copy = FAILURE_COPY[failure];
  return (
    <div className="max-w-md px-8 text-center text-white">
      <h1 className="text-lg font-semibold">{copy.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/60">{copy.body}</p>
    </div>
  );
}
