'use client';

import { useEffect, useRef } from 'react';
import { RSVP_BRIDGE_SOURCE } from '@/lib/rsvp-stage-shared';
import { RSVP_CELEBRATE_MESSAGE, isRsvpCelebration, withoutJustReplied, type RsvpCelebration } from '@/lib/rsvp-celebration';
import type { CelebrationPlayer, CelebrationRect } from '@/lib/celebration-engine';

/**
 * 🎉 THE WHEN YES CELEBRATION, ON THE GUEST'S THANK-YOU (owner 2026-10-06,
 * DECISION_LOG '"WHEN YES" GETS A CELEBRATION (PRO)'; prototype
 * `when_yes_celebration_2026-10-06_fable.html`).
 *
 *   · A guest who JUST said yes (`/{slug}/invite/enter?rsvp=ok`, the reply's
 *     own return) sees the couple's pick play ONCE (~2–3 s) as the thank-you
 *     appears, then clear itself. The `?rsvp=ok` is taken off the address the
 *     moment it starts, so a reload of the same thank-you never plays it again —
 *     only a fresh reply does (we never nag).
 *   · One full-screen canvas over the page (on a desktop the effect spans the
 *     whole screen), never a tap target (`pointer-events: none`), hidden from
 *     screen readers. Sparklers shimmer around the guest's NAME only.
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

  useEffect(() => {
    let alive = true;
    const start = async (pick: RsvpCelebration) => {
      const canvas = canvasRef.current;
      if (!canvas || pick === 'none') {
        player.current?.stop();
        return;
      }
      const { CelebrationPlayer } = await import(/* webpackChunkName: "celebration-engine" */ '@/lib/celebration-engine');
      if (!alive || !canvasRef.current) return;
      player.current ??= new CelebrationPlayer(canvasRef.current);
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      void player.current.play(pick, { colours, reduced, rect: nameRect(name ?? null), freezeAt });
    };

    if (play && kind !== 'none') {
      forgetJustReplied();
      void start(kind);
    }

    if (!listen) {
      return () => {
        alive = false;
        player.current?.stop();
      };
    }
    const origin = window.location.origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
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
  }, [kind, play, listen, name, freezeAt]);

  if (!listen && (kind === 'none' || !play)) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-when-yes-fx={kind}
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
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
