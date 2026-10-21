/**
 * tab-return.ts — A LIVE SOCKET ONLY WHERE SOMETHING IS LIVE (2026-10-21).
 *
 * 🔌 THE COST. Every Supabase Realtime channel a page subscribes to keeps the tab's one websocket open, and a
 * `postgres_changes` channel also makes the database evaluate every matching write for that tab. The unread bell and
 * the Messages envelope sat in EVERY signed-in layout, so every plain page — a guest list, a budget, a settings form —
 * held a socket open, all day, in every tab a couple or a supplier left open. Nothing on those pages is live.
 *
 * The two shapes here replace a socket where nothing is live:
 *
 *   · `startCountPoll` — a small number (an unread count) is re-asked on a slow timer while the tab is in view, and at
 *     once when the person comes back to it. A hidden tab asks nothing.
 *     🔒 A FAILED READ CHANGES NOTHING. `read` answers `null` when it could not read, and `null` never reaches
 *     `onValue` — so a refused or dropped read leaves the last count standing instead of drawing a false 0 (the repo's
 *     rule: a failure must never render as emptiness).
 *
 *   · `onTabReturn` — a page that only needs to be current when someone LOOKS at it (the budget) re-reads when the tab
 *     comes back into view or regains focus, at most once per `minGapMs`.
 *
 * And for the surfaces that ARE live (a chat thread, the day-of header, the announcement) but whose state is fully
 * re-read on resubscribe:
 *
 *   · `pauseWhileHidden` — the channel is torn down once the tab has been hidden for `hiddenMs`, and opened again
 *     (which re-reads) when the tab comes back. When the last channel in a tab goes, realtime-js closes the socket.
 *     ⚠ Never for a call, Panood, a demo pairing, the wall or presence — those must keep listening while hidden.
 *
 * Every function takes an optional `env` so the node tests can drive time and visibility (lib/tab-return.test.ts).
 */

export type TabEnv = {
  isVisible: () => boolean;
  /** Subscribe to the moments a person may have come back: visibilitychange (to visible), focus, online. */
  onWake: (cb: () => void) => () => void;
  /** Subscribe to visibility changes (both directions). */
  onVisibility: (cb: () => void) => () => void;
  now: () => number;
  setInterval: (cb: () => void, ms: number) => unknown;
  clearInterval: (h: unknown) => void;
  setTimeout: (cb: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
};

export function browserTabEnv(): TabEnv {
  return {
    isVisible: () => typeof document === 'undefined' || document.visibilityState === 'visible',
    onWake: (cb) => {
      const onVis = () => {
        if (document.visibilityState === 'visible') cb();
      };
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', cb);
      window.addEventListener('online', cb);
      return () => {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', cb);
        window.removeEventListener('online', cb);
      };
    },
    onVisibility: (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
    now: () => Date.now(),
    setInterval: (cb, ms) => window.setInterval(cb, ms),
    clearInterval: (h) => window.clearInterval(h as number),
    setTimeout: (cb, ms) => window.setTimeout(cb, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
  };
}

/** How often a visible tab re-asks an unread count. A minute: a badge, not a conversation. */
export const COUNT_POLL_MS = 60_000;
/** Coming back to the tab re-asks at once — unless the last ask was this recent (focus + visibility fire together). */
export const RETURN_MIN_GAP_MS = 10_000;
/** A live channel whose page is re-read on resubscribe is let go after the tab has been hidden this long. */
export const HIDDEN_PAUSE_MS = 45_000;

/**
 * Re-ask a count on a slow timer while the tab is in view, and at once on return. The first ask is deferred: the
 * server render that seeded the count has only just read it. Returns `stop`.
 */
export function startCountPoll({
  read,
  onValue,
  intervalMs = COUNT_POLL_MS,
  minGapMs = RETURN_MIN_GAP_MS,
  env = browserTabEnv(),
}: {
  /** The count, or `null` when it could not be read. */
  read: () => Promise<number | null>;
  onValue: (n: number) => void;
  intervalMs?: number;
  minGapMs?: number;
  env?: TabEnv;
}): () => void {
  let stopped = false;
  let inflight = false;
  let lastAskAt = env.now();

  const ask = () => {
    if (stopped || inflight || !env.isVisible()) return;
    inflight = true;
    lastAskAt = env.now();
    read()
      .then((n) => {
        // 🔒 null = could not read. Leave what is drawn alone; the next ask tries again.
        if (!stopped && typeof n === 'number' && Number.isFinite(n)) onValue(n);
      })
      .catch(() => {
        /* a thrown read is a failed read — same answer: change nothing */
      })
      .finally(() => {
        inflight = false;
      });
  };

  const timer = env.setInterval(ask, intervalMs);
  const unwake = env.onWake(() => {
    if (env.now() - lastAskAt >= minGapMs) ask();
  });

  return () => {
    stopped = true;
    env.clearInterval(timer);
    unwake();
  };
}

/**
 * Call `cb` when the tab comes back into view / regains focus, at most once per `minGapMs` (measured from the
 * previous call, or from mount). Returns `stop`.
 */
export function onTabReturn(
  cb: () => void,
  { minGapMs = RETURN_MIN_GAP_MS, env = browserTabEnv() }: { minGapMs?: number; env?: TabEnv } = {},
): () => void {
  let last = env.now();
  return env.onWake(() => {
    if (!env.isVisible()) return;
    if (env.now() - last < minGapMs) return;
    last = env.now();
    cb();
  });
}

/**
 * Hold a live channel only while the tab is in use. `open` subscribes and returns its own close (which may be async —
 * `removeChannel` resolves when the channel has left). After the tab has been hidden for `hiddenMs` the channel is
 * closed; when the tab is visible again it is opened afresh — the caller's own SUBSCRIBED handler re-reads, which is
 * why this is only for channels whose page is fully re-read on (re)subscribe. Returns `stop`.
 */
export function pauseWhileHidden(
  open: () => () => void | Promise<unknown>,
  { hiddenMs = HIDDEN_PAUSE_MS, env = browserTabEnv() }: { hiddenMs?: number; env?: TabEnv } = {},
): () => void {
  let stopped = false;
  let close: (() => void | Promise<unknown>) | null = open();
  let closing: Promise<unknown> = Promise.resolve();
  let pauseTimer: unknown = null;

  const clearPause = () => {
    if (pauseTimer !== null) env.clearTimeout(pauseTimer);
    pauseTimer = null;
  };

  const unvis = env.onVisibility(() => {
    if (stopped) return;
    if (!env.isVisible()) {
      if (close && pauseTimer === null) {
        pauseTimer = env.setTimeout(() => {
          pauseTimer = null;
          if (stopped || env.isVisible() || !close) return;
          const c = close;
          close = null;
          closing = Promise.resolve()
            .then(c)
            .catch(() => {});
        }, hiddenMs);
      }
      return;
    }
    clearPause();
    if (!close) {
      // Re-open only once the old channel has left — the client hands back a still-closing channel of the same topic.
      void closing.then(() => {
        if (!stopped && !close && env.isVisible()) close = open();
      });
    }
  });

  return () => {
    stopped = true;
    clearPause();
    unvis();
    if (close) {
      const c = close;
      close = null;
      void c();
    }
  };
}
