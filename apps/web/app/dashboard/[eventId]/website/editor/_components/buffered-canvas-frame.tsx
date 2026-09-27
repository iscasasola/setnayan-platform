'use client';

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { findMakerSection } from '@/app/[slug]/_components/editor-bridge';
import { makerSavesInFlight } from '@/lib/maker-refresh';

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
 * 🔥 …AND A STAGE THAT IS ALREADY WARM SWAPS IN AT ONCE, LOADED (owner
 * 2026-09-28: *"is it possible to load everything so it runs smoothly?"*).
 * After the page is up and the tab is idle, the other stages are loaded here,
 * hidden (`warm`, one at a time, never while a save is in flight). Switching
 * stage then SHOWS a frame that finished loading long ago — the same iframe,
 * moved from warm to shown, nothing reloaded — and the page the couple left
 * stays warm behind it, so switching back is instant too. A warm frame older
 * than the canvas is shown at once AND the fresh one loads behind it (the
 * double buffer), so the couple never waits and never keeps a stale page.
 * Every pick the bridge draws reaches the warm frames as well (`broadcastRef`);
 * one that was still loading and could not take it is dropped, and loaded
 * again after the save lands. Capped (`warmCanvasBudget`): at most the shown
 * stage + 3 warm frames, and none on a small-memory phone or save-data.
 *
 * At most TWO frames exist for the stage shown: the one shown, and the newest
 * one loading. A second render while one is loading REPLACES the loading one
 * (`planCanvasFrames`), so quick saves never stack frames
 * (`the-maker-controls-are-compact.test.ts`).
 */

export type CanvasFrame = { key: string; group: string; src: string };
export type CanvasFrames = {
  shown: CanvasFrame;
  loading: CanvasFrame | null;
  /** Other stages, loaded hidden behind the canvas. Absent = none. */
  warm?: CanvasFrame[];
};

const same = (a: CanvasFrame, b: CanvasFrame) => a.key === b.key && a.src === b.src;
const withWarm = (s: { shown: CanvasFrame; loading: CanvasFrame | null }, warm: CanvasFrame[]): CanvasFrames =>
  warm.length > 0 ? { ...s, warm } : s;

/** What to mount for the render that just arrived. Pure — `buffered-canvas-frame.test.ts`. */
export function planCanvasFrames(state: CanvasFrames, next: CanvasFrame): CanvasFrames {
  const warm = state.warm ?? [];
  if (same(next, state.shown)) return withWarm({ shown: state.shown, loading: null }, warm);
  if (next.group !== state.shown.group) {
    /* 🔥 A stage already warm is shown AT ONCE — the same frame, loaded. If it is
       older than this render, the fresh one loads behind it (buffered). The page
       the couple leaves stays warm; `nextWarmFrame` trims what is not wanted. */
    const hit = warm.find((f) => f.group === next.group && f.src === next.src) ?? null;
    const kept = [...warm.filter((f) => f !== hit), state.shown];
    if (hit) return withWarm({ shown: hit, loading: same(hit, next) ? null : next }, kept);
    return withWarm({ shown: next, loading: null }, kept);
  }
  if (state.loading && same(state.loading, next)) return state;
  return withWarm({ shown: state.shown, loading: next }, warm);
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
  return { ...state, shown: state.loading, loading: null };
}

/**
 * 🔥 ONE STEP TOWARD THE WARM SET the Maker asked for (`wanted`, in priority
 * order): drop every warm frame no longer wanted (a stage now shown, a "view
 * as" page, anything past `max`), then add or refresh AT MOST ONE — so warming
 * never loads three pages at once on a phone. A warm frame whose render is
 * older than the one wanted is replaced (a fresh load, hidden). Pure.
 */
export function nextWarmFrame(state: CanvasFrames, wanted: readonly CanvasFrame[], max: number): CanvasFrames {
  const want = wantedWarm(state, wanted, max);
  let warm = keptWarm(state, want);
  for (const d of want) {
    const have = warm.find((f) => f.group === d.group && f.src === d.src);
    if (have && have.key === d.key) continue;
    warm = [...warm.filter((f) => f !== have), d];
    break;
  }
  const before = state.warm ?? [];
  if (warm.length === before.length && warm.every((f, i) => before[i] === f)) return state;
  return withWarm({ shown: state.shown, loading: state.loading }, warm);
}

/**
 * Only the TRIM of `nextWarmFrame` — nothing added. Applied at once on every
 * render (a stage left behind past the budget, or on a device with none, never
 * waits for an idle moment to be let go). Pure.
 */
export function trimWarmFrames(state: CanvasFrames, wanted: readonly CanvasFrame[], max: number): CanvasFrames {
  const warm = keptWarm(state, wantedWarm(state, wanted, max));
  const before = state.warm ?? [];
  if (warm.length === before.length) return state;
  return withWarm({ shown: state.shown, loading: state.loading }, warm);
}

/** The warm frames wanted beside what is shown and loading, within the budget. */
function wantedWarm(state: CanvasFrames, wanted: readonly CanvasFrame[], max: number): CanvasFrame[] {
  const busy = new Set([state.shown.group, state.loading?.group].filter(Boolean));
  return wanted.filter((d) => !busy.has(d.group)).slice(0, Math.max(0, max));
}
/** The warm frames that fill one of those slots (a stale one included — `nextWarmFrame` refreshes it). */
function keptWarm(state: CanvasFrames, want: readonly CanvasFrame[]): CanvasFrame[] {
  return (state.warm ?? []).filter((f) => want.some((d) => d.group === f.group && d.src === f.src));
}

/** Warm frames that could not take a pick the bridge drew: dropped, to load again later. */
export function dropWarmFrames(state: CanvasFrames, ids: ReadonlySet<string>): CanvasFrames {
  if (!state.warm || ids.size === 0) return state;
  const warm = state.warm.filter((f) => !ids.has(canvasFrameId(f)));
  return warm.length === state.warm.length ? state : withWarm({ shown: state.shown, loading: state.loading }, warm);
}

/**
 * How many stages may be held warm on this device (brief 2026-09-28: at most
 * the current stage plus 3 warm frames; none on a phone whose
 * `navigator.deviceMemory` is ≤ 4, or on a save-data connection). Pure.
 */
export function warmCanvasBudget(device: { phone: boolean; deviceMemory?: number | null; saveData?: boolean | null }): number {
  if (device.saveData) return 0;
  if (device.phone && typeof device.deviceMemory === 'number' && device.deviceMemory <= 4) return 0;
  return MAX_WARM_FRAMES;
}
export const MAX_WARM_FRAMES = 3;

/** A frame with no bridge never says `ready`; it is shown this long after `load`. */
const NO_BRIDGE_MS = 1_200;
/** However it goes, a loading frame is shown after this long — never stuck behind. */
const GIVE_UP_MS = 15_000;
/** Warming waits for an idle moment, at least this long after the last change. */
const WARM_AFTER_MS = 900;

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
  backgroundRef,
  broadcastRef,
  warm = [],
  warmMax = 0,
  warmGen = '',
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
  /** Every frame NOT shown (loading and warm) — the Maker's `ready` listener ignores them all. */
  backgroundRef?: MutableRefObject<Set<Window>>;
  /** Filled here: post a message the bridge draws to the shown frame AND every warm one. */
  broadcastRef?: MutableRefObject<((message: unknown) => void) | null>;
  /** 🔥 The other stages to hold warm, in priority order (same key format as `frameKey`). */
  warm?: readonly CanvasFrame[];
  /** How many may be warm on this device (`warmCanvasBudget`). */
  warmMax?: number;
  /** Changes with every server render — a moment the saves have landed, to warm again. */
  warmGen?: string;
  /** The scene the couple has selected — kept in place across a swap. */
  anchorKey: () => string | null;
  /** The key of the frame now shown (the canvas guard re-attaches to it). */
  onShown: (key: string) => void;
  /** A buffered swap happened; `ready` is the new frame's own `ready` message. */
  onSwapped: (ready: unknown) => void;
}) {
  const next: CanvasFrame = { key: frameKey, group, src };
  const [frames, setFrames] = useState<CanvasFrames>({ shown: next, loading: null });
  /** The warm set the Maker wants right now (read by the switch and by warming). */
  const wantedRef = useRef(warm);
  wantedRef.current = warm;
  const els = useRef<Record<string, HTMLIFrameElement | null>>({});
  /** Frame ids in the order they were first mounted — see the render below. */
  const mountOrder = useRef<string[]>([]);
  /** When each frame was first mounted — a warm frame that never says `ready` stops blocking after GIVE_UP_MS. */
  const bornAt = useRef<Record<string, number>>({});
  /** Every frame's own `ready` message, by id — a frame is "ready" once it is here. */
  const readyOf = useRef<Record<string, unknown>>({});

  useEffect(() => {
    setFrames((s) => trimWarmFrames(planCanvasFrames(s, { key: frameKey, group, src }), wantedRef.current, warmMax));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the wanted list is read at the switch
  }, [frameKey, group, src, warmMax]);

  /* The Maker talks to the frame SHOWN; its `ready` listener skips the others. */
  useLayoutEffect(() => {
    frameRef.current = els.current[canvasFrameId(frames.shown)] ?? null;
    loadingRef.current = frames.loading ? (els.current[canvasFrameId(frames.loading)]?.contentWindow ?? null) : null;
    if (backgroundRef) {
      const set = new Set<Window>();
      for (const f of [frames.loading, ...(frames.warm ?? [])]) {
        const w = f ? els.current[canvasFrameId(f)]?.contentWindow : null;
        if (w) set.add(w);
      }
      backgroundRef.current = set;
    }
    onShown(canvasFrameId(frames.shown));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onShown is a setter-like callback
  }, [frames, frameRef, loadingRef, backgroundRef]);

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

  /* Every frame's `ready` is recorded (a warm frame becomes "ready" here). */
  const [warmTick, setWarmTick] = useState(0);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string } | null;
      if (!data || data.source !== 'setnayan-site' || data.t !== 'ready') return;
      for (const [id, el] of Object.entries(els.current)) {
        if (el && event.source === el.contentWindow) {
          readyOf.current[id] = data;
          // A frame is up (the canvas itself, or a warm stage) — a moment to warm the next.
          setWarmTick((n) => n + 1);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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

  /* After a swap — buffered, or a warm stage shown — the Maker re-marks the
     element and re-reads the bar from the new frame's own `ready`. A frame
     shown fresh (never ready yet) says `ready` itself, to the Maker. */
  const shownId = canvasFrameId(frames.shown);
  const lastShown = useRef(shownId);
  useEffect(() => {
    if (lastShown.current === shownId) return;
    lastShown.current = shownId;
    const buffered = swapped.current === shownId;
    swapped.current = null;
    if (!buffered && !(shownId in readyOf.current)) return;
    onSwapped(readyOf.current[shownId] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per swap
  }, [shownId]);

  /* 🔥 WARMING — after the page is up, when idle, one frame at a time, never
     while a save is in flight (a frame loaded then could miss the save), and
     never while the canvas itself is still loading. */
  const wantedKey = warm.map(canvasFrameId).join('|');
  useEffect(() => {
    let cancelled = false;
    let idle: number | null = null;
    let retry: number | null = null;
    const step = () => {
      if (cancelled) return;
      const s = framesRef.current;
      if (warmMax > 0) {
        const now = Date.now();
        const settled = (f: CanvasFrame) =>
          canvasFrameId(f) in readyOf.current || now - (bornAt.current[canvasFrameId(f)] ?? now) >= GIVE_UP_MS;
        const warming = (s.warm ?? []).some((f) => !settled(f));
        if (!settled(s.shown) || s.loading || warming || makerSavesInFlight() > 0) {
          // Look again later — a frame that never says `ready` must not stall warming.
          retry = window.setTimeout(() => setWarmTick((n) => n + 1), GIVE_UP_MS);
          return;
        }
      }
      setFrames((prev) => nextWarmFrame(prev, wantedRef.current, warmMax));
    };
    const timer = window.setTimeout(() => {
      const ric = (window as unknown as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
      if (ric) idle = ric(step, { timeout: 4_000 });
      else step();
    }, WARM_AFTER_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retry !== null) window.clearTimeout(retry);
      const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle !== null && cancel) cancel(idle);
    };
  }, [wantedKey, warmMax, warmGen, warmTick, shownId, loadingKey]);

  /* The pick the bridge draws, to every frame that keeps matching the draft. */
  useEffect(() => {
    if (!broadcastRef) return;
    broadcastRef.current = (message: unknown) => {
      const s = framesRef.current;
      const stale = new Set<string>();
      const post = (f: CanvasFrame | null, background: boolean) => {
        if (!f) return;
        const id = canvasFrameId(f);
        const w = els.current[id]?.contentWindow;
        if (background && !(id in readyOf.current)) {
          stale.add(id);
          return;
        }
        w?.postMessage(message, window.location.origin);
      };
      post(s.shown, false);
      post(s.loading, false);
      for (const f of s.warm ?? []) post(f, true);
      if (stale.size > 0) setFrames((prev) => dropWarmFrames(prev, stale));
    };
    return () => {
      broadcastRef.current = null;
    };
  }, [broadcastRef]);

  /* A frame gone from every list is forgotten. */
  useEffect(() => {
    const live = new Set([frames.shown, frames.loading, ...(frames.warm ?? [])].filter(Boolean).map((f) => canvasFrameId(f!)));
    for (const id of Object.keys(readyOf.current)) if (!live.has(id)) delete readyOf.current[id];
    for (const id of Object.keys(bornAt.current)) if (!live.has(id)) delete bornAt.current[id];
  }, [frames]);

  /* ⚠ THE DOM ORDER NEVER CHANGES FOR A FRAME ALREADY MOUNTED. Moving an
     <iframe> in the document (React re-orders keyed children with
     insertBefore) RELOADS it — a warm stage promoted to the front would load
     again, the one thing warming exists to avoid. So frames keep the order
     they were first mounted in; which one is shown is a class, never a place.
     The loading and warm frames are see-through and untappable, so being above
     the shown one in the stack changes nothing. */
  const current = [frames.shown, ...(frames.loading ? [frames.loading] : []), ...(frames.warm ?? [])];
  const byId = new Map(current.map((f) => [canvasFrameId(f), f]));
  const order = mountOrder.current.filter((id) => byId.has(id));
  for (const id of byId.keys()) if (!order.includes(id)) order.push(id);
  mountOrder.current = order;
  const list = order.map((id) => byId.get(id)!);
  return (
    <div className={`relative ${className}`} data-maker-canvas-frames={frames.loading ? 'loading' : 'shown'}>
      {list.map((f) => {
        const role = f === frames.shown ? 'shown' : f === frames.loading ? 'loading' : 'warm';
        const loading = role === 'loading';
        return (
          <iframe
            key={canvasFrameId(f)}
            ref={(el) => {
              const id = canvasFrameId(f);
              els.current[id] = el;
              if (el && !(id in bornAt.current)) bornAt.current[id] = Date.now();
            }}
            src={f.src}
            title={role === 'shown' ? title : `${title} (loading behind)`}
            aria-hidden={role !== 'shown' || undefined}
            tabIndex={role !== 'shown' ? -1 : undefined}
            data-maker-canvas-frame={role}
            onLoad={
              loading
                ? () =>
                    window.setTimeout(() => {
                      if (!(canvasFrameId(f) in readyOf.current)) promote(canvasFrameId(f));
                    }, NO_BRIDGE_MS)
                : undefined
            }
            className={`absolute inset-0 h-full w-full rounded-[inherit] bg-white ${
              loading ? 'pointer-events-none opacity-0' : role === 'warm' ? 'pointer-events-none invisible' : ''
            }`}
          />
        );
      })}
    </div>
  );
}
