/**
 * canvas-bridge-watch.ts — 👂 A CANVAS THAT NEVER ANSWERS IS SAID, NEVER SHOWN AS IF IT WORKED.
 *
 * 🔴 2026-10-18 night, live, the owner's own event in his Safari (~800 px wide): *"cannot select again"* — every part
 * of the Maker's canvas (the countdown, the note, the E-Gifts, a scene's ＋ Photo) took the tap and NOTHING happened;
 * the toolbar stayed on "YOU'RE EDITING · INVITATION › HOME" with an empty Edit. In Chromium, the same event worked.
 *
 * Every tap on the canvas is the page's bridge talking to the Maker (`editor-bridge.tsx`: a tap → `{ t:'edit' }`), and
 * the bridge announces itself once with `{ t:'ready' }`. A frame whose bridge never says `ready` was ALREADY handled
 * — silently: `BufferedCanvasFrame` shows it anyway after `NO_BRIDGE_MS` (right for a slow page, so the couple is
 * never stuck behind a blank one), and then nothing tells anyone that the page on screen cannot hear them. That is the
 * house disease — a failure drawn exactly like success — and it is why this could not be seen from here: the page
 * draws, the taps vanish, and no fault is recorded.
 *
 * ✅ So the frame on screen is watched (`createCanvasBridgeWatch`): loaded and still no `ready` after
 *    `CANVAS_BRIDGE_GRACE_MS` —
 *      1. it is loaded again ONCE, by itself (only a frame that never said `ready` — so it never took a tap, a word or
 *         a pick: there is nothing on it to lose, and the Maker's own shell, drafts and saves are not touched);
 *      2. still silent → the toolbar says so in plain words, with ONE button that loads it again
 *         (`CANVAS_SILENT_WORDS` · `CANVAS_SILENT_RELOAD`, drawn by `stage-tools.tsx`);
 *      3. each time, a fault is recorded through the app's one fault path (`trackFailure` → app_fault_issues), with
 *         the browser, which handshake was missing, whether the frame had been a kept/loading one, and what its own
 *         document says it is (`readCanvasDoc`: did the server draw the HOST canvas — the Maker's section marks — or a
 *         guest's page?). The next report like the owner's carries its own evidence.
 *    A `ready` that arrives later takes the line away.
 *
 * Pure — no React, no DOM of its own: the frame wiring hands it `later`/`clear`/`reload`/`say`/`report`, and
 * `canvas-bridge-watch.test.ts` drives this very code.
 */

/** How long a LOADED frame may stay without its bridge's `ready` before it counts as not answering. */
export const CANVAS_BRIDGE_GRACE_MS = 6_000;
/** How many times a silent frame is loaded again by itself before the couple is told. */
export const CANVAS_BRIDGE_AUTO_RELOADS = 1;

/** The toolbar's words for a canvas that does not answer — plain, one line (the controller's words, 2026-10-18). */
export const CANVAS_SILENT_WORDS = "The page isn't answering taps.";
/** …and its one button. */
export const CANVAS_SILENT_RELOAD = 'Reload';

/** Window events between the canvas frames (`buffered-canvas-frame.tsx`) and the toolbar (`stage-tools.tsx`). */
export const MAKER_CANVAS_SILENT_EVENT = 'setnayan:maker-canvas-silent';
export const MAKER_CANVAS_RELOAD_EVENT = 'setnayan:maker-canvas-reload';
export type MakerCanvasSilentDetail = { silent: boolean };

/** Where a frame first stood when it was mounted: shown straight away, or loaded behind (buffered) / kept warm. */
export type CanvasFrameBirth = 'shown' | 'loading' | 'warm';

/** What a frame's own document says about itself — read only when it is not answering. */
export type CanvasDocReading = {
  /** 'host' — the server drew the HOST canvas (the Maker's section marks, drawn only with the bridge);
   *  'guest' — a page with none of them (the server did not see the host); 'unreadable' — no document to read. */
  drawnFor: 'host' | 'guest' | 'unreadable';
  /** Did a bridge bind any section on it? */
  bound: boolean;
  /** The frame's address (the slug's path + the canvas's own query — stage, editor, tabs). */
  at: string | null;
};

/** The marks only the host canvas draws (`site-body.tsx` `data-maker-section`) and only a running bridge writes. */
const HOST_MARK = '[data-maker-section]';
const BOUND_MARK = '[data-setnayan-editor-bound]';

/** Read a frame's document (same origin) — never throws. */
export function readCanvasDoc(frame: { contentDocument?: Document | null; contentWindow?: Window | null } | null | undefined): CanvasDocReading {
  try {
    const doc = frame?.contentDocument ?? null;
    if (!doc || !doc.documentElement) return { drawnFor: 'unreadable', bound: false, at: null };
    const loc = frame?.contentWindow?.location;
    return {
      drawnFor: doc.querySelector(HOST_MARK) ? 'host' : 'guest',
      bound: Boolean(doc.querySelector(BOUND_MARK)),
      at: loc ? `${loc.pathname}${loc.search}`.slice(0, 300) : null,
    };
  } catch {
    return { drawnFor: 'unreadable', bound: false, at: null };
  }
}

export type CanvasSilentReport = {
  /** 'auto-reload' — the first silence, loaded again by itself; 'told' — still silent, the toolbar says so. */
  step: 'auto-reload' | 'told';
  /** The handshake that never came. */
  missing: 'ready';
  birth: CanvasFrameBirth;
  /** How many times this frame had been loaded again before this report. */
  reloads: number;
  doc: CanvasDocReading;
};

export type CanvasBridgeWatchHost = {
  later: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
  /** The id of the frame on screen now. */
  shown: () => string;
  /** Has this frame's bridge said `ready`? */
  isReady: (id: string) => boolean;
  /** Load this frame's own document again (the frame only — never the Maker). */
  reload: (id: string) => void;
  /** The toolbar line on / off. */
  say: (silent: boolean) => void;
  report: (r: CanvasSilentReport) => void;
  readDoc: (id: string) => CanvasDocReading;
  birth: (id: string) => CanvasFrameBirth;
};

export type CanvasBridgeWatch = {
  /** A frame's document has loaded (`load`). */
  loaded: (id: string) => void;
  /** A frame is now the one on screen. */
  shownNow: (id: string) => void;
  /** A frame's bridge said `ready`. */
  ready: (id: string) => void;
  /** The couple pressed Reload: the frame on screen loads again. */
  reloadNow: () => void;
  dispose: () => void;
};

export function createCanvasBridgeWatch(host: CanvasBridgeWatchHost): CanvasBridgeWatch {
  const reloads = new Map<string, number>();
  const loadedIds = new Set<string>();
  let timer: unknown = null;
  let timerFor: string | null = null;
  /** The frame the toolbar line is about (null: no line). */
  let silentFor: string | null = null;

  const stop = () => {
    if (timer !== null) host.clear(timer);
    timer = null;
    timerFor = null;
  };
  const quiet = () => {
    if (silentFor === null) return;
    silentFor = null;
    host.say(false);
  };
  const check = (id: string) => {
    timer = null;
    timerFor = null;
    if (id !== host.shown() || host.isReady(id)) return;
    const n = reloads.get(id) ?? 0;
    const doc = host.readDoc(id);
    if (n < CANVAS_BRIDGE_AUTO_RELOADS) {
      host.report({ step: 'auto-reload', missing: 'ready', birth: host.birth(id), reloads: n, doc });
      reloads.set(id, n + 1);
      loadedIds.delete(id);
      host.reload(id);
      return;
    }
    host.report({ step: 'told', missing: 'ready', birth: host.birth(id), reloads: n, doc });
    silentFor = id;
    host.say(true);
  };
  const arm = (id: string) => {
    if (id !== host.shown() || !loadedIds.has(id) || host.isReady(id)) return;
    if (timerFor === id) return;
    stop();
    timerFor = id;
    timer = host.later(() => check(id), CANVAS_BRIDGE_GRACE_MS);
  };

  return {
    loaded: (id) => {
      loadedIds.add(id);
      arm(id);
    },
    shownNow: (id) => {
      /* another page on screen: the line was about the one before */
      if (silentFor !== null && silentFor !== id) quiet();
      if (timerFor !== null && timerFor !== id) stop();
      arm(id);
    },
    ready: (id) => {
      if (timerFor === id) stop();
      if (silentFor === id) quiet();
    },
    reloadNow: () => {
      const id = host.shown();
      quiet();
      stop();
      loadedIds.delete(id);
      host.reload(id);
    },
    dispose: () => {
      stop();
      quiet();
    },
  };
}

/** The fault record (`trackFailure` → app_fault_issues) — loaded only when there is one, never with the Maker. */
export function reportSilentCanvas(r: CanvasSilentReport): void {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  void import('@/lib/telemetry/track-error')
    .then(({ trackFailure }) =>
      trackFailure({
        eventType: 'DEAD_TAP',
        elementName: `Maker canvas · no answer to taps (${r.step})`,
        filePath: 'app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame.tsx',
        error: `the canvas's bridge never said "${r.missing}" — drawn for ${r.doc.drawnFor}, bound ${r.doc.bound ? 'yes' : 'no'}`,
        payload: {
          step: r.step,
          missing: r.missing,
          birth: r.birth,
          buffered: r.birth !== 'shown',
          reloads: r.reloads,
          drawnFor: r.doc.drawnFor,
          host: r.doc.drawnFor === 'host',
          bound: r.doc.bound,
          at: r.doc.at,
          ua: ua.slice(0, 300),
          width: typeof window !== 'undefined' ? window.innerWidth : null,
        },
      }),
    )
    .catch(() => {
      /* a fault that cannot be sent never surfaces to the couple */
    });
}
