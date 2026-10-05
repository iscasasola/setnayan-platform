'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RSVP_BRIDGE_SOURCE } from '@/lib/rsvp-stage-shared';
import {
  RSVP_CELEBRATE_MESSAGE,
  celebrationCanvasShown,
  isRsvpCelebration,
  withoutJustReplied,
  type RsvpCelebration,
} from '@/lib/rsvp-celebration';
import type { CelebrationPlayer, CelebrationRect } from '@/lib/celebration-engine';

/**
 * 🎉 THE WHEN YES CELEBRATION, ON THE GUEST'S THANK-YOU (owner 2026-10-06,
 * DECISION_LOG '"WHEN YES" GETS A CELEBRATION (PRO)'; prototype
 * `when_yes_celebration_2026-10-06_fable.html`).
 *
 *   · A guest who JUST said yes (`/{slug}/invite/enter?rsvp=ok`, the reply's
 *     own return) sees the couple's pick play ONCE (~2–3 s) as the thank-you
 *     appears, then clear itself. The `?rsvp=ok` is taken off the address once
 *     it has ENDED, so a reload of the same thank-you never plays it again —
 *     only a fresh reply does (we never nag). Not before: the guest-reply
 *     funnel's "ticket" step (`lib/telemetry/flows.ts`) reads that flag from
 *     the address a moment after the page lands.
 *   · One full-screen canvas over the page (on a desktop the effect spans the
 *     whole screen), never a tap target (`pointer-events: none`), hidden from
 *     screen readers, portalled to `<body>` so no ancestor's transform or
 *     stacking can box it in. Sparklers shimmer around the guest's NAME only.
 *   · `prefers-reduced-motion` → one calm wash instead. A watchdog ends it even
 *     if frames stop (`CelebrationPlayer`).
 *   · None draws nothing: no canvas is mounted and no engine code is fetched.
 *   · The engine is fetched by `import()` only when there is something to play,
 *     so the guest page's own bundle carries this little file and nothing more.
 *
 * On the Maker's RSVP stage (`listen`, the host-verified sample canvas) it plays
 * when the Maker says so — a pick in Celebration ▾, "Play it again", or opening
 * the When yes scene (`{ t: 'celebrate', kind }`, `maker-rsvp-stage.tsx`).
 */
export function WhenYesCelebration({
  kind,
  colours,
  play,
  name,
  listen = false,
  freezeAt,
}: {
  /** The couple's pick (`readRsvpCelebration`) — live for a guest, the draft on the Maker's canvas. */
  kind: RsvpCelebration;
  /** The Mood Board's colours (`celebrationColours`). */
  colours: readonly string[];
  /** The guest just replied yes — play once now. */
  play: boolean;
  /** The guest's first name, as the thank-you's heading may carry it (the sparklers' target). */
  name?: string | null;
  /** The Maker's sample canvas: play on the Maker's word, never on load. */
  listen?: boolean;
  /** 📸 Dev labs only — one still frame at this second (`CelebrationOptions.freezeAt`). */
  freezeAt?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const player = useRef<CelebrationPlayer | null>(null);
  /* The canvas is portalled to <body>, so it exists only after mount (no SSR flash). */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const shown = celebrationCanvasShown({ kind, play, listen });

  useEffect(() => {
    if (!mounted || !shown) return;
    let alive = true;
    const loadEngine = () =>
      import(/* webpackChunkName: "celebration-engine" */ '@/lib/celebration-engine').catch(() => null);
    const start = async (pick: RsvpCelebration) => {
      if (!canvasRef.current || pick === 'none') {
        player.current?.stop();
        return null;
      }
      const engine = await loadEngine();
      if (!engine || !alive || !canvasRef.current) return null;
      player.current ??= new engine.CelebrationPlayer(canvasRef.current);
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return player.current.play(pick, { colours, reduced, rect: nameRect(name ?? null), freezeAt });
    };

    if (play && kind !== 'none') {
      /* Once it has ENDED (or could not start), the flag leaves the address. */
      void start(kind).finally(() => {
        if (alive) forgetJustReplied();
      });
    }

    if (!listen) {
      return () => {
        alive = false;
        player.current?.stop();
      };
    }
    /* On the Maker's canvas the engine is fetched as the page opens, so the
       couple's first pick plays at the tap, not after a download. */
    void loadEngine();
    const origin = window.location.origin;
    const onMessage = (e: MessageEvent) => {
      // Only the Maker that framed this page may ask.
      if (e.origin !== origin || e.source !== window.parent) return;
      const d = e.data as { source?: unknown; t?: unknown; kind?: unknown } | null;
      if (!d || d.source !== RSVP_BRIDGE_SOURCE || d.t !== RSVP_CELEBRATE_MESSAGE || !isRsvpCelebration(d.kind)) return;
      void start(d.kind);
    };
    window.addEventListener('message', onMessage);
    return () => {
      alive = false;
      window.removeEventListener('message', onMessage);
      player.current?.stop();
    };
    // `colours` is a server-drawn list; its identity is stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, shown, kind, play, listen, name, freezeAt]);

  if (!shown || !mounted) return null;
  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-when-yes-fx={kind}
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />,
    document.body,
  );
}

/** Take `?rsvp=ok` off the address, so a reload of this thank-you never plays it again. */
function forgetJustReplied(): void {
  const next = withoutJustReplied(window.location.href);
  if (next === null) return;
  try {
    window.history.replaceState(window.history.state, '', next);
  } catch {
    /* an address we cannot rewrite still plays once */
  }
}

/**
 * Where the guest's NAME is drawn on the thank-you (the sparklers' target, in
 * viewport pixels — the canvas is fixed over the whole viewport): the name
 * inside the heading when the couple's words carry it, else the heading itself.
 */
function nameRect(name: string | null): CelebrationRect | null {
  const heading = document.querySelector<HTMLElement>('[data-landing-heading]');
  if (!heading) return null;
  const who = (name ?? '').trim();
  if (who) {
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = (node.textContent ?? '').indexOf(who);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + who.length);
      const r = range.getBoundingClientRect();
      if (r.width > 0) return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
  }
  const r = heading.getBoundingClientRect();
  return r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
}
