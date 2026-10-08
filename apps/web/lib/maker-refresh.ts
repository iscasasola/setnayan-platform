/**
 * apps/web/lib/maker-refresh.ts
 *
 * ⚡ ONE REFRESH PER BURST OF PICKS — after the LAST save in flight.
 *
 * Owner, 2026-09-28: *"picking something takes a lot of time before the
 * website reacts"*. A pick in the Maker is drawn on the canvas at once (the
 * bridge), then saved into the draft with `hubDraftAction`. The toolbar's
 * Apply · Undo · Restore count and every server-drawn prop read the draft, so
 * the Maker still has to be re-rendered once the save lands.
 *
 * 🔴 WHAT IT COST BEFORE. The action ended with `revalidatePath`, which made
 * its response carry a full render of the Maker route — and every caller then
 * threw that away and asked for the same render again with `router.refresh()`.
 * Two whole-Maker renders per tap. And three quick taps raced: the refresh for
 * tap 1 came back while tap 3 was already on the canvas, the canvas hold saw a
 * render that did not match what it showed, and reloaded the canvas — twice.
 *
 * 🔑 NOW: the action revalidates nothing (a draft reaches no guest), and every
 * Maker save goes through `makerSave`, which counts saves in flight and
 * refreshes ONCE, a beat after the last one lands. The render that comes back
 * holds every tap, so the hold (`element-preview.ts`) matches it and the
 * canvas keeps its page.
 *
 * A refused save owes no refresh of its own (nothing changed on the server);
 * if another save in the same burst succeeded, the burst still refreshes.
 *
 * `createMakerRefresher` is the pure core (`maker-refresh.test.ts` drives it
 * with a fake clock); `makerSave` is the one shared instance the Maker uses.
 *
 * ⚡⚡ AND A PICK THE BRIDGE DREW REFRESHES NOTHING AT ALL (owner 2026-09-30:
 * *"every edit alteration create forces the whole screen to reload and
 * sometimes take more than 10 seconds to change"* — DECISION_LOG "THE MAKER
 * RE-PLAN — SPEED FIRST"). MEASURED from the code that day
 * (`scratchpad/maker-speed/MEASURE.md`): Next.js runs server actions AND
 * `router.refresh()` through ONE serial queue, so the whole-Maker render one
 * pick asked for (3–6 s on production) BLOCKED the next pick's save; it then
 * came back holding the OLDER pick, differed from the canvas hold, and reloaded
 * the canvas to the older value — and the later save's refresh reloaded it
 * again. Two picks 1.2 s apart: two whole-Maker renders, two canvas reloads,
 * the canvas visibly going back, steady ~11 s later.
 *
 * 🔑 NOW a `held` save — the bridge already drew it — owes NO render. What the
 * refresh used to bring back is brought another way:
 *   · the Apply · Undo · Restore count: the save answers with the bar
 *     (`bar` on the result, asked with `HUB_DRAFT_BAR_FIELD`) and `makerSave`
 *     hands it to the toolbar (`MAKER_DRAFT_BAR_EVENT`);
 *   · the canvases the Maker's panels build on: the client's own copy
 *     (`lib/maker-draft-store.ts`), never a stale server prop;
 *   · several quick picks on one part: ONE write (`makerLatestWrite` — the
 *     latest canvas wins, one in flight, one waiting).
 * A held burst still refreshes once when something in it asked for a render
 * the bridge cannot draw (`makerNeedsRender` — a background that changes who
 * draws the card, words the page must redraw). Every write NOT drawn by the
 * bridge refreshes exactly as before.
 */

/** How long after the last save lands the refresh waits for another tap. */
export const MAKER_REFRESH_COALESCE_MS = 180;

/**
 * 🔓 A write the bridge did NOT draw is under way — the canvas must reload for
 * the render it brings (`editor-shell.tsx` drops its hold). Fired by `makerSave`
 * for every save not marked `held`, and by the Maker shell for every form it
 * submits (`maker-shell.tsx`), so no write can land inside a hold unnoticed.
 */
export const MAKER_UNHELD_WRITE_EVENT = 'setnayan:maker-unheld-write';

export type MakerSaveOptions<T> = {
  /** The bridge already drew this change on the canvas (the hold covers it). */
  held?: boolean;
  /** How to read success from the result (default: `result.ok === true`). */
  ok?: (result: T) => boolean;
};

type Timer = unknown;
type Clock = {
  set: (fn: () => void, ms: number) => Timer;
  clear: (t: Timer) => void;
};

export type MakerRefresher = {
  /**
   * Run one save; refresh once when it and every other save in flight have
   * landed — unless it is `held` (the bridge drew it), which owes no refresh.
   */
  save<T>(send: () => Promise<T>, refresh: () => void, ok?: (result: T) => boolean, held?: boolean): Promise<T>;
  /** A held burst must still end in ONE render (the bridge could not draw all of it). */
  needRender(): void;
  /** Saves still in flight — the shell's "saving" state, and the test's probe. */
  inFlight(): number;
};

const okOf = (r: unknown): boolean =>
  Boolean(r && typeof r === 'object' && (r as { ok?: unknown }).ok === true);

export function createMakerRefresher(clock: Clock): MakerRefresher {
  let inFlight = 0;
  let owed = false;
  let timer: Timer | null = null;
  let refreshFn: (() => void) | null = null;

  const settle = () => {
    if (inFlight > 0 || !owed) return;
    if (timer !== null) clock.clear(timer);
    timer = clock.set(() => {
      timer = null;
      // A tap that started during the wait extends the burst.
      if (inFlight > 0 || !owed) return;
      owed = false;
      refreshFn?.();
    }, MAKER_REFRESH_COALESCE_MS);
  };

  return {
    async save(send, refresh, ok = okOf, held = false) {
      inFlight += 1;
      if (timer !== null) {
        clock.clear(timer);
        timer = null;
      }
      try {
        const result = await send();
        /* ⚡ A held save is already on the canvas: nothing to re-render for it. */
        if (ok(result) && !held) owed = true;
        return result;
      } finally {
        inFlight -= 1;
        refreshFn = refresh;
        settle();
      }
    },
    needRender() {
      owed = true;
      settle();
    },
    inFlight: () => inFlight,
  };
}

const shared = createMakerRefresher({
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
});

/* ═══════════════════════════════════════════════════════════════════════════
   ⚡ THE LATEST WRITE WINS — many quick picks on one part are ONE save
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * How long a pick waits for the next tap before its save is sent. Every pick
 * is already on the canvas (the bridge), so the wait is never seen — it only
 * folds a run of − / + taps into one write.
 */
export const MAKER_WRITE_BEAT_MS = 350;

/** What a write that a LATER pick carried resolves to: that later write answers for both. */
export const SUPERSEDED: unique symbol = Symbol('maker-write-superseded');
export type Superseded = typeof SUPERSEDED;

type Waiter = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
type Slot = {
  timer: Timer | null;
  /** A write in flight for this key. */
  flying: boolean;
  /** The write waiting to go: the newest send, and whoever is waiting on it. */
  next: { send: () => Promise<unknown>; waiter: Waiter } | null;
};

export type LatestWriter = {
  /**
   * Save `send` for `key` — after a beat, and never beside another write for
   * the same key. A newer write for the key before this one is sent REPLACES
   * it: this one then resolves to `SUPERSEDED` (the newer one carries the
   * whole canvas, so it answers for both).
   */
  write<T>(key: string, send: () => Promise<T>): Promise<T | Superseded>;
  /** Send every write still waiting for its beat, now (before a write that must follow them). */
  flush(): void;
  /** Writes waiting or in flight — for `key`, or in all. */
  pending(key?: string): number;
};

export function createLatestWriter(clock: Clock, beatMs = MAKER_WRITE_BEAT_MS): LatestWriter {
  const slots = new Map<string, Slot>();
  const slotOf = (key: string): Slot => {
    let s = slots.get(key);
    if (!s) {
      s = { timer: null, flying: false, next: null };
      slots.set(key, s);
    }
    return s;
  };
  const go = (key: string) => {
    const s = slotOf(key);
    if (s.flying || !s.next) return;
    if (s.timer !== null) {
      clock.clear(s.timer);
      s.timer = null;
    }
    const { send, waiter } = s.next;
    s.next = null;
    s.flying = true;
    let p: Promise<unknown>;
    try {
      p = send();
    } catch (e) {
      p = Promise.reject(e);
    }
    /* The slot is free BEFORE its waiter hears the answer, so whoever reads
       `pending` on the answer sees this write as landed. */
    const land = () => {
      s.flying = false;
      /* A pick that came while this one flew goes now if its beat is over. */
      if (s.next && s.timer === null) go(key);
      if (!s.flying && !s.next && s.timer === null) slots.delete(key);
    };
    p.then(
      (v) => {
        land();
        waiter.resolve(v);
      },
      (e) => {
        land();
        waiter.reject(e);
      },
    );
  };
  return {
    write<T>(key: string, send: () => Promise<T>) {
      const s = slotOf(key);
      return new Promise<T | Superseded>((resolve, reject) => {
        if (s.next) s.next.waiter.resolve(SUPERSEDED);
        s.next = { send, waiter: { resolve: resolve as (v: unknown) => void, reject } };
        if (s.timer !== null) clock.clear(s.timer);
        s.timer = clock.set(() => {
          s.timer = null;
          go(key);
        }, beatMs);
      });
    },
    flush() {
      for (const [key, s] of slots) {
        if (s.timer !== null) {
          clock.clear(s.timer);
          s.timer = null;
        }
        go(key);
      }
    },
    pending(key) {
      const count = (s: Slot) => (s.flying ? 1 : 0) + (s.next ? 1 : 0);
      if (key !== undefined) {
        const s = slots.get(key);
        return s ? count(s) : 0;
      }
      let n = 0;
      for (const s of slots.values()) n += count(s);
      return n;
    },
  };
}

const writer = createLatestWriter({
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
});

/**
 * ⚡ One part's save, folded with the quick picks around it:
 * `makerSave(() => makerLatestWrite(key, () => save(next)), refresh, { held: true, ok })`.
 * Resolves to the save's own result, or `SUPERSEDED` when a later pick carried it.
 */
export function makerLatestWrite<T>(key: string, send: () => Promise<T>): Promise<T | Superseded> {
  return writer.write(key, send);
}

/** Writes for `key` still waiting or in flight — the client's copy of that canvas is newer than the server's. */
export function makerWritesPending(key?: string): number {
  return writer.pending(key);
}

/**
 * Every Maker draft save: `await makerSave(() => draftAction(eventId, fd), () => router.refresh(), { held })`.
 * Returns the action's own result, unchanged. `held` = the bridge already drew
 * it: no refresh is owed for it (see the docblock). Anything else sends the
 * picks still waiting first (so it lands after them), tells the canvas to
 * reload for the render it brings, and refreshes once per burst.
 */
export function makerSave<T>(send: () => Promise<T>, refresh: () => void, options: MakerSaveOptions<T> = {}): Promise<T> {
  if (!options.held) announceUnheldWrite();
  if (!options.held) unheldInFlight += 1;
  const saved = shared.save(send, refresh, options.ok, Boolean(options.held));
  return saved
    .finally(() => {
      if (!options.held) unheldInFlight -= 1;
    })
    .then((result) => {
      announceDraftBar(result);
      return result;
    });
}

/** Unheld saves still on their way — their render must reload the canvas, so no redraw may hold it meanwhile. */
let unheldInFlight = 0;
export function makerUnheldSavesInFlight(): number {
  return unheldInFlight;
}

/**
 * 🖼 A held burst the bridge could NOT draw all of (a background that changes
 * who draws the card, words the page must redraw): end it with one render.
 * Called by the shell wherever it releases the canvas hold.
 */
export function makerNeedsRender(): void {
  shared.needRender();
}

/**
 * 🔁 For a Maker control rendered where no router is mounted (a server-rendered
 * settings panel, and its render test): ask the Maker to refresh. The toolbar's
 * draft bar — mounted once in every Maker with a work area — hears it and
 * refreshes the route (`hub-draft-bar.tsx`).
 */
export const MAKER_REFRESH_EVENT = 'setnayan:maker-refresh';
export function requestMakerRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MAKER_REFRESH_EVENT));
}

/**
 * Maker saves still in flight — the canvas warms no stage while one is (it
 * could miss the save). A pick still waiting for its beat counts.
 */
export function makerSavesInFlight(): number {
  return shared.inFlight() + writer.pending();
}

/**
 * Tell the Maker's canvas a write it did not draw is on its way — and send
 * every pick still waiting for its beat FIRST, so the write lands after them
 * (the router runs actions in the order they are sent).
 */
export function announceUnheldWrite(): void {
  writer.flush();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MAKER_UNHELD_WRITE_EVENT));
}

/* ── the toolbar's count, from the save's own answer ─────────────────────── */

/**
 * ⚡ A save that answers with the Apply bar: the form field a held Maker pick
 * sets (`'1'`) so `hubDraftAction` returns `bar` after the write — one request,
 * and no whole-Maker render to learn the count. Lives here, not in
 * `lib/hub-draft.ts`, so the pickers that set it pull in nothing more.
 */
export const HUB_DRAFT_BAR_FIELD = 'bar';

/** The Apply bar a save answered with (`HubDraftActionResult.bar`), for the toolbar. */
export const MAKER_DRAFT_BAR_EVENT = 'setnayan:maker-draft-bar';

function announceDraftBar(result: unknown): void {
  if (typeof window === 'undefined' || !result || typeof result !== 'object') return;
  const bar = (result as { bar?: unknown }).bar;
  if (!bar || typeof bar !== 'object') return;
  window.dispatchEvent(new CustomEvent(MAKER_DRAFT_BAR_EVENT, { detail: bar }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   🖼 A PICK THE BRIDGE CANNOT DRAW IS REDRAWN IN PLACE — never by a whole-Maker render
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Owner, live on iPhone 2026-10-06: Countdown › Format › Style → "Big number",
 * and the canvas kept the four boxes. A scene's STYLE (and a palette look, a
 * fixed part's style, a background that changes who draws the card) is a
 * different component, so the bridge cannot draw it; the save was UNHELD, and
 * the only way it reached the canvas was the whole-Maker render it owed — on
 * production the save, then a 3–6 s Maker render, then the canvas page loading
 * behind — about ten seconds of nothing, measured in the lab with production's
 * latencies (`/dev/maker-lab?slow=1`). And every Maker render mounted a NEW
 * frame for each page frame (`MakerPageFrame` keyed on the render stamp), so a
 * palette pick on Look "reset the page" to the cover.
 *
 * 🔑 NOW such a save is HELD (no Maker render is owed for it — the Maker keeps
 * its own copy, `lib/maker-draft-store.ts`), and once the LAST one in flight
 * lands the Maker asks every page it shows to re-render ITSELF, in place
 * (`MAKER_CANVAS_REDRAW_EVENT` → `{ t: 'refresh' }` → the bridge's
 * `router.refresh()`): one render of the canvas page alone, the same frame, the
 * same scroll, the same section in view.
 */
export const MAKER_CANVAS_REDRAW_EVENT = 'setnayan:maker-canvas-redraw';

/** The message every Maker page frame's bridge answers with a refresh in place (`editor-bridge.tsx`). */
export const CANVAS_REFRESH_MESSAGE = { source: 'setnayan-editor', t: 'refresh' } as const;

export type CanvasRedrawer = {
  /** Run one save; once it and every other redraw save in flight have landed, redraw once (if any succeeded). */
  save<T>(send: () => Promise<T>, ok?: (result: T) => boolean): Promise<T>;
  inFlight(): number;
};

/** The pure core — `maker-refresh.test.ts` drives it with a fake `redraw`. */
export function createCanvasRedrawer(redraw: () => void): CanvasRedrawer {
  let inFlight = 0;
  let owed = false;
  return {
    async save(send, ok = okOf) {
      inFlight += 1;
      try {
        const result = await send();
        if (ok(result)) owed = true;
        return result;
      } finally {
        inFlight -= 1;
        if (inFlight === 0 && owed) {
          owed = false;
          redraw();
        }
      }
    },
    inFlight: () => inFlight,
  };
}

/** Ask every page the Maker shows (the canvas and its warm stages, Look's page) to re-render in place. */
export function requestCanvasRedraw(): void {
  if (typeof window === 'undefined') return;
  /* 🪟 Nobody is looking at a page: it redraws ONCE, when one is shown again (`holdCanvasRedraw`). */
  if (redrawHeld) {
    redrawOwed = true;
    return;
  }
  window.dispatchEvent(new Event(MAKER_CANVAS_REDRAW_EVENT));
}

/**
 * 🪟 NO PAGE ON SCREEN, NO PAGE RENDER (owner rule 2026-10-08: *"the least amount of request for the tasks to be
 * done"*). While Studio › Look shows its sample screen (`look-sample.tsx`) the stage canvas is hidden, and a pick
 * the server must measure (a page colour, a Shade, Candlelight) used to re-render that hidden guest page — once per
 * pick, for nobody. Held, those picks are ONE write each; the page redraws ONCE when it is shown again, and only if
 * something asked. Releasing with nothing owed asks for nothing.
 */
let redrawHeld = false;
let redrawOwed = false;
export function holdCanvasRedraw(hold: boolean): void {
  redrawHeld = hold;
  if (hold || !redrawOwed) return;
  redrawOwed = false;
  requestCanvasRedraw();
}

const redrawer = createCanvasRedrawer(requestCanvasRedraw);

/**
 * 🖼 A save the bridge cannot draw (a style, a palette look, a background that
 * changes who draws the card): HELD — no whole-Maker render — and the pages
 * redraw in place once the last such save lands. `refresh` is the caller's
 * `router.refresh` (it still ends any unheld write in the same burst).
 */
export function makerRedrawSave<T>(send: () => Promise<T>, refresh: () => void, ok?: (result: T) => boolean): Promise<T> {
  return redrawer.save(() => makerSave(send, refresh, { held: true, ok }), ok);
}
