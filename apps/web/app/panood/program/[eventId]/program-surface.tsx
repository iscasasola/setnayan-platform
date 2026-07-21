'use client';

import { useEffect, useRef, useState } from 'react';
import { SetnayanOverlay } from '@/app/dashboard/[eventId]/studio/panood/broadcast/_components/setnayan-overlay';
import {
  clampSplitRatio,
  EMPTY_FRAME,
  resolveProgramBridge,
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
export function PanoodProgramSurface() {
  const [frame, setFrame] = useState<ProgramFrame>(EMPTY_FRAME);
  const [failure, setFailure] = useState<BridgeFailure | null>(null);

  useEffect(() => {
    const bridge = resolveProgramBridge();
    if (typeof bridge === 'string') {
      setFailure(bridge);
      return;
    }
    setFailure(null);
    setFrame(bridge.get());
    const unsubscribe = bridge.subscribe(setFrame);

    // The parent can go away without notice (operator closes the console tab).
    // Poll cheaply so the surface can say so instead of freezing on a stale
    // frame that OBS would keep broadcasting.
    const openerWatch = setInterval(() => {
      const opener = window.opener as Window | null;
      if (!opener || opener.closed) {
        setFailure('opener-closed');
        clearInterval(openerWatch);
      }
    }, 2_000);

    return () => {
      unsubscribe();
      clearInterval(openerWatch);
    };
  }, []);

  useEffect(() => {
    document.title = 'Setnayan Program output';
  }, []);

  return (
    // A real full-viewport route now, not a layer fighting the dashboard shell for cover.
    // `h-[100dvh]` (not `fixed`) because this page owns the whole window — and because a
    // view-transition-named ancestor once turned `fixed` into a zero-height containing block
    // and silently rendered nothing at all.
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-black">
      {failure ? (
        <BridgeFailureCard failure={failure} />
      ) : (
        <>
          {frame.secondaryStream && frame.stream ? (
            <SplitComposite
              primary={frame.stream}
              secondary={frame.secondaryStream}
              ratio={frame.splitRatio}
            />
          ) : frame.stream ? (
            <StreamLayer stream={frame.stream} />
          ) : (
            <NoSignalCard label={frame.label} />
          )}
          {/* The paywall. Server-decided upstream and carried over the bridge — this surface
              never re-derives it. Covers every branch above, so OBS cannot capture a clean
              frame from any state while the overlay is on. */}
          {frame.overlay && <SetnayanOverlay size="full" reason={frame.overlayReason} />}
          {frame.overlay && <ObsOrderingNotice />}
        </>
      )}
    </div>
  );
}

/** One full-bleed video. `object-contain` — never crop the couple's frame. */
function StreamLayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      playsInline
      autoPlay
      muted
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
