'use client';

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { findMakerSection } from '@/app/[slug]/_components/editor-bridge';

/**
 * 🪞 THE CANVAS, DOUBLE-BUFFERED — a new render loads BEHIND the page the
 * couple is looking at, and takes its place only once it is ready.
 *
 * Owner, 2026-09-27: *"everytime we edit something, the loading takes time and
 * loads the whole screen"*. Every Maker write refreshes the server render, and
 * the canvas iframe is keyed on that render, so each write REMOUNTED the frame:
 * the page went blank and loaded from the top (~3 s) while the couple waited.
 *
 * Now the frame for a new render mounts hidden, over the current one, and the
 * current one stays visible and tappable. The swap happens when the new frame's
 * bridge says `ready` (or, for a frame with no bridge, shortly after `load`),
 * with the scroll carried across: the selected scene is put back at the same
 * height on screen, so a reorder that moved it keeps it where the eye is. No
 * white flash, no page loading from the top.
 *
 * ⛔ A NEW STAGE OR A NEW "VIEW AS" IS NOT BUFFERED (`group`): the couple asked
 * for a different page, and showing the old one while it loads would read as
 * the tap being ignored. Those swap at once, as before.
 *
 * At most TWO frames exist: the one shown, and the newest one loading. A second
 * render while one is loading REPLACES the loading one (`planCanvasFrames`), so
 * quick saves never stack frames (`the-maker-controls-are-compact.test.ts`).
 */

export type CanvasFrame = { key: string; group: string; src: string };
export type CanvasFrames = { shown: CanvasFrame; loading: CanvasFrame | null };

/** What to mount for the render that just arrived. Pure — `buffered-canvas-frame.test.ts`. */
export function planCanvasFrames(state: CanvasFrames, next: CanvasFrame): CanvasFrames {
  if (next.key === state.shown.key && next.src === state.shown.src) return { shown: state.shown, loading: null };
  if (next.group !== state.shown.group) return { shown: next, loading: null };
  if (state.loading && state.loading.key === next.key && state.loading.src === next.src) return state;
  return { shown: state.shown, loading: next };
}

/**
 * A frame's identity — its render AND its address. The Event Bar switch keeps
 * the render and changes the address (`&bars=1`), and that must load a new
 * frame too, never collide with the one shown.
 */
export const canvasFrameId = (f: CanvasFrame) => `${f.key}\n${f.src}`;

/** The loading frame is ready: it becomes the one shown. */
export function promoteCanvasFrame(state: CanvasFrames, id: string): CanvasFrames {
  if (!state.loading || canvasFrameId(state.loading) !== id) return state;
  return { shown: state.loading, loading: null };
}

/** A frame with no bridge never says `ready`; it is shown this long after `load`. */
const NO_BRIDGE_MS = 1_200;
/** However it goes, a loading frame is shown after this long — never stuck behind. */
const GIVE_UP_MS = 15_000;

/**
 * Put the new page where the old one was: the selected scene at the same height
 * on screen when both pages draw it, else the same scroll offset.
 */
function carryScroll(from: HTMLIFrameElement | null, to: HTMLIFrameElement, anchor: string | null) {
  try {
    const a = from?.contentWindow;
    const b = to.contentWindow;
    if (!a || !b) return;
    const oldSec = anchor ? findMakerSection(a.document, anchor) : null;
    const newSec = anchor ? findMakerSection(b.document, anchor) : null;
    if (oldSec && newSec) {
      const y = b.scrollY + newSec.getBoundingClientRect().top - oldSec.getBoundingClientRect().top;
      b.scrollTo({ top: Math.max(0, y), behavior: 'instant' as ScrollBehavior });
    } else {
      b.scrollTo({ top: a.scrollY, behavior: 'instant' as ScrollBehavior });
    }
  } catch {
    /* a frame we cannot reach keeps its own scroll */
  }
}

export function BufferedCanvasFrame({
  frameKey,
  group,
  src,
  title,
  className,
  frameRef,
  loadingRef,
  anchorKey,
  onShown,
  onSwapped,
}: {
  /** Changes with every render that must reach the canvas. */
  frameKey: string;
  /** Stage + "view as": a change here swaps at once instead of buffering. */
  group: string;
  src: string;
  title: string;
  /** The box the frames fill (size, rounding, shadow). */
  className: string;
  /** Always the frame SHOWN — every message the Maker posts goes to it. */
  frameRef: MutableRefObject<HTMLIFrameElement | null>;
  /** The loading frame's window, so the Maker's own `ready` listener ignores it. */
  loadingRef: MutableRefObject<Window | null>;
  /** The scene the couple has selected — kept in place across a swap. */
  anchorKey: () => string | null;
  /** The key of the frame now shown (the canvas guard re-attaches to it). */
  onShown: (key: string) => void;
  /** A buffered swap happened; `ready` is the new frame's own `ready` message. */
  onSwapped: (ready: unknown) => void;
}) {
  const next: CanvasFrame = { key: frameKey, group, src };
  const [frames, setFrames] = useState<CanvasFrames>({ shown: next, loading: null });
  const els = useRef<Record<string, HTMLIFrameElement | null>>({});
  const readyOf = useRef<Record<string, unknown>>({});

  useEffect(() => {
    setFrames((s) => planCanvasFrames(s, { key: frameKey, group, src }));
  }, [frameKey, group, src]);

  /* The Maker talks to the frame SHOWN; its `ready` listener skips the loading one. */
  useLayoutEffect(() => {
    frameRef.current = els.current[canvasFrameId(frames.shown)] ?? null;
    loadingRef.current = frames.loading ? (els.current[canvasFrameId(frames.loading)]?.contentWindow ?? null) : null;
    onShown(canvasFrameId(frames.shown));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onShown is a setter-like callback
  }, [frames, frameRef, loadingRef]);

  const framesRef = useRef(frames);
  framesRef.current = frames;
  /** The key a buffered swap just showed — the swap effect below reports it. */
  const swapped = useRef<string | null>(null);
  const promote = (key: string) => {
    const s = framesRef.current;
    const loading = els.current[key];
    if (!loading || !s.loading || canvasFrameId(s.loading) !== key) return;
    carryScroll(els.current[canvasFrameId(s.shown)] ?? null, loading, anchorKey());
    swapped.current = key;
    setFrames((prev) => promoteCanvasFrame(prev, key));
  };

  /* The loading frame's bridge says `ready` → swap. A task later, so the
     Maker's own `ready` listener (same event) still sees it as loading. */
  const loadingKey = frames.loading ? canvasFrameId(frames.loading) : null;
  useEffect(() => {
    if (!loadingKey) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string } | null;
      if (!data || data.source !== 'setnayan-site' || data.t !== 'ready') return;
      if (event.source !== els.current[loadingKey]?.contentWindow) return;
      readyOf.current[loadingKey] = data;
      window.setTimeout(() => promote(loadingKey), 0);
    };
    window.addEventListener('message', onMessage);
    const giveUp = window.setTimeout(() => promote(loadingKey), GIVE_UP_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(giveUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the loading frame only
  }, [loadingKey]);

  /* After a buffered swap, the Maker re-marks the element and re-reads the bar. */
  useEffect(() => {
    const key = canvasFrameId(frames.shown);
    if (swapped.current !== key) return;
    swapped.current = null;
    onSwapped(readyOf.current[key] ?? null);
    delete readyOf.current[key];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per swap
  }, [frames.shown]);

  const list = frames.loading ? [frames.shown, frames.loading] : [frames.shown];
  return (
    <div className={`relative ${className}`} data-maker-canvas-frames={frames.loading ? 'loading' : 'shown'}>
      {list.map((f) => {
        const loading = f === frames.loading;
        return (
          <iframe
            key={canvasFrameId(f)}
            ref={(el) => {
              els.current[canvasFrameId(f)] = el;
            }}
            src={f.src}
            title={title}
            aria-hidden={loading || undefined}
            tabIndex={loading ? -1 : undefined}
            data-maker-canvas-frame={loading ? 'loading' : 'shown'}
            onLoad={
              loading
                ? () =>
                    window.setTimeout(() => {
                      if (!(canvasFrameId(f) in readyOf.current)) promote(canvasFrameId(f));
                    }, NO_BRIDGE_MS)
                : undefined
            }
            className={`absolute inset-0 h-full w-full rounded-[inherit] bg-white ${
              loading ? 'pointer-events-none opacity-0' : ''
            }`}
          />
        );
      })}
    </div>
  );
}
