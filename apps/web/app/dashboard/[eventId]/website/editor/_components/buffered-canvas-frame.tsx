'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { findMakerSection, makerSectionInView } from '@/app/[slug]/_components/maker-section-find';
import { whenIdle } from '@/lib/maker-preload';
import { CANVAS_REFRESH_MESSAGE, makerSavesStarted } from '@/lib/maker-refresh';

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
 * 🔥 …AND A STAGE THE COUPLE HAS ALREADY OPENED SWAPS IN AT ONCE, LOADED (owner
 * 2026-09-28: *"is it possible to load everything so it runs smoothly?"*).
 * The page the couple leaves is kept, hidden (`warm`), so switching back SHOWS
 * a frame that finished loading long ago — the same iframe, moved from warm to
 * shown, nothing reloaded. A kept frame older than the canvas is shown at once
 * AND the fresh one loads behind it (the double buffer), so the couple never
 * waits and never keeps a stale page. Every pick the bridge draws reaches the
 * kept frames as well (`broadcastRef`); one that could not take it is dropped.
 * Capped (`warmCanvasBudget`): at most the shown stage + 3 kept frames, and
 * none on a small-memory phone or save-data.
 *
 * 🧯 A SAVE NEVER LOADS A STAGE NOBODY IS LOOKING AT (production incident,
 * 2026-10-08). Until then the other three stages were FETCHED here, hidden, as
 * soon as the Maker was idle — and fetched AGAIN after every save. Each is a
 * full server render of the guest page (63 database requests when measured,
 * 35 since), so one edit cost up to four of them for pages the couple had not
 * asked to see. That, times a few edits a minute, is what exhausted the
 * database's connection pool.
 *
 * 🔥 THE OTHER STAGES ARE WARMED ONCE PER OPEN, AND ONLY THEN (`warmOnce`;
 * owner 2026-10-08, on the first visit to another stage: *"For as long as it
 * doesnt take kore than 1 second"*). After the stage on screen has said
 * `ready`, on an idle moment, with the tab visible: one hidden frame at a
 * time, each stage at most once. The first save of the open ENDS it — nothing
 * is warmed after a save, during one, or again. And a save's redraw
 * (`CANVAS_REFRESH_MESSAGE`, a server render of the page) goes to the page on
 * screen only: a kept stage OWES it and pays when it is shown (`canvasPosts`).
 * So an open costs at most `warmMax` extra guest pages, once, and a save costs
 * none — ever. Holding a frame that is already loaded costs the server nothing.
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
       the couple leaves stays warm; `trimWarmFrames` lets go of what is not wanted. */
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
 * Let go of every kept frame that is no longer wanted (`wanted`, in priority
 * order): a stage now shown, a "view as" page, anything past `max`. Applied at
 * once on every render — a stage left behind past the budget, or on a device
 * with none, never waits to be let go. ⛔ It NEVER ADDS a frame: a stage is
 * loaded when it is shown, or by the one warm of the open (`warmOnce`). Pure.
 */
export function trimWarmFrames(state: CanvasFrames, wanted: readonly CanvasFrame[], max: number): CanvasFrames {
  const warm = keptWarm(state, wantedWarm(state, wanted, max));
  const before = state.warm ?? [];
  if (warm.length === before.length) return state;
  return withWarm({ shown: state.shown, loading: state.loading }, warm);
}

/**
 * 🔥 ONE STEP OF THE ONE WARM AN OPEN GETS. `left` is what this open still has
 * to warm: `null` until the one moment it is decided, `[]` once spent — and it
 * is never refilled, so nothing here can load a stage twice.
 *   · a save has started in this open (`saved`) → spent, for good;
 *   · no budget (save-data, a small phone), the tab hidden, a frame still
 *     loading or not yet `ready` (the stage on screen first) → wait;
 *   · else the next stage not already held is added, hidden — ONE.
 * Pure — `the-other-stages-are-warmed-once.test.ts` counts what it loads.
 */
export function warmOnce(
  state: CanvasFrames,
  left: readonly CanvasFrame[] | null,
  wanted: readonly CanvasFrame[],
  max: number,
  at: { ready: (f: CanvasFrame) => boolean; hidden: boolean; saved: boolean },
): { state: CanvasFrames; left: readonly CanvasFrame[] | null } {
  if (at.saved) return { state, left: [] };
  const held = [state.shown, ...(state.warm ?? [])];
  if (max <= 0 || at.hidden || state.loading || !held.every(at.ready)) return { state, left };
  const rest = [...(left ?? wantedWarm(state, wanted, max))];
  while (rest.length > 0) {
    const d = rest.shift()!;
    const now = wanted.find((w) => w.group === d.group && w.src === d.src);
    if (!now || held.some((f) => f.group === d.group)) continue;
    return { state: withWarm({ shown: state.shown, loading: null }, [...(state.warm ?? []), now]), left: rest };
  }
  return { state, left: rest };
}

/**
 * Who takes a message the Maker broadcasts, by frame id. What the bridge draws
 * by itself reaches every frame that is up. A REFRESH is a server render of the
 * guest page, so it goes to the page on screen (and the one loading for it)
 * only: a kept stage `owe`s it — paid the moment it is shown — and a kept frame
 * not yet up is `drop`ped (it could not take a pick either). Pure.
 */
export function canvasPosts(
  state: CanvasFrames,
  up: (id: string) => boolean,
  refresh: boolean,
): { post: string[]; owe: string[]; drop: string[] } {
  const out = { post: [state.shown, state.loading].filter((f): f is CanvasFrame => !!f).map(canvasFrameId), owe: [] as string[], drop: [] as string[] };
  for (const id of (state.warm ?? []).map(canvasFrameId)) (!up(id) ? out.drop : refresh ? out.owe : out.post).push(id);
  return out;
}

/** The warm frames wanted beside what is shown and loading, within the budget. */
function wantedWarm(state: CanvasFrames, wanted: readonly CanvasFrame[], max: number): CanvasFrame[] {
  const busy = new Set([state.shown.group, state.loading?.group].filter(Boolean));
  return wanted.filter((d) => !busy.has(d.group)).slice(0, Math.max(0, max));
}
/** The kept frames that fill one of those slots (a stale one included — it is refreshed when it is shown). */
function keptWarm(state: CanvasFrames, want: readonly CanvasFrame[]): CanvasFrame[] {
  return (state.warm ?? []).filter((f) => want.some((d) => d.group === f.group && d.src === f.src));
}

/** Kept frames that could not take a pick the bridge drew: dropped — the stage loads again when it is opened. */
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

/**
 * Put the new page where the old one was: the selected scene at the same height
 * on screen when both pages draw it, else the same scroll offset.
 */
function carryScroll(from: HTMLIFrameElement | null, to: HTMLIFrameElement, anchor: string | null) {
  try {
    const a = from?.contentWindow;
    const b = to.contentWindow;
    if (!a || !b) return;
    /* 📍 No scene selected: keep the SECTION in view, never the raw offset — a
       render that changed the page's height (an Apply, a theme) otherwise
       landed somewhere else entirely (owner 2026-10-02: Apply "jumped to the
       RSVP page"). The raw offset is only the last resort. */
    const key = anchor ?? makerSectionInView(a.document);
    const oldSec = key ? findMakerSection(a.document, key) : null;
    const newSec = key ? findMakerSection(b.document, key) : null;
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
  style,
  frameRef,
  loadingRef,
  backgroundRef,
  broadcastRef,
  warm = [],
  warmMax = 0,
  warmOver = false,
  anchorKey,
  onShown,
  onSwapped,
  pageFrame = false,
}: {
  /** Changes with every render that must reach the canvas. */
  frameKey: string;
  /** Stage + "view as": a change here swaps at once instead of buffering. */
  group: string;
  src: string;
  title: string;
  /** The box the frames fill (size, rounding, shadow). */
  className: string;
  /** The box's own size and scale — the "Both" view draws the desktop at 1280 px, scaled (`both-view.ts`). */
  style?: CSSProperties;
  /** Always the frame SHOWN — every message the Maker posts goes to it. */
  frameRef: MutableRefObject<HTMLIFrameElement | null>;
  /** The loading frame's window, so the Maker's own `ready` listener ignores it. */
  loadingRef: MutableRefObject<Window | null>;
  /** Every frame NOT shown (loading and warm) — the Maker's `ready` listener ignores them all. */
  backgroundRef?: MutableRefObject<Set<Window>>;
  /** Filled here: post a message the bridge draws to the shown frame AND every warm one. */
  broadcastRef?: MutableRefObject<((message: unknown) => void) | null>;
  /** 🔥 The other stages that may stay loaded once the couple has opened them, in priority order (same key format as `frameKey`). */
  warm?: readonly CanvasFrame[];
  /** How many may be kept on this device (`warmCanvasBudget`). */
  warmMax?: number;
  /** The Maker has rendered again since it opened — something was written, so the one warm is over. It can only STOP the warm. */
  warmOver?: boolean;
  /** The scene the couple has selected — kept in place across a swap. */
  anchorKey: () => string | null;
  /** The key of the frame now shown (the canvas guard re-attaches to it). */
  onShown: (key: string) => void;
  /** A buffered swap happened; `ready` is the new frame's own `ready` message. */
  onSwapped: (ready: unknown) => void;
  /** A made-once PAGE's frame (`MakerPageFrame`): the shown one is marked `data-maker-page-frame`. */
  pageFrame?: boolean;
}) {
  const next: CanvasFrame = { key: frameKey, group, src };
  const [frames, setFrames] = useState<CanvasFrames>({ shown: next, loading: null });
  /** The frames the Maker lets this keep right now (read at the switch). */
  const wantedRef = useRef(warm);
  wantedRef.current = warm;
  const els = useRef<Record<string, HTMLIFrameElement | null>>({});
  /** Frame ids in the order they were first mounted — see the render below. */
  const mountOrder = useRef<string[]>([]);
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

  /* Every frame's `ready` is recorded (a kept frame is "ready" here) — and is a
     moment to look at the one warm again, as is the tab coming back. */
  const [warmTick, setWarmTick] = useState(0);
  useEffect(() => {
    const tick = () => setWarmTick((n) => n + 1);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string } | null;
      if (!data || data.source !== 'setnayan-site' || data.t !== 'ready') return;
      for (const [id, el] of Object.entries(els.current)) {
        if (el && event.source === el.contentWindow) {
          readyOf.current[id] = data;
          tick();
        }
      }
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  /* 🔥 THE ONE WARM OF THIS OPEN (`warmOnce`): on idle, one stage at a time,
     and over for good at the first save: a write this document has started
     since this canvas mounted (`opened`), or a Maker render since (`warmOver`). */
  const warmLeft = useRef<readonly CanvasFrame[] | null>(null);
  const opened = useRef(makerSavesStarted());
  useEffect(() => {
    if (warmMax <= 0 || warmLeft.current?.length === 0) return;
    return whenIdle(() => {
      const s = framesRef.current;
      const step = warmOnce(s, warmLeft.current, wantedRef.current, warmMax, {
        ready: (f) => canvasFrameId(f) in readyOf.current,
        hidden: document.visibilityState === 'hidden',
        saved: warmOver || makerSavesStarted() !== opened.current,
      });
      warmLeft.current = step.left;
      if (step.state !== s) setFrames((prev) => (prev === s ? step.state : prev));
    });
  }, [warmTick, warmMax, warmOver]);

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
  /** Kept frames that missed a redraw (`canvasPosts`) — they refresh when shown, never behind the couple's back. */
  const owed = useRef(new Set<string>());
  useEffect(() => {
    if (lastShown.current === shownId) return;
    lastShown.current = shownId;
    /* A kept stage that owed a redraw pays it now that it is on screen — unless
       a fresh page is already loading behind it, which carries the redraw. */
    if (owed.current.delete(shownId) && !framesRef.current.loading) els.current[shownId]?.contentWindow?.postMessage(CANVAS_REFRESH_MESSAGE, window.location.origin);
    const buffered = swapped.current === shownId;
    swapped.current = null;
    if (!buffered && !(shownId in readyOf.current)) return;
    onSwapped(readyOf.current[shownId] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per swap
  }, [shownId]);

  /* The pick the bridge draws, to every frame that keeps matching the draft. */
  useEffect(() => {
    if (!broadcastRef) return;
    broadcastRef.current = (message: unknown) => {
      const to = canvasPosts(framesRef.current, (id) => id in readyOf.current, message === CANVAS_REFRESH_MESSAGE);
      for (const id of to.post) els.current[id]?.contentWindow?.postMessage(message, window.location.origin);
      for (const id of to.owe) owed.current.add(id);
      if (to.drop.length > 0) setFrames((prev) => dropWarmFrames(prev, new Set(to.drop)));
    };
    return () => {
      broadcastRef.current = null;
    };
  }, [broadcastRef]);

  /* A frame gone from every list is forgotten. */
  useEffect(() => {
    const live = new Set([frames.shown, frames.loading, ...(frames.warm ?? [])].filter(Boolean).map((f) => canvasFrameId(f!)));
    for (const id of Object.keys(readyOf.current)) if (!live.has(id)) delete readyOf.current[id];
    for (const id of owed.current) if (!live.has(id)) owed.current.delete(id);
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
    <div
      className={`relative ${className}`}
      style={style}
      {...{ [pageFrame ? 'data-maker-page-frames' : 'data-maker-canvas-frames']: frames.loading ? 'loading' : 'shown' }}
    >
      {list.map((f) => {
        const role = f === frames.shown ? 'shown' : f === frames.loading ? 'loading' : 'warm';
        const loading = role === 'loading';
        return (
          <iframe
            key={canvasFrameId(f)}
            ref={(el) => {
              els.current[canvasFrameId(f)] = el;
            }}
            src={f.src}
            title={role === 'shown' ? title : `${title} (loading behind)`}
            aria-hidden={role !== 'shown' || undefined}
            tabIndex={role !== 'shown' ? -1 : undefined}
            data-maker-canvas-frame={pageFrame ? undefined : role}
            data-maker-page-frame={pageFrame && role === 'shown' ? '' : undefined}
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
